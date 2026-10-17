"""Confirmed Fuji ledger adapter; a durable signed hash precedes every broadcast."""
from functools import wraps
import json
import os
from pathlib import Path

from dotenv import dotenv_values
from web3 import Web3, HTTPProvider
from web3.exceptions import TransactionNotFound
from web3.middleware import ExtraDataToPOAMiddleware

from .config import GrailError
from .payload import commitment
from .storage import atomic_json, read_json


def safe_chain(function):
    @wraps(function)
    def guarded(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except GrailError:
            raise
        except Exception as error:
            # Provider exceptions may contain RPC credentials or signed calldata.
            raise GrailError(f"CHAIN_RPC: {function.__name__} failed ({type(error).__name__})") from None
    return guarded


def wallet_settings():
    fields = ('AGENT_PRIVATE_KEY', 'AGENT_ADDRESS', 'AVAX_RPC_URL', 'FUJI_RPC_URL', 'AVAX_CHAIN_ID')
    values = {}
    if os.environ.get('GRAIL_ENV'):
        path = Path(os.environ['GRAIL_ENV'])
        if not path.is_file():
            raise GrailError('GRAIL_ENV: configured environment file is missing')
        source = dotenv_values(path, interpolate=False)
        values = {key: source[key] for key in fields if source.get(key)}
    values.update({key: os.environ[key] for key in fields if os.environ.get(key)})
    return values


class FujiChain:
    @safe_chain
    def __init__(self, path, runtime, *, settings=None, web3=None, receipt_timeout=40):
        self.descriptor = json.loads(Path(path).read_text(encoding='utf-8'))
        data = self.descriptor
        if data.get('network') != 'fuji' or data.get('chainId') != 43113 or data.get('contractVersion') != '0.5':
            raise GrailError('CHAIN_NETWORK: expected Fuji 43113 / contracts 0.5')
        vector = data['testVector']
        if commitment(vector['payloadUtf8'], vector['saltHex']) != vector['commitHash']:
            raise GrailError('CHAIN_VECTOR: deployment commitment vector mismatch')
        settings = wallet_settings() if settings is None else settings
        if not settings.get('AGENT_PRIVATE_KEY') or not settings.get('AGENT_ADDRESS'):
            raise GrailError('CHAIN_IDENTITY: agent key/address required through GRAIL_ENV')
        if str(settings.get('AVAX_CHAIN_ID', '43113')) != '43113':
            raise GrailError('CHAIN_NETWORK: configured chain must be Fuji 43113')
        rpc = settings.get('FUJI_RPC_URL') or settings.get('AVAX_RPC_URL') or 'https://api.avax-test.network/ext/bc/C/rpc'
        self.w3 = web3 if web3 is not None else Web3(HTTPProvider(rpc, request_kwargs={'timeout': 10}, exception_retry_configuration=None))
        if 'grail_poa' not in self.w3.middleware_onion:
            self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, name='grail_poa', layer=0)
        if self.w3.eth.chain_id != 43113:
            raise GrailError('CHAIN_NETWORK: RPC is not Fuji 43113')
        self.account = self.w3.eth.account.from_key(settings['AGENT_PRIVATE_KEY'])
        self.address = self.account.address
        if self.address.lower() != settings['AGENT_ADDRESS'].lower() or self.address.lower() != data['agentWallet'].lower():
            raise GrailError('CHAIN_IDENTITY: signer/address/deployment wallet mismatch')
        self.agent_id = int(data['agentId'])
        ledger = data['contracts']['GrailLedger']
        registry = data['contracts']['IdentityRegistry']
        self.ledger = self.w3.eth.contract(address=Web3.to_checksum_address(ledger['address']), abi=ledger['abi'])
        self.registry = self.w3.eth.contract(address=Web3.to_checksum_address(registry['address']), abi=registry['abi'])
        if not self.w3.eth.get_code(self.ledger.address) or not self.w3.eth.get_code(self.registry.address):
            raise GrailError('CHAIN_IDENTITY: deployed ledger/registry code is missing')
        if self.ledger.functions.identityRegistry().call().lower() != self.registry.address.lower() or not self.registry.functions.isAuthorized(self.agent_id, self.address).call():
            raise GrailError('CHAIN_IDENTITY: ledger registry or agent authorization mismatch')
        deployment = self.w3.eth.get_transaction_receipt(ledger['deployTx'])
        if deployment['status'] != 1 or deployment['contractAddress'].lower() != self.ledger.address.lower():
            raise GrailError('CHAIN_DEPLOYMENT: ledger deployment receipt mismatch')
        self.start_block = deployment['blockNumber']
        self.receipt_timeout = receipt_timeout
        self.path = Path(runtime) / 'fuji-transactions.json'
        self.events_path = Path(runtime) / 'fuji-events.json'
        self.identity = {'chain_id': 43113, 'ledger': self.ledger.address, 'sender': self.address, 'agent_id': str(self.agent_id)}
        journal = self._journal()
        if journal['identity'] != self.identity:
            raise GrailError('CHAIN_JOURNAL: runtime belongs to another ledger/signer')

    def _journal(self):
        return read_json(self.path, {'identity': self.identity, 'transactions': {}})

    def _logs(self, event, cycle_id=None, *, end=None, start=None):
        end = self.w3.eth.block_number if end is None else end
        arguments = {'agentId': self.agent_id}
        if cycle_id is not None:
            arguments['cycleId'] = cycle_id
        logs = []
        for page in range(self.start_block if start is None else start, end + 1, 100):
            logs.extend(event.get_logs(from_block=page, to_block=min(page + 99, end), argument_filters=arguments))
        return logs

    def _invalidate_confirmations(self):
        journal = self._journal()
        changed = False
        for record in journal['transactions'].values():
            if record.pop('status', None) is not None:
                changed = True
        if changed:
            atomic_json(self.path, journal)

    def _event_logs(self, name, *, end):
        cache = read_json(self.events_path, {'identity': self.identity, 'streams': {}})
        if cache['identity'] != self.identity:
            raise GrailError('CHAIN_JOURNAL: event history belongs to another ledger/signer')
        stream = cache['streams'].get(name)
        if stream and (stream['through_block'] > end or self.w3.eth.get_block(stream['through_block'])['hash'].to_0x_hex() != stream['block_hash']):
            # A changed canonical checkpoint invalidates both history and receipt
            # confirmations. Unresolved hashes must be queried before any new send.
            cache['streams'] = {}
            self._invalidate_confirmations()
            stream = None
        start = stream['through_block'] + 1 if stream else self.start_block
        if start > end:
            return stream['logs']
        checkpoint = self.w3.eth.get_block(end)['hash'].to_0x_hex()
        rows = list(stream['logs']) if stream else []
        event = getattr(self.ledger.events, name)()
        for log in self._logs(event, start=start, end=end):
            row = {'cycle_id': int(log['args']['cycleId']), 'tx_hash': log['transactionHash'].to_0x_hex()}
            if name == 'DecisionCommitted':
                row['commit_hash'] = Web3.to_hex(log['args']['commitHash'])
            rows.append(row)
        counter = self.ledger.functions.commitCount if name == 'DecisionCommitted' else self.ledger.functions.revealCount
        if len(rows) != counter(self.agent_id).call(block_identifier=end) or len({row['cycle_id'] for row in rows}) != len(rows):
            raise GrailError('CHAIN_LOGS: incomplete or duplicate event history; cursor retained')
        if self.w3.eth.get_block(end)['hash'].to_0x_hex() != checkpoint:
            raise GrailError('CHAIN_LOGS: canonical checkpoint changed during scan')
        # Cursor and complete event rows advance together, after every page succeeds.
        cache['streams'][name] = {'through_block': end, 'block_hash': checkpoint, 'logs': rows}
        atomic_json(self.events_path, cache)
        return rows

    def _receipt(self, tx_hash, *, wait=False):
        try:
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
        except TransactionNotFound:
            receipt = None
        if receipt is None and wait:
            try:
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=self.receipt_timeout, poll_latency=0.5)
            except Exception:
                raise GrailError(f'CHAIN_TX_UNKNOWN: receipt unresolved for {tx_hash}; query only, never resend') from None
        if receipt is None:
            raise GrailError(f'CHAIN_TX_UNKNOWN: receipt unresolved for {tx_hash}; query only, never resend')
        if receipt['from'].lower() != self.address.lower() or receipt['to'].lower() != self.ledger.address.lower() or receipt['transactionHash'].to_0x_hex() != tx_hash:
            raise GrailError('CHAIN_RECEIPT: transaction identity mismatch')
        block = self.w3.eth.get_block(receipt['blockNumber'])
        if receipt['blockHash'] != block['hash']:
            raise GrailError('CHAIN_RECEIPT: receipt is not in the canonical block')
        if receipt['status'] != 1:
            raise GrailError(f'CHAIN_TX_REVERTED: {tx_hash}; no order authorized')
        return receipt

    def _confirm_transaction(self, tx_hash, *, wait=False):
        journal = self._journal()
        record = next((row for row in journal['transactions'].values() if row['tx_hash'] == tx_hash), None)
        if record and record.get('status') == 'confirmed':
            return
        receipt = self._receipt(tx_hash, wait=wait)
        if record is not None:
            # Persist a checkpoint covering the receipt BEFORE its skip marker.
            # A crash between these writes can only cause another verification.
            self._event_logs('DecisionCommitted', end=self.w3.eth.block_number)
            if self.w3.eth.get_block(receipt['blockNumber'])['hash'] != receipt['blockHash']:
                raise GrailError('CHAIN_RECEIPT: canonical block changed during confirmation')
            journal = self._journal()
            record = next(row for row in journal['transactions'].values() if row['tx_hash'] == tx_hash)
            record['status'] = 'confirmed'
            atomic_json(self.path, journal)

    def _send(self, key, function):
        # Validate the saved canonical checkpoint before trusting terminal receipts.
        self._event_logs('DecisionCommitted', end=self.w3.eth.block_number)
        journal = self._journal()
        data = function._encode_transaction_data()
        previous = journal['transactions'].get(key)
        if previous:
            if previous['data'] != data:
                raise GrailError('CHAIN_JOURNAL: transaction intent differs; never replace or resend')
            self._confirm_transaction(previous['tx_hash'], wait=True)
            return previous['tx_hash']
        # A new nonce must not bypass an ambiguous earlier submission.
        for record in journal['transactions'].values():
            if record.get('status') == 'confirmed':
                continue
            try:
                self._confirm_transaction(record['tx_hash'])
            except GrailError as error:
                if not str(error).startswith('CHAIN_TX_REVERTED:'):
                    raise
        nonce = self.w3.eth.get_transaction_count(self.address, 'pending')
        gas = function.estimate_gas({'from': self.address}) * 12 // 10
        gas_price = self.w3.eth.gas_price
        if self.w3.eth.get_balance(self.address) < gas * gas_price:
            raise GrailError('CHAIN_GAS: insufficient Fuji AVAX for this transaction')
        transaction = function.build_transaction({'from': self.address, 'chainId': 43113, 'nonce': nonce, 'gas': gas, 'gasPrice': gas_price, 'value': 0})
        signed = self.account.sign_transaction(transaction)
        tx_hash = signed.hash.to_0x_hex()
        journal = self._journal()  # retain confirmations persisted during reconciliation
        journal['transactions'][key] = {'tx_hash': tx_hash, 'nonce': nonce, 'data': data}
        atomic_json(self.path, journal)
        try:
            returned = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            if returned.to_0x_hex() != tx_hash:
                raise GrailError('CHAIN_RECEIPT: broadcast hash mismatch')
        except Exception:
            # Sending may have succeeded. The signed hash is already durable.
            self._confirm_transaction(tx_hash, wait=True)
            return tx_hash
        self._confirm_transaction(tx_hash, wait=True)
        return tx_hash

    @safe_chain
    def next_cycle_id(self):
        end = self.w3.eth.block_number
        logs = self._event_logs('DecisionCommitted', end=end)
        if len(logs) != self.ledger.functions.commitCount(self.agent_id).call(block_identifier=end):
            raise GrailError('CHAIN_LOGS: incomplete commitment history; cannot allocate cycle')
        return max((log['cycle_id'] for log in logs), default=0) + 1

    @safe_chain
    def lookup(self, cycle_id):
        end = self.w3.eth.block_number
        digest, _, committed, revealed = self.ledger.functions.decisions(self.agent_id, cycle_id).call(block_identifier=end)
        if not committed:
            previous = self._journal()['transactions'].get(f'commit:{cycle_id}')
            if previous:
                try:
                    self._confirm_transaction(previous['tx_hash'])
                except GrailError as error:
                    if not str(error).startswith('CHAIN_TX_REVERTED:'):
                        raise
            return None
        commits = [log for log in self._event_logs('DecisionCommitted', end=end) if log['cycle_id'] == cycle_id]
        reveals = [log for log in self._event_logs('DecisionRevealed', end=end) if log['cycle_id'] == cycle_id] if revealed else []
        if len(commits) != 1 or (revealed and len(reveals) != 1) or commits[0]['commit_hash'] != Web3.to_hex(digest):
            raise GrailError('CHAIN_LOGS: missing or inconsistent decision events')
        commit_tx = commits[0]['tx_hash']
        self._confirm_transaction(commit_tx)
        reveal_tx = reveals[0]['tx_hash'] if reveals else None
        if reveal_tx:
            self._confirm_transaction(reveal_tx)
        return {'commit_hash': Web3.to_hex(digest), 'commit_tx': commit_tx, 'revealed': revealed, 'reveal_tx': reveal_tx}

    @safe_chain
    def commit(self, cycle_id, commit_hash):
        if self.lookup(cycle_id):
            raise GrailError('CHAIN_DUPLICATE: cycle already committed')
        tx = self._send(f'commit:{cycle_id}', self.ledger.functions.commitDecision(self.agent_id, cycle_id, bytes.fromhex(commit_hash[2:])))
        entry = self.lookup(cycle_id)
        if not entry or entry['commit_hash'] != commit_hash or entry['commit_tx'] != tx:
            raise GrailError('CHAIN_COMMIT_UNCONFIRMED: receipt/event/state mismatch; no orders')
        return tx

    @safe_chain
    def reveal(self, cycle_id, payload_utf8, salt_hex, okx_order_id):
        entry = self.lookup(cycle_id)
        if not entry or entry['revealed'] or commitment(payload_utf8, salt_hex) != entry['commit_hash']:
            raise GrailError('CHAIN_REVEAL: missing, duplicate or mismatched commitment')
        tx = self._send(f'reveal:{cycle_id}', self.ledger.functions.revealDecision(self.agent_id, cycle_id, payload_utf8.encode('utf-8'), bytes.fromhex(salt_hex[2:]), okx_order_id))
        result = self.lookup(cycle_id)
        if not result or not result['revealed'] or result['reveal_tx'] != tx:
            raise GrailError('CHAIN_REVEAL_UNCONFIRMED: receipt/event/state mismatch')
        return tx

    @safe_chain
    def info(self):
        block = self.w3.eth.block_number
        commits = self.ledger.functions.commitCount(self.agent_id).call(block_identifier=block)
        reveals = self.ledger.functions.revealCount(self.agent_id).call(block_identifier=block)
        return {'network': 'fuji', 'simulated': False, 'chain_id': 43113, 'address': self.ledger.address, 'explorer': self.descriptor['explorer'], 'agent_id': str(self.agent_id), 'identity_registry': self.registry.address, 'commits': commits, 'reveals': reveals, 'unrevealed': commits - reveals}

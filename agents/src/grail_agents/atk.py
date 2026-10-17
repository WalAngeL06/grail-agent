"""Small ATK subprocess transport. Reads have a closed command allowlist."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

from .config import GrailError, spot_id


def cli_command() -> tuple[str, ...]:
    executable = shutil.which("okx")
    if not executable:
        raise GrailError("ATK_NOT_INSTALLED: install @okx_ai/okx-trade-cli")
    path = Path(executable)
    if path.suffix.lower() in {".cmd", ".ps1", ".bat"}:
        entry = path.parent / "node_modules/@okx_ai/okx-trade-cli/dist/index.js"
        node = shutil.which("node")
        if not entry.is_file() or not node:
            raise GrailError("ATK_NOT_INSTALLED: Node CLI entrypoint missing")
        return node, str(entry)
    return (executable,)


class AtkClient:
    READ_COMMANDS = frozenset({("market", "ticker"), ("market", "candles"), ("market", "instruments"), ("account", "balance"), ("spot", "get")})

    def __init__(self, *, command=None, runner=None, timeout=25):
        self.command = tuple(command) if command is not None else cli_command()
        self.runner = runner or subprocess.run
        self.timeout = timeout
        if not 0 < timeout <= 60:
            raise GrailError("CONFIG: ATK timeout must be in (0,60]")

    def _invoke(self, args):
        env = os.environ.copy()
        for key in ("OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE", "OKX_BASE_URL", "OKX_DEMO", "OKX_PROFILE"):
            env.pop(key, None)
        env["OKX_SITE"] = "tr"
        # ATK otherwise lets environment/TOML base_url override --site.
        env["OKX_API_BASE_URL"] = "https://tr.okx.com"
        env["OKX_UPDATE_CHECK"] = "false"
        argv = [*self.command, "--profile", "grail", "--site", "tr", "--live", "--json", *args]
        try:
            result = self.runner(argv, capture_output=True, text=True, encoding="utf-8", shell=False, timeout=self.timeout, env=env)
        except subprocess.TimeoutExpired:
            raise GrailError("ATK_TIMEOUT: outcome unknown; reconcile by client order ID") from None
        except OSError:
            raise GrailError("ATK_PROCESS: cannot start OKX CLI") from None
        if result.returncode:
            # Never propagate raw stdout/stderr (may contain keys, signatures or balances).
            code = re.search(r"(?:code|sCode)[\s:=]+[\"']?(\d{5})\b", result.stderr or "", re.I)
            suffix = f"_{code[1]}" if code else ""
            raise GrailError(f"ATK_CLI{suffix}: query failed at site tr, profile grail; verify CLI/profile")
        try:
            data = json.loads(result.stdout)
        except (ValueError, TypeError):
            raise GrailError("ATK_JSON: invalid CLI response") from None
        if isinstance(data, dict) and "code" in data:
            code = str(data["code"])
            if code != "0":
                safe_code = code if re.fullmatch(r"\d{1,6}", code) else "UNKNOWN"
                raise GrailError(f"ATK_API_{safe_code}: query rejected at site tr")
            data = data.get("data")
        if not isinstance(data, list):
            raise GrailError("ATK_SHAPE: expected a JSON array")
        return data

    def _read(self, module, action, *args):
        if (module, action) not in self.READ_COMMANDS:
            raise GrailError("ATK_ALLOWLIST: command is not an allowed read query")
        return self._invoke([module, action, *args])

    def ticker(self, inst_id):
        rows = self._read("market", "ticker", spot_id(inst_id))
        if len(rows) != 1 or not isinstance(rows[0], dict) or rows[0].get("instId") != inst_id:
            raise GrailError("ATK_TICKER: missing or mismatched instrument")
        return rows[0]

    def candles(self, inst_id, bar, limit):
        if not isinstance(bar, str) or not re.fullmatch(r"[1-9][0-9]*[mHDW](?:utc)?", bar) or type(limit) is not int or not 1 <= limit <= 300:
            raise GrailError("ATK_CANDLES: invalid bar or limit")
        return self._read("market", "candles", spot_id(inst_id), "--bar", bar, "--limit", str(limit))

    def instruments(self):
        return self._read("market", "instruments", "--instType", "SPOT")

    def balance(self):
        return self._read("account", "balance")

    def order_status(self, inst_id, client_order_id):
        validate_client_id(client_order_id)
        rows = self._read("spot", "get", "--instId", spot_id(inst_id), "--clOrdId", client_order_id)
        if not rows:
            return {"client_order_id": client_order_id, "okx_order_id": None, "order_status": "unknown", "fill_price": None}
        row = rows[0]
        if row.get("instId") != inst_id or row.get("clOrdId") != client_order_id:
            raise GrailError("ATK_ORDER: mismatched order identity")
        status = {"live": "pending", "partially_filled": "partial", "filled": "filled", "canceled": "canceled", "mmp_canceled": "canceled"}.get(row.get("state"), "unknown")
        return {"client_order_id": client_order_id, "okx_order_id": row.get("ordId") or None, "order_status": status, "fill_price": row.get("avgPx") or None}

    def _place_spot(self, order):
        """Internal write boundary. Only OrderService calls this after guards/journal."""
        validate_client_id(order["client_order_id"])
        if order["action"] not in {"BUY", "SELL"} or order["order_type"] not in {"market", "limit"}:
            raise GrailError("SPOT_ONLY: unsupported action or order type")
        args = ["spot", "place", "--instId", spot_id(order["inst_id"]), "--tdMode", "cash", "--side", order["action"].lower(), "--ordType", order["order_type"], "--sz", order["size"], "--tgtCcy", order["tgt_ccy"], "--clOrdId", order["client_order_id"]]
        if order["price"] is not None:
            args.extend(["--px", order["price"]])
        if order["order_type"] == "market" and order["action"] == "BUY":
            args.append("--banAmend")
        rows = self._invoke(args)
        if len(rows) != 1 or str(rows[0].get("sCode")) != "0" or not rows[0].get("ordId"):
            raise GrailError("ATK_SUBMISSION: order not acknowledged; reconcile client order ID")
        return {"client_order_id": order["client_order_id"], "okx_order_id": rows[0]["ordId"], "order_status": "pending", "fill_price": None}


def validate_client_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9]{1,32}", value):
        raise GrailError("ORDER_ID: client order ID must be 1..32 alphanumeric characters")

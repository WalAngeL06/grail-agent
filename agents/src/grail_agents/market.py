"""Normalize ATK data to the market/portfolio fields in contracts/state."""
from decimal import Decimal

from .config import AgentConfig, GrailError, money, number, spot_id


def normalize_ticker(row):
    try:
        inst = spot_id(row["instId"])
        last = number(row["last"], "last", positive=True)
        opening = number(row.get("open24h", "0"), "open24h")
        timestamp = int(row["ts"])
        if timestamp < 0:
            raise ValueError
    except (KeyError, TypeError, ValueError):
        raise GrailError("ATK_TICKER: invalid market data") from None
    return {"inst_id": inst, "last": money(last), "change_24h_pct": float((last / opening - 1) * 100) if opening else None, "at_ms": timestamp}


def normalize_portfolio(balance, prices):
    if not isinstance(balance, list) or len(balance) != 1 or not isinstance(balance[0], dict) or not isinstance(balance[0].get("details"), list):
        raise GrailError("ATK_BALANCE: invalid account response")
    equity, cash = Decimal(0), Decimal(0)
    positions = []
    seen = set()
    for row in balance[0]["details"]:
        if not isinstance(row, dict):
            raise GrailError("ATK_BALANCE: invalid currency row")
        ccy = row.get("ccy")
        if not isinstance(ccy, str) or ccy in seen:
            raise GrailError("ATK_BALANCE: invalid or repeated currency")
        seen.add(ccy)
        total = number(row.get("cashBal"), "cashBal")
        available = number(row.get("availBal"), "availBal")
        if available > total:
            raise GrailError("ATK_BALANCE: available balance exceeds total")
        if ccy == "USDT":
            equity += total
            cash = available
        elif total:
            inst = f"{ccy}-USDT"
            if inst not in prices:
                raise GrailError(f"ATK_VALUATION: missing USDT price for {inst}")
            value = total * number(prices[inst], "valuation", positive=True)
            equity += value
            positions.append({"inst_id": inst, "size_base": money(total), "available_base": money(available), "value_usdt": money(value)})
            if ccy == "TRY":
                positions[-1].update({"tradable": False, "valuation_pair": "USDT-TRY"})
    for position in positions:
        position["weight_pct"] = float(number(position["value_usdt"], "value") / equity * 100) if equity else 0.0
    return {"equity_usdt": money(equity), "cash_usdt": money(cash), "positions": sorted(positions, key=lambda p: p["inst_id"])}


def validate_instruments(rows, coins):
    if not isinstance(rows, list):
        raise GrailError("ATK_INSTRUMENT: expected list")
    available = {row.get("instId"): row for row in rows if isinstance(row, dict)}
    rules = {}
    for inst in coins:
        row = available.get(inst)
        if not row or row.get("instType") != "SPOT" or row.get("state") != "live" or row.get("quoteCcy") != "USDT" or row.get("baseCcy") != inst.split("-")[0]:
            raise GrailError(f"ATK_INSTRUMENT: {inst} is not an active OKX TR USDT spot instrument (field: coins)")
        for field in ("minSz", "lotSz", "tickSz"):
            number(row.get(field), field, positive=True)
        rules[inst] = dict(row)
    return rules


def confirmed_candles(rows, count):
    try:
        valid = []
        seen = set()
        for row in rows:
            if not isinstance(row, list) or len(row) < 9 or str(row[8]) not in {"0", "1"}:
                raise ValueError
            if str(row[8]) == "0":
                continue
            ts = int(row[0])
            if ts < 0 or ts in seen:
                raise ValueError
            seen.add(ts)
            for index in (1, 2, 3, 4):
                number(row[index], "OHLC", positive=True)
            for index in (5, 6, 7):
                number(row[index], "volume")
            valid.append(row)
        valid.sort(key=lambda r: int(r[0]))
        if len(valid) < count:
            raise ValueError
        return valid[-count:]
    except (TypeError, ValueError):
        raise GrailError("ATK_CANDLES: invalid or insufficient confirmed bars") from None


def fetch_snapshot(client, cfg: AgentConfig):
    rules = validate_instruments(client.instruments(), cfg.coins)
    market = [normalize_ticker(client.ticker(inst)) for inst in cfg.coins]
    prices = {row["inst_id"]: row["last"] for row in market}
    portfolio = fetch_portfolio(client, prices)
    candles = {inst: confirmed_candles(client.candles(inst, cfg.candle_bar, cfg.lookback_bars + 2), cfg.lookback_bars + 1) for inst in cfg.coins}
    return {"market": market, "portfolio": portfolio, "candles": candles, "instruments": rules}


def fetch_portfolio(client, prices):
    balance = client.balance()
    if isinstance(balance, list) and len(balance) == 1 and isinstance(balance[0], dict):
        for row in balance[0].get("details", []):
            if isinstance(row, dict) and row.get("ccy") == "TRY" and number(row.get("cashBal"), "TRY cashBal"):
                prices = {**prices, "TRY-USDT": client.try_usdt_rate()}
                break
    return normalize_portfolio(balance, prices)

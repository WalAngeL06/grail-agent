import type { GrailState } from "../state";
import HolyGrail, { nEff } from "../components/HolyGrail";
import { Empty, Section } from "../components/Bits";
import { coin, dateTime, n, pct, price, signedPct, usdt } from "../format";

export default function Dashboard({ s }: { s: GrailState }) {
  const m = s.metrics;
  const N = m.n_assets ?? (s.config.coins as unknown[] | undefined)?.length;
  const ne = m.n_eff ?? (N && m.avg_corr !== undefined ? nEff(N, m.avg_corr) : undefined);

  return (
    <>
      <div className="hero">
        <div className="equation">
          {N !== undefined && ne !== undefined ? (
            <div className="pair" aria-label={`${N} coin, ${n(ne, 2)} efektif bağımsız bahis`}>
              <div className="figure from">
                <span className="big num">{N}</span>
                <span className="lbl">coin izleniyor</span>
              </div>
              <div className="rule" />
              <div className="figure to">
                <span className="big num">{n(ne, 2)}</span>
                <span className="lbl">gerçekte bu kadar bağımsız bahis</span>
              </div>
            </div>
          ) : (
            <Empty title="Efektif bahis sayısı henüz hesaplanmadı">Engine ilk döngüde korelasyonu yazınca burada görünür.</Empty>
          )}
          <p className="lede">
            {m.avg_corr !== undefined ? (
              <>
                Coinler arası ortalama korelasyon <b>{n(m.avg_corr, 2)}</b>. Bu yüzden {N ?? "bu"} coin, risk açısından{" "}
                <b>{n(ne, 2)}</b> ayrı bahis gibi davranıyor. Agent ağırlıkları buna göre (HRP + volatilite hedefi) dağıtır.
              </>
            ) : (
              <>Çeşitlendirmenin gerçek değeri korelasyona bağlı; korelasyon gelince burada özetlenir.</>
            )}
          </p>
          <dl className="kv">
            <div>
              <dt>Portföy SR tahmini</dt>
              <dd className="num">{n(m.sr_portfolio_est, 2)}</dd>
            </div>
            <div>
              <dt>Tek coin SR varsayımı</dt>
              <dd className="num">{n(m.sr_single_assumed, 2)}</dd>
            </div>
            <div>
              <dt>PSR</dt>
              <dd className="num" title="Probabilistic Sharpe Ratio">
                {m.psr !== undefined ? pct(m.psr * 100, 0) : "—"}
              </dd>
            </div>
          </dl>
        </div>
        <HolyGrail nAssets={N} rho={m.avg_corr} nEffNow={ne} srSingle={m.sr_single_assumed} />
      </div>

      <div className="grid-2">
        <Portfolio s={s} />
        <Regime s={s} />
      </div>

      <div className="grid-2">
        <Correlation s={s} />
        <Market s={s} />
      </div>

      <Errors s={s} />
    </>
  );
}

function Portfolio({ s }: { s: GrailState }) {
  const p = s.portfolio;
  const eq = Number(p.equity_usdt);
  const cash = Number(p.cash_usdt);
  const tw = s.metrics.target_weights_pct;
  const positions = p.positions.filter((x) => x.inst_id);
  return (
    <Section title="Portföy" meta={s.dry_run ? "simülasyon bakiyesi" : "OKX TR spot hesabı"}>
      <dl className="kv" style={{ marginBottom: 14 }}>
        <div>
          <dt>Toplam değer</dt>
          <dd className="num">{usdt(p.equity_usdt)}</dd>
        </div>
        <div>
          <dt>Nakit</dt>
          <dd className="num">{usdt(p.cash_usdt)}</dd>
        </div>
        <div>
          <dt>Pozisyonda</dt>
          <dd className="num">{Number.isFinite(eq) && Number.isFinite(cash) ? usdt(eq - cash) : "—"}</dd>
        </div>
      </dl>
      {Number.isFinite(eq) && eq > 0 && (
        <div className="alloc" role="img" aria-label="Portföy dağılımı">
          {positions.map((x) => {
            const w = x.weight_pct ?? (Number(x.value_usdt) / eq) * 100;
            return Number.isFinite(w) && w > 0 ? (
              <span key={x.inst_id} title={`${coin(x.inst_id)} ${pct(w)}`} style={{ width: `${w}%`, background: "var(--gold-chart)" }} />
            ) : null;
          })}
          {Number.isFinite(cash) && <span title={`Nakit ${pct((cash / eq) * 100)}`} style={{ flex: 1, background: "var(--surface-3)" }} />}
        </div>
      )}
      {positions.length === 0 ? (
        <Empty title="Açık pozisyon yok">Agent şu an tamamen nakitte. Trend filtresi pozitif coin bulunca alım yapar.</Empty>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Coin</th>
                <th className="r">Miktar</th>
                <th className="r">Değer</th>
                <th>Ağırlık / hedef</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((x) => {
                const target = x.inst_id ? tw[x.inst_id] : undefined;
                return (
                  <tr key={x.inst_id}>
                    <td>
                      <b>{coin(x.inst_id)}</b>
                    </td>
                    <td className="r num">{x.size_base ?? "—"}</td>
                    <td className="r num">{usdt(x.value_usdt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div className="bar" style={{ flex: 1 }} title={`ağırlık ${pct(x.weight_pct)}${target !== undefined ? `, hedef ${pct(target)}` : ""}`}>
                          <span style={{ width: `${Math.min(100, (x.weight_pct ?? 0) * 2.5)}%` }} />
                          {target !== undefined && <em style={{ left: `${Math.min(100, target * 2.5)}%` }} />}
                        </div>
                        <span className="num" style={{ minWidth: 92, textAlign: "right" }}>
                          {pct(x.weight_pct)}
                          {target !== undefined && <span className="faint"> / {pct(target)}</span>}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="faint" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
            Çubuk ölçeği %40'a kadar; dikey işaret engine'in hedef ağırlığı.
          </p>
        </div>
      )}
    </Section>
  );
}

function Regime({ s }: { s: GrailState }) {
  const m = s.metrics;
  const coins = Object.keys(m.trend_pct).length
    ? Object.keys(m.trend_pct)
    : ((s.config.coins as string[] | undefined) ?? []).filter((c) => typeof c === "string");
  const ups = coins.filter((c) => (m.trend_pct[c] ?? 0) > 0).length;
  const known = Object.keys(m.trend_pct).length > 0;
  const regime = !known
    ? { label: "Rejim bilgisi yok", text: "Engine trend verisini yazınca coin başına sinyal burada görünür." }
    : ups === 0
      ? { label: "Savunmada", text: "Hiçbir coinin trendi pozitif değil; agent nakitte bekliyor." }
      : ups === coins.length
        ? { label: "Trend pozitif", text: "Bütün coinlerde trend pozitif; ağırlıklar risk bütçesiyle sınırlı." }
        : { label: "Seçici", text: `${ups} / ${coins.length} coinde trend pozitif; diğerleri nakde çekildi.` };
  const tv = s.config.target_vol_pct as number | undefined;
  const ks = s.config.kill_switch_drawdown_pct as number | undefined;

  return (
    <Section title="Piyasa rejimi" meta={m.window_bars ? `${m.window_bars} bar pencere` : undefined}>
      <p style={{ margin: "0 0 12px" }}>
        <b>{regime.label}.</b> <span className="muted">{regime.text}</span>
      </p>
      <dl className="kv" style={{ marginBottom: 14 }}>
        <div>
          <dt>Portföy volatilitesi</dt>
          <dd className="num">
            {pct(m.portfolio_vol_pct)}
            {typeof tv === "number" && <span className="faint" style={{ fontSize: 13 }}> / hedef {pct(tv, 0)}</span>}
          </dd>
        </div>
        <div>
          <dt>Düşüş (drawdown)</dt>
          <dd className="num">
            {pct(m.drawdown_pct)}
            {typeof ks === "number" && <span className="faint" style={{ fontSize: 13 }}> / sınır {pct(ks, 0)}</span>}
          </dd>
        </div>
        <div>
          <dt>Kill switch</dt>
          <dd style={{ color: m.kill_switch ? "var(--bad)" : m.kill_switch === false ? "var(--ok)" : undefined }}>
            {m.kill_switch ? "Tetiklendi" : m.kill_switch === false ? "Hazır, tetiklenmedi" : "—"}
          </dd>
        </div>
      </dl>
      {coins.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Coin</th>
                <th className="r">Trend</th>
                <th className="r">Yıllık vol</th>
                <th className="r">HRP</th>
                <th className="r">Hedef</th>
              </tr>
            </thead>
            <tbody>
              {coins.map((c) => {
                const t = m.trend_pct[c];
                return (
                  <tr key={c}>
                    <td>
                      <b>{coin(c)}</b>
                    </td>
                    <td className={`r num ${t === undefined ? "" : t > 0 ? "trend-up" : "trend-down"}`}>
                      {t === undefined ? "—" : `${t > 0 ? "▲" : "▼"} ${signedPct(t, 2)}`}
                    </td>
                    <td className="r num">{pct(m.vol_pct[c])}</td>
                    <td className="r num">{pct(m.hrp_weights_pct[c])}</td>
                    <td className="r num">{pct(m.target_weights_pct[c])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Correlation({ s }: { s: GrailState }) {
  const c = s.metrics.corr;
  if (!c)
    return (
      <Section title="Korelasyon matrisi">
        <Empty title="Korelasyon matrisi yok">Engine en az iki coin için getiri hesaplayınca görünür.</Empty>
      </Section>
    );
  const k = c.labels.length;
  const color = (v: number | null) => {
    if (v === null) return "var(--surface-2)";
    const a = Math.min(1, Math.abs(v));
    return v >= 0 ? `rgba(187, 138, 46, ${0.12 + a * 0.68})` : `rgba(91, 143, 224, ${0.12 + a * 0.68})`;
  };
  return (
    <Section title="Korelasyon matrisi" meta="getiri korelasyonu, pencere içinde">
      <div className="heat" style={{ gridTemplateColumns: `56px repeat(${k}, minmax(0, 1fr))` }} role="table" aria-label="Korelasyon matrisi">
        <span />
        {c.labels.map((l) => (
          <span key={l} className="lab top" role="columnheader">
            {coin(l)}
          </span>
        ))}
        {c.labels.map((row, i) => (
          <div key={row} style={{ display: "contents" }} role="row">
            <span className="lab" role="rowheader">
              {coin(row)}
            </span>
            {c.labels.map((col, j) => {
              const v = c.values[i]?.[j] ?? null;
              return (
                <span key={col} className="cell" role="cell" style={{ background: color(v) }} title={`${coin(row)} × ${coin(col)}: ${v === null ? "—" : n(v, 2)}`}>
                  {v === null ? "—" : n(v, 2)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="faint" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
        Koyu altın = birlikte hareket (çeşitlendirme yok). Mavi = ters yönlü.
      </p>
    </Section>
  );
}

function Market({ s }: { s: GrailState }) {
  const rows = s.market.filter((x) => x.inst_id);
  return (
    <Section title="Piyasa (OKX TR)" meta={rows[0]?.at_ms ? `ticker ${dateTime(rows[0].at_ms)}` : undefined}>
      {rows.length === 0 ? (
        <Empty title="Ticker verisi yok">Agent OKX ATK'dan fiyat çekince burada listelenir.</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Parite</th>
              <th className="r">Son fiyat</th>
              <th className="r">24 sa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.inst_id}>
                <td>
                  <b>{coin(r.inst_id)}</b> <span className="faint">/ USDT</span>
                </td>
                <td className="r num">{price(r.last)}</td>
                <td className={`r num ${r.change_24h_pct === undefined ? "" : r.change_24h_pct >= 0 ? "trend-up" : "trend-down"}`}>
                  {signedPct(r.change_24h_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function Errors({ s }: { s: GrailState }) {
  return (
    <Section title="Hata günlüğü" meta="hata olursa döngü atlanır, agent durmaz">
      {s.errors.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Kayıtlı hata yok.
        </p>
      ) : (
        <div className="errlist">
          <ul>
            {s.errors.slice(0, 12).map((e, i) => (
              <li key={i}>
                <span className="mono code">{e.code ?? "HATA"}</span>
                <span>
                  {e.message ?? "—"} {e.where && <span className="faint">({e.where})</span>}
                </span>
                <span className="faint num">{dateTime(e.at_ms)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

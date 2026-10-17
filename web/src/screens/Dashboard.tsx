import { groupCycles, type Cycle, type GrailState } from "../state";
import type { ScreenProps } from "../App";
import HolyGrail, { nEff } from "../components/HolyGrail";
import type { ReactNode } from "react";
import { Card, Empty, PageHead, Term } from "../components/Bits";
import { ago, coin, countdown, n, pct, price, psrText, signedPct, usd, windowLabel } from "../format";
import { P, T, isTr } from "../i18n";

export default function Dashboard({ s, now }: ScreenProps) {
  const m = s.metrics;
  const N = m.n_assets ?? (Array.isArray(s.config.coins) ? (s.config.coins as unknown[]).length : undefined);
  const ne = m.n_eff ?? (N && m.avg_corr !== undefined ? nEff(N, m.avg_corr) : undefined);
  const cycles = groupCycles(s);
  const last = cycles.find((c) => c.cycle_id === s.agent.cycle_id) ?? cycles[0];
  const win = windowLabel(s.config, m.window_bars);

  return (
    <div className="stack">
      <div className="motto-line">
        GRAIL — <b>Proof before profit.</b>
        {isTr() && <span> Önce kanıt, sonra kâr.</span>}
      </div>
      <PageHead
        eyebrow={T("Dashboard", "Panel")}
        title={T("How many independent bets GRAIL's coin list really offers, and what the agent is doing right now.", "GRAIL'in coin listesi gerçekte kaç bağımsız bahis sunuyor ve agent şu an ne yapıyor.")}
        summary={liveSummary(s, last, ne, now)}
      />

      <FlowStrip c={last} s={s} now={now} />

      <div className="hero-row">
        <Card className="hero">
          <Term plain={T("Independent bets", "Bağımsız bahis")} tech={T("effective N (n_eff) · equal-weight list", "n_eff · eşit ağırlıklı liste")} tip={T("How many truly separate bets the coins on GRAIL's list add up to, once you account for how much they move together. It describes the list, not what GRAIL holds right now.", "Coinlerin birlikte ne kadar hareket ettiği hesaba katıldığında, GRAIL'in listesindeki coinlerin kaç gerçekten ayrı bahis ettiği. Listeyi anlatır, GRAIL'in şu an tuttuğu varlıkları değil.")} />
          {ne !== undefined ? (
            <div>
              <div className="num" aria-label={`${n(ne, 2)} ${T("independent bets", "bağımsız bahis")}`}>
                {n(ne, 1, 1)}
              </div>
              <div className="cap">
                {T(`${N ?? "?"} coins on the list, but they move like ${n(ne, 1, 1)}`, `Listede ${N ?? "?"} coin var, ama ${n(ne, 1, 1)} coin gibi hareket ediyorlar`)}{" "}
                <span className="muted">({win}, {T("equal weights", "eşit ağırlık")})</span>
              </div>
            </div>
          ) : (
            <Empty title={T("Not measured yet", "Henüz ölçülmedi")}>{T("GRAIL needs a few hours of prices to see how the coins move together.", "GRAIL'in coinlerin birlikte nasıl hareket ettiğini görmesi için birkaç saatlik fiyat gerekiyor.")}</Empty>
          )}
          <div className="hero-sub">
            <Term plain={T("Togetherness", "Birliktelik")} tech={T("average correlation ρ̄", "ortalama korelasyon ρ̄")} tip={T("How much the coins rise and fall together, from 0 (independently) to 1 (in lockstep).", "Coinlerin ne kadar birlikte yükselip düştüğü: 0 (bağımsız) ile 1 (tamamen birlikte) arası.")} />
            <span className="v">{n(m.avg_corr, 2, 2)}</span>
          </div>
          <div className="hero-sub">
            <Term
              plain={T("Chance the coin basket's recent trend is real", "Coin sepetinin son trendinin gerçek olma ihtimali")}
              tech={T(`PSR(SR>0) · risk-balanced basket of all coins · ${win}, in-sample`, `PSR(SR>0) · tüm coinlerin risk dengeli sepeti · ${win}, in-sample`)}
              tip={T(`Probability that the basket's true Sharpe over the ${win} is above zero. It is not GRAIL's own track record.`, `Sepetin ${win} içindeki gerçek Sharpe değerinin sıfırın üstünde olma olasılığı. GRAIL'in kendi geçmiş performansı değildir.`)}
            />
            <span className="v">{m.psr !== undefined ? psrText(m.psr) : <span className="muted" style={{ fontSize: 13 }}>{T("— (needs more history)", "— (daha fazla geçmiş gerekli)")}</span>}</span>
          </div>
          <details className="math">
            <summary>{T("Show the math", "Hesabı göster")}</summary>
            <p className="mono small">
              n_eff = N / (1 + (N−1)·ρ̄){N !== undefined && m.avg_corr !== undefined ? ` = ${N} / ${n(1 + (N - 1) * m.avg_corr, 4, 4)} = ${n(ne, 2, 2)}` : ""}
            </p>
            <p className="mono small">Sharpe_portfolio = SR₁ · √n_eff, {T("with", "burada")} SR₁ = {n(m.sr_single_assumed, 2, 2)} {T("assumed (illustration, not measured)", "varsayım (örnek, ölçülmedi)")}</p>
          </details>
        </Card>

        <Card title={T("More coins, fewer real bets", "Daha çok coin, daha az gerçek bahis")} meta={T(`return per unit of risk vs number of coins · togetherness from the ${win}`, `risk başına getiri ve coin sayısı · birliktelik: ${win}`)}>
          <HolyGrail nAssets={N} rho={m.avg_corr} srSingle={m.sr_single_assumed} srNow={m.sr_portfolio_est} nEffNow={ne} curve={m.holy_grail_curve} />
        </Card>
      </div>

      <div className="cols four">
        <Stat label={<Term plain={T("Account value", "Hesap değeri")} tech="equity" />} value={usd(s.portfolio.equity_usdt)} sub={s.dry_run ? T("practice balance", "deneme bakiyesi") : T("OKX TR spot account", "OKX TR spot hesabı")} />
        <Stat label={<Term plain={T("Cash", "Nakit")} tech="USDT" />} value={usd(s.portfolio.cash_usdt)} sub={cashShare(s)} />
        <Stat
          label={
            <Term
              plain={T("Diversification boost (illustration)", "Çeşitlendirme etkisi (örnek)")}
              tech={T("√n_eff · Sharpe est. = SR₁ · √n_eff, SR₁ assumed", "√n_eff · Sharpe tahmini = SR₁ · √n_eff, SR₁ varsayım")}
              tip={T("How much spreading across independent bets would raise return per unit of risk. Illustration only: nothing is measured here.", "Bağımsız bahislere yaymanın risk başına getiriyi ne kadar artıracağı. Sadece örnek: burada hiçbir şey ölçülmüyor.")}
            />
          }
          value={ne !== undefined ? `×${n(Math.sqrt(ne), 2, 2)}` : "—"}
          sub={
            m.sr_single_assumed !== undefined && m.sr_portfolio_est !== undefined
              ? T(`if each coin alone scored ${n(m.sr_single_assumed, 2, 2)} (assumed, not measured) → ${n(m.sr_portfolio_est, 2, 2)}`, `her coin tek başına ${n(m.sr_single_assumed, 2, 2)} alsaydı (varsayım, ölçülmedi) → ${n(m.sr_portfolio_est, 2, 2)}`)
              : undefined
          }
        />
        <Stat
          label={<Term plain={T("Expected price swings", "Beklenen fiyat oynaklığı")} tech={T("target-mix volatility, yearly (est.)", "hedef karışım volatility, yıllık (tahmin)")} tip={T(`Estimated yearly swing of the target mix, from the ${win} of prices.`, `Hedef karışımın tahmini yıllık dalgalanması (${win} fiyatlarından).`)} />}
          value={pct(m.portfolio_vol_pct)}
          sub={typeof s.config.target_vol_pct === "number" ? T(`capped near ${pct(s.config.target_vol_pct as number, 0)}`, `üst sınır yaklaşık ${pct(s.config.target_vol_pct as number, 0)}`) : undefined}
        />
      </div>

      <div className="cols wide">
        <Positions s={s} />
        <Correlation s={s} />
      </div>

      <Signals s={s} />
    </div>
  );
}

// docs/ui-copy.md (c) Dashboard live summary
function liveSummary(s: GrailState, c: Cycle | undefined, ne: number | undefined, now: number) {
  const next = countdown(s.agent.next_cycle_at_ms, now);
  const nextTxt = next ? T(` Next in ${next}.`, ` Sonraki: ${next}.`) : "";
  if (!c) return T(`Waiting for the first check-in${next ? ` — next in ${next}` : ""}.`, `İlk check-in bekleniyor${next ? ` — sonraki: ${next}` : ""}.`);
  const held = s.portfolio.positions.filter((p) => p.inst_id).length;
  if (held === 0 && c.trades === 0)
    return T(
      `All in cash — every coin's trend is down, so the agent is waiting.${next ? ` Next check-in in ${next}.` : ""}`,
      `Tamamen nakitte — her coinin trendi aşağı, agent bekliyor.${next ? ` Sonraki check-in: ${next}.` : ""}`,
    );
  const k = (a: string) => c.decisions.filter((d) => d.action === a).length;
  const head = s.metrics.n_assets !== undefined && ne !== undefined ? T(`${s.metrics.n_assets} coins, ${n(ne, 1, 1)} independent bets. `, `${s.metrics.n_assets} coin, ${n(ne, 1, 1)} bağımsız bahis. `) : "";
  return T(
    `${head}Last check-in #${c.id}: ${k("BUY")} buy · ${k("SELL")} sell · ${k("HOLD")} hold.${nextTxt}`,
    `${head}Son check-in #${c.id}: ${k("BUY")} BUY · ${k("SELL")} SELL · ${k("HOLD")} HOLD.${nextTxt}`,
  );
}

/** R-007-3: the agent's real target (after limits), converted from the trading budget to a share of the whole account. */
export function targetOfAccount(s: GrailState, inst: string | undefined): number | undefined {
  if (!inst) return undefined;
  const latest = groupCycles(s).find((c) => c.decisions.some((d) => d.inst_id === inst && d.target_weight_pct !== undefined));
  const tw = s.metrics.target_weights_pct[inst] ?? latest?.decisions.find((d) => d.inst_id === inst)?.target_weight_pct;
  const eq = Number(s.portfolio.equity_usdt);
  if (tw === undefined || !(eq > 0)) return tw;
  const cap = Number(s.config.max_total_deploy_usdt);
  const base = Number.isFinite(cap) && cap > 0 ? Math.min(eq, cap) : eq;
  return (tw * base) / eq;
}

/** 1 Market → 2 Decision → 3 Sealed → 4 Order → 5 Revealed, for the latest cycle; each step links to its screen. */
function FlowStrip({ c, s, now }: { c?: Cycle; s: GrailState; now: number }) {
  const next = countdown(s.agent.next_cycle_at_ms, now);
  const mk = s.market.find((x) => x.at_ms)?.at_ms;
  const steps: { n: number; title: string; sub: string; href: string; state: "done" | "pending" | "skip" | "fail" }[] = [
    { n: 1, title: T("Market", "Piyasa"), sub: s.market.length ? `${s.market.length} ${P(s.market.length, "price", "prices", "fiyat")} ${T("from OKX", "OKX'ten")}${mk ? ` · ${ago(mk, now)}` : ""}` : T("waiting for prices", "fiyatlar bekleniyor"), href: "#/dashboard/positions", state: s.market.length ? "done" : "pending" },
    { n: 2, title: T("Decision", "Karar"), sub: c ? `${c.trades} ${P(c.trades, "trade", "trades", "işlem")}, ${c.decisions.length - c.trades} ${P(c.decisions.length - c.trades, "hold", "holds", "HOLD")}` : T("next check-in soon", "sonraki check-in birazdan"), href: "#/decisions", state: c ? "done" : "pending" },
    { n: 3, title: T("Sealed", "Mühür"), sub: !c ? "—" : c.commit_tx ? T("fingerprint on Avalanche", "parmak izi Avalanche'ta") : T("couldn't seal → no order", "mühürlenemedi → emir yok"), href: "#/ledger", state: !c ? "pending" : c.commit_tx ? "done" : "fail" },
    {
      n: 4,
      title: T("Order", "Emir"),
      sub: !c || !c.commit_tx ? "—" : c.trades === 0 ? T("nothing to trade", "işlem yok") : c.dry_run ? T("simulated on OKX", "OKX'te simüle") : T("sent to OKX", "OKX'e gönderildi"),
      href: "#/decisions",
      state: !c || !c.commit_tx ? "pending" : c.trades === 0 ? "skip" : "done",
    },
    { n: 5, title: T("Opened", "Açılış"), sub: !c ? "—" : c.reveal_tx ? T("opened — anyone can check", "açıldı — herkes kontrol edebilir") : T("still sealed", "hâlâ mühürlü"), href: "#/ledger", state: !c ? "pending" : c.reveal_tx ? "done" : "pending" },
  ];
  return (
    <nav className="flow" aria-label={`${T("Latest check-in", "Son check-in")}${c ? ` #${c.id}` : ""}`}>
      <div className="flow-head">
        <span>{T("Latest check-in", "Son check-in")} {c ? <b>#{c.id}</b> : null}</span>
        <span className="muted">{next ? T(`next check-in in ${next}`, `sonraki check-in: ${next}`) : ""}</span>
      </div>
      <ol>
        {steps.map((st) => (
          <li key={st.n} className={st.state}>
            <a href={st.href}>
              <span className="flow-n">{st.state === "done" ? "✓" : st.state === "fail" ? "✕" : st.n}</span>
              <span className="flow-t">
                {st.n} · {st.title}
              </span>
              <span className="flow-s">{st.sub}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Stat({ label, value, sub }: { label: ReactNode; value: string; sub?: string }) {
  return (
    <div className="card stat">
      {label}
      <div className="v">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function cashShare(s: GrailState) {
  const eq = Number(s.portfolio.equity_usdt);
  const cash = Number(s.portfolio.cash_usdt);
  return Number.isFinite(eq) && eq > 0 && Number.isFinite(cash) ? T(`${pct((cash / eq) * 100, 0)} of the account`, `hesabın ${pct((cash / eq) * 100, 0)} kadarı`) : undefined;
}

function Positions({ s }: { s: GrailState }) {
  const rows = s.portfolio.positions.filter((p) => p.inst_id);
  const mk = new Map(s.market.map((r) => [r.inst_id, r]));
  const targets = new Map(rows.map((p) => [p.inst_id, targetOfAccount(s, p.inst_id)]));
  const scale = Math.max(35, ...rows.map((r) => r.weight_pct ?? 0), ...[...targets.values()].map((v) => v ?? 0));
  return (
    <Card
      id="positions"
      title={T("What GRAIL holds", "GRAIL'in elindekiler")}
      meta={
        <span className="legend">
          <i style={{ background: "var(--text)" }} /> {T("now", "şimdi")} <i style={{ background: "var(--dim)" }} />{" "}
          <Term
            plain={T("agent's target (after limits)", "agent'ın hedefi (limitlerden sonra)")}
            tech={T("target_weight_pct × trading budget ÷ account", "target_weight_pct × işlem bütçesi ÷ hesap")}
            tip={T("The share the agent is steering toward after its risk and spending limits, shown as a share of the whole account so it compares with 'now'.", "Agent'ın risk ve harcama limitlerinden sonra yöneldiği pay; 'şimdi' ile karşılaştırılabilsin diye tüm hesabın payı olarak gösterilir.")}
          />
        </span>
      }
    >
      {rows.length === 0 ? (
        <Empty title={T("All in cash — the trend filter is staying out of the market", "Tamamen nakitte — trend filtresi piyasanın dışında kalıyor")}>
          {usd(s.portfolio.cash_usdt)} {T("available. GRAIL only buys coins whose recent trend is up.", "kullanılabilir. GRAIL sadece son trendi yukarı olan coinleri alır.")}
        </Empty>
      ) : (
        <div className="scroll-x">
          <table className="table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Coin</th>
                <th className="r">{T("Amount", "Miktar")}</th>
                <th className="r">{T("Value", "Değer")}</th>
                <th>{T("Share of account: now / target", "Hesaptaki pay: şimdi / hedef")}</th>
                <th className="r">{T("Price", "Fiyat")}</th>
                <th className="r">24h</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const t = targets.get(p.inst_id);
                const q = mk.get(p.inst_id);
                return (
                  <tr key={p.inst_id}>
                    <td style={{ fontWeight: 600 }}>{coin(p.inst_id)}</td>
                    <td className="r mono muted">{p.size_base ?? "—"}</td>
                    <td className="r">{usd(p.value_usdt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div className="dbar" style={{ flex: 1 }}>
                          <span className="w" style={{ width: `${((p.weight_pct ?? 0) / scale) * 100}%` }} />
                          <span className="t" style={{ width: `${((t ?? 0) / scale) * 100}%` }} />
                        </div>
                        <span style={{ minWidth: 92, textAlign: "right", fontSize: 12 }}>
                          {pct(p.weight_pct)} <span className="muted">/ {pct(t)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="r mono">{price(q?.last)}</td>
                    <td className={`r ${q?.change_24h_pct === undefined ? "" : q.change_24h_pct >= 0 ? "up" : "down"}`}>{signedPct(q?.change_24h_pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Correlation({ s }: { s: GrailState }) {
  const c = s.metrics.corr;
  const title = <Term plain={T("Which coins move together", "Hangi coinler birlikte hareket ediyor")} tech={T("pairwise correlation", "ikili korelasyon")} tip={T("Gold = the two coins usually rise and fall together. Dark = they move independently. Blue = opposite.", "Altın = iki coin genelde birlikte yükselip düşer. Koyu = bağımsız hareket ederler. Mavi = ters yönde.")} />;
  if (!c)
    return (
      <Card title={title}>
        <Empty title={T("Not measured yet", "Henüz ölçülmedi")}>{T("Appears once GRAIL has a few hours of prices for two or more coins.", "GRAIL iki veya daha fazla coin için birkaç saatlik fiyata sahip olunca görünür.")}</Empty>
      </Card>
    );
  const k = c.labels.length;
  const color = (v: number | null) => {
    if (v === null) return "var(--surface-2)";
    const a = Math.min(1, Math.abs(v));
    const [r0, g0, b0] = [26, 33, 48];
    const [r1, g1, b1] = v >= 0 ? [232, 176, 75] : [59, 130, 246];
    return `rgb(${Math.round(r0 + (r1 - r0) * a)}, ${Math.round(g0 + (g1 - g0) * a)}, ${Math.round(b0 + (b1 - b0) * a)})`;
  };
  return (
    <Card title={title}>
      <div className="heat" style={{ gridTemplateColumns: `44px repeat(${k}, minmax(0, 1fr))` }} role="table" aria-label="Correlation matrix">
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
              const diag = i === j;
              return (
                <span
                  key={col}
                  role="cell"
                  className={`cell ${diag ? "diag" : ""}`}
                  style={diag ? undefined : { background: color(v), color: v !== null && Math.abs(v) > 0.55 ? "#0b0e14" : undefined }}
                  title={`${coin(row)} × ${coin(col)}: ${v === null ? "—" : n(v, 2, 2)}`}
                >
                  {v === null ? "—" : n(v, 2, 2)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="heat-legend">
        <span className="mono">−1</span>
        <i aria-hidden="true" />
        <span className="mono">+1</span>
        <span className="muted">{T("average", "ortalama")} {n(s.metrics.avg_corr, 2, 2)}</span>
      </div>
    </Card>
  );
}

function Signals({ s }: { s: GrailState }) {
  const m = s.metrics;
  const coins = Object.keys(m.trend_pct);
  if (!coins.length) return null;
  const ups = coins.filter((c) => m.trend_pct[c] > 0).length;
  const regime =
    ups === 0
      ? T("No coin is trending up: GRAIL stays in cash.", "Yukarı trendde coin yok: GRAIL nakitte kalıyor.")
      : ups === coins.length
        ? T("Every coin is trending up.", "Her coin yukarı trendde.")
        : T(`${ups} of ${coins.length} coins trending up; the rest stay in cash.`, `${coins.length} coinden ${ups} tanesi yukarı trendde; geri kalanı nakitte.`);
  return (
    <Card title={T("Trend by coin", "Coin bazında trend")} meta={regime}>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Coin</th>
              <th className="r">
                <Term plain={T("Recent trend", "Son trend")} tech={`momentum, ${windowLabel(s.config, m.window_bars)}`} />
              </th>
              <th className="r">
                <Term plain={T("Price swings", "Fiyat oynaklığı")} tech={T("volatility, yearly", "volatility, yıllık")} />
              </th>
              <th className="r">
                <Term
                  plain={T("Family-based share", "Aile bazlı pay")}
                  tech={T("HRP weight, before limits", "HRP ağırlığı, limitlerden önce")}
                  tip={T("Risk-balanced share among the coins that are trending up; coins trending down get 0. Limits are applied after this.", "Yukarı trenddeki coinler arasında risk dengeli pay; aşağı trenddekiler 0 alır. Limitler bundan sonra uygulanır.")}
                />
              </th>
              <th className="r">
                <Term plain={T("Target share of account", "Hesapta hedef pay")} tech={T("target_weight_pct, after limits", "target_weight_pct, limitlerden sonra")} />
              </th>
            </tr>
          </thead>
          <tbody>
            {coins.map((c) => {
              const t = m.trend_pct[c];
              return (
                <tr key={c}>
                  <td style={{ fontWeight: 600 }}>{coin(c)}</td>
                  <td className={`r ${t > 0 ? "up" : "down"}`}>
                    {t > 0 ? "▲" : "▼"} {signedPct(t, 2)}
                  </td>
                  <td className="r">{pct(m.vol_pct[c])}</td>
                  <td className="r">{pct(m.hrp_weights_pct[c])}</td>
                  <td className="r">{pct(targetOfAccount(s, c))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


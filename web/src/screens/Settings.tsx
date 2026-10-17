import type { ScreenProps } from "../App";
import { Card, PageHead, Term } from "../components/Bits";
import { coin, dayClock, pct, usd } from "../format";
import { T } from "../i18n";

// Read-only (ui-brief §1.4): the UI never writes config and never places orders.
type Known = { label: string; fmt: (v: unknown) => string; hint?: string };
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const asPct = (v: unknown) => (Number.isFinite(num(v)) ? pct(num(v), 2) : String(v));
const asUsd = (v: unknown) => (Number.isFinite(num(v)) ? usd(String(v)) : String(v));

const KNOWN_ = (): Record<string, Known> => ({
  max_order_usdt: { label: T("Most per trade", "İşlem başına en fazla"), fmt: asUsd, hint: T("No single order can be bigger than this.", "Hiçbir emir bundan büyük olamaz.") },
  max_total_deploy_usdt: { label: T("Most in total", "Toplamda en fazla"), fmt: asUsd, hint: T("The agent can never put more than this to work.", "Agent asla bundan fazlasını işe koyamaz.") },
  kill_switch_drawdown_pct: {
    label: T("Emergency stop", "Acil durdurma"),
    fmt: asPct,
    hint: T(
      "Pauses new orders while the account is this much or more below its highest value. It does not sell, so losses can go past this.",
      "Hesap en yüksek değerinin bu kadar veya daha fazla altındayken yeni emirleri durdurur. Satış yapmaz, bu yüzden kayıp bu sınırı geçebilir.",
    ),
  },
  min_order_usdt: { label: T("Smallest trade", "En küçük işlem"), fmt: asUsd, hint: T("Tiny rebalances are skipped to save fees.", "Komisyondan tasarruf için çok küçük dengelemeler atlanır.") },
  max_position_pct: { label: T("Biggest share for one coin", "Tek coin için en büyük pay"), fmt: asPct },
  risk_budget_pct: { label: T("Risk cap per coin", "Coin başına risk sınırı"), fmt: asPct, hint: T("share × yearly swing must stay under this", "pay × yıllık oynaklık bunun altında kalmalı") },
  target_vol_pct: {
    label: T("Price-swing cap for the portfolio", "Portföy için oynaklık sınırı"),
    fmt: asPct,
    hint: T("Positions are scaled down so the portfolio swings at most about this much per year.", "Pozisyonlar küçültülür, böylece portföy yılda en fazla yaklaşık bu kadar dalgalanır."),
  },
  cycle_seconds: { label: T("Time between check-ins", "Check-in'ler arası süre"), fmt: (v) => `${String(v)} ${T("s", "sn")}` },
  candle_bar: { label: T("Price candle size", "Mum boyu"), fmt: (v) => String(v) },
  lookback_bars: { label: T("History used for trends", "Trend için kullanılan geçmiş"), fmt: (v) => `${String(v)} ${T("candles", "mum")}` },
  okx_site: { label: T("OKX site", "OKX sitesi"), fmt: (v) => String(v).toUpperCase() },
  quote: { label: T("Quote currency", "Karşı para birimi"), fmt: (v) => String(v) },
});
const ORDER = Object.keys(KNOWN_());
const LIMITS = ["max_order_usdt", "max_total_deploy_usdt", "kill_switch_drawdown_pct"];

const GUARDS = (): { title: string; text: string }[] => [
  {
    title: T("Can never withdraw money", "Asla para çekemez"),
    text: T("The OKX key allows reading and trading only. No withdrawal or transfer exists anywhere in the code.", "OKX anahtarı sadece okuma ve işleme izin verir. Kodun hiçbir yerinde çekim (withdraw) veya transfer yok."),
  },
  {
    title: T("No borrowing, no leverage", "Borç yok, kaldıraç yok"),
    text: T("Spot trading only: no derivatives, no margin. The leverage setting is never called.", "Sadece spot işlem: türev yok, margin yok. Kaldıraç ayarı hiç çağrılmaz."),
  },
  { title: T("Only the listed coins", "Sadece listedeki coinler"), text: T("Orders for any other coin are rejected in code.", "Başka bir coin için emirler kodda reddedilir.") },
  { title: T("Spending caps", "Harcama sınırları"), text: T("Per-trade and total limits are checked in code before every order.", "İşlem başına ve toplam limitler her emirden önce kodda kontrol edilir.") },
  {
    title: T("Emergency stop", "Acil durdurma (kill switch)"),
    text: T(
      "While the account is more than the set percentage below its high, no new orders are placed. It pauses buying; it does not sell.",
      "Hesap zirvesinin belirlenen yüzdeden fazla altındayken yeni emir verilmez. Alımı durdurur; satış yapmaz.",
    ),
  },
  {
    title: T("No seal, no trade", "Mühür yoksa işlem yok"),
    text: T("If sealing the decision on Avalanche fails, no order is placed that check-in (safe stop).", "Karar Avalanche'ta mühürlenemezse o check-in'de emir verilmez (güvenli durma)."),
  },
  {
    title: T("A human switches it on", "Canlıya bir insan geçirir"),
    text: T("Practice mode is the default. Going live is a config change made by a person, not a button here.", "Varsayılan deneme modudur (dry run). Canlıya geçmek bir insanın yaptığı config değişikliğidir, buradaki bir düğme değil."),
  },
];

export default function Settings({ s }: ScreenProps) {
  const cfg = s.config;
  const KNOWN = KNOWN_();
  const coins = Array.isArray(cfg.coins) ? (cfg.coins as unknown[]).filter((c): c is string => typeof c === "string") : [];
  const keys = Object.keys(cfg).filter((k) => !["coins", "dry_run", "mode", ...LIMITS].includes(k));
  keys.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  const errors = [...s.errors].sort((a, b) => (b.at_ms ?? 0) - (a.at_ms ?? 0));
  const lim = (k: string) => (cfg[k] === undefined || cfg[k] === null || cfg[k] === "" ? null : KNOWN[k].fmt(cfg[k]));
  // docs/ui-copy.md (c) Settings live summary; emergency-stop wording per R-007-7 (it pauses buying, it does not sell)
  const parts = [
    lim("max_order_usdt") && T(`Max ${lim("max_order_usdt")} per order`, `emir başına en fazla ${lim("max_order_usdt")}`),
    lim("max_total_deploy_usdt") && T(`${lim("max_total_deploy_usdt")} in total`, `toplamda ${lim("max_total_deploy_usdt")}`),
    lim("kill_switch_drawdown_pct") &&
      T(`emergency stop pauses new orders at −${lim("kill_switch_drawdown_pct")} from the high`, `acil durdurma zirveden −${lim("kill_switch_drawdown_pct")} düşüşte yeni emirleri durdurur`),
  ].filter(Boolean);
  const summary = [
    s.dry_run
      ? T("Practice mode: decisions are sealed for real, orders are simulated.", "Deneme modu (dry run): kararlar gerçekten mühürlenir, emirler simüle edilir.")
      : s.dry_run === false
        ? T("Live mode: real orders on OKX TR.", "Canlı mod: OKX TR'de gerçek emirler.")
        : "",
    parts.length ? `${T("", "Limitler: ")}${parts.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHead
        eyebrow={T("Settings", "Ayarlar")}
        title={T("What the agent is allowed to do. The limits live in its settings file and are checked in code before every order.", "Agent'ın neye izni var. Limitler ayar dosyasında durur ve her emirden önce kodda kontrol edilir.")}
        summary={summary}
        aside={<span className="tag unk">{T("READ-ONLY", "SALT OKUNUR")}</span>}
      />

      <div className="stack">
        <Card title={T("Mode", "Mod")}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`mode-badge ${s.dry_run === false ? "live" : s.dry_run ? "dry" : "unk"}`}>
              {s.dry_run === false ? `LIVE · ${T("real funds", "gerçek para")}` : s.dry_run ? "PRACTICE MODE" : T("Mode unknown", "Mod bilinmiyor")}
            </span>
            <span>
              {s.dry_run
                ? T("Orders are simulated, but every decision is really sealed on Avalanche.", "Emirler simüle edilir ama her karar gerçekten Avalanche'ta mühürlenir.")
                : s.dry_run === false
                  ? T("Orders go to OKX TR with real money.", "Emirler gerçek parayla OKX TR'ye gider.")
                  : ""}
              <span className="tech">
                dry_run: {String(s.dry_run)} ·{" "}
                {s.dry_run === false ? T("OKX TR live account", "OKX TR canlı hesap") : T("OKX TR · prices & balance only, orders simulated", "OKX TR · sadece fiyat ve bakiye, emirler simüle")} ·{" "}
                {T("switching is a config change, not a UI button", "geçiş bir config değişikliğidir, arayüzde düğme yok")}
              </span>
            </span>
          </div>
        </Card>

        <Card title={T("Spending limits", "Harcama limitleri")} meta={T("checked in code before every order", "her emirden önce kodda kontrol edilir")}>
          <div className="cols three">
            {LIMITS.map((k) => (
              <div key={k} className="stat">
                <Term plain={KNOWN[k].label} tech={k} />
                <div className="v" style={{ fontSize: 32 }}>
                  {lim(k) ?? <span className="dim">—</span>}
                </div>
                <div className="sub">{lim(k) ? KNOWN[k].hint : T("not reported by the agent yet", "agent henüz bildirmedi")}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="cols two">
          <Card title={T("Safety rules", "Güvenlik kuralları")} meta={T("narrow the permission, cap the spend, keep the trail", "izni daralt, harcamayı sınırla, izi sakla")}>
            <ul className="checks">
              {GUARDS().map((g) => (
                <li key={g.title}>
                  <span className="y" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <b>{g.title}</b>
                    <p>{g.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={T("All settings", "Bütün ayarlar")} meta={T("exactly what the agent reports", "agent'ın bildirdiği haliyle")}>
            <table className="table">
              <tbody>
                <tr>
                  <td>
                    {T("Coins it may trade", "İşlem yapabileceği coinler")}
                    <div className="tech">coins</div>
                  </td>
                  <td className="r">
                    {coins.length ? (
                      <span className="coins" style={{ justifyContent: "flex-end" }}>
                        {coins.map((c) => (
                          <span key={c} className="chip" style={{ color: "var(--text)" }}>
                            {coin(c)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                {keys.map((k) => {
                  const known = KNOWN[k];
                  const v = cfg[k];
                  return (
                    <tr key={k}>
                      <td>
                        {known ? known.label : <span className="mono muted">{k}</span>}
                        <div className="tech">
                          {k}
                          {known?.hint ? ` · ${known.hint}` : ""}
                        </div>
                      </td>
                      <td className="r" style={{ fontWeight: known ? 600 : 400 }}>
                        {known ? known.fmt(v) : <span className="mono muted">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        <Card
          title={<Term plain={T("Errors", "Hatalar")} tech="System › Errors" />}
          meta={T("The agent skips a check-in when a step fails, logs it here, and carries on.", "Bir adım başarısız olursa agent o check-in'i atlar, buraya yazar ve devam eder.")}
          id="system"
        >
          {errors.length === 0 ? (
            <span className="chip ok">✓ {T("No errors", "Hata yok")}</span>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>{T("Time", "Saat")}</th>
                    <th>{T("What happened", "Ne oldu")}</th>
                    <th>{T("Code", "Kod")}</th>
                    <th>{T("Where", "Nerede")}</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e, i) => (
                    <tr key={i}>
                      <td className="mono muted" style={{ whiteSpace: "nowrap" }}>
                        {dayClock(e.at_ms)}
                      </td>
                      <td>{e.message ?? "—"}</td>
                      <td>
                        <span className="errcode">{e.code ?? "ERROR"}</span>
                      </td>
                      <td className="mono muted">{e.where ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

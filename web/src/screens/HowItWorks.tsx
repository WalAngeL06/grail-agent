import type { GrailState } from "../state";
import { AvalancheMark, PageHead } from "../components/Bits";
import { n, pct, usd } from "../format";
import { T, isTr } from "../i18n";
import ReplayChart, { replaySummary } from "../components/ReplayChart";

/** Five cards, each a small diagram + two sentences. Live numbers are used when the agent's state is available. */
export default function HowItWorks({ s }: { s: GrailState | null }) {
  const maxOrder = s?.config.max_order_usdt as string | undefined;
  const maxTotal = s?.config.max_total_deploy_usdt as string | undefined;
  const kill = s?.config.kill_switch_drawdown_pct as number | undefined;
  const { g, b, days } = replaySummary();

  return (
    <>
      <PageHead eyebrow={T("How it works", "Nasıl çalışır")} title={T("Five ideas behind every decision GRAIL makes.", "GRAIL'in her kararının arkasındaki beş fikir.")} />
      <div className="how">
        <article className="card how-card">
          <CorrDiagram />
          <h2>{T("1 · Independent bets", "1 · Bağımsız varlık · n_eff")}</h2>
          <p>
            {T(
              "Coins that rise and fall together act like one bet, so five coins can be worth barely more than one. GRAIL counts real bets, not coins, and sizes every position by them.",
              "Birlikte yükselip düşen coinler tek bir varlık gibi davranır; beş coin, bir coinden ancak biraz fazlasına denk gelebilir. GRAIL coin sayısına değil etkin varlık sayısına bakar ve her pozisyonu buna göre boyutlar.",
            )}
          </p>
          <a className="linkbtn" href="#/dashboard">
            {T("See the live chart →", "Canlı grafiği gör →")}
          </a>
        </article>

        <article className="card how-card">
          <EnvelopeDiagram />
          <h2>{T("2 · Sealed envelope", "2 · Mühürlü zarf · commit-reveal")}</h2>
          <p>
            {T(
              "Before any order, GRAIL writes a fingerprint of its decision to Avalanche, like sealing an envelope. After the trade it opens the envelope, so anyone can check that nothing changed.",
              "Herhangi bir emirden önce GRAIL kararının parmak izini (hash) Avalanche'a yazar, tıpkı bir zarfı mühürlemek gibi. İşlemden sonra zarfı açar; böylece herkes hiçbir şeyin değişmediğini kontrol edebilir.",
            )}
          </p>
          <a className="linkbtn" href="#/decisions">
            {T("Verify a decision yourself →", "Bir kararı kendin doğrula (Verify yourself) →")}
          </a>
        </article>

        <article className="card how-card">
          <AiDiagram />
          <h2>{T("3 · AI second opinion", "3 · AI ikinci görüş")}</h2>
          <p>
            {T(
              "An AI reviews each buy and can make it smaller or cancel it. It can never make a trade bigger, and it never blocks a sell.",
              "Bir AI her alımı inceler; küçültebilir ya da iptal edebilir. Bir işlemi asla büyütemez ve bir satışı asla engellemez.",
            )}
          </p>
          <a className="linkbtn" href="#/decisions">
            {T("See its verdicts →", "Kararlarını gör →")}
          </a>
        </article>

        <article className="card how-card">
          <ShieldDiagram />
          <h2>{T("4 · Safety limits", "4 · Güvenlik limitleri")}</h2>
          <p>
            {T(
              `The agent can only buy and sell spot coins from its list, with hard caps per order and in total${maxOrder && maxTotal ? ` (${usd(maxOrder)} and ${usd(maxTotal)})` : ""}. It cannot withdraw money or borrow, and an emergency stop pauses new orders while the account is ${kill !== undefined ? pct(kill, 1) : "a set percentage"} or more below its high. It does not sell, so a drop can go past that line.`,
              `Agent sadece listesindeki spot coinleri alıp satabilir; emir başına ve toplamda kesin sınırlar var${maxOrder && maxTotal ? ` (${usd(maxOrder)} ve ${usd(maxTotal)})` : ""}. Para çekemez, borç alamaz; acil durdurma (kill switch), hesap zirvesinin ${kill !== undefined ? pct(kill, 1) : "belirlenen yüzde"} veya daha fazla altındayken yeni emirleri durdurur. Satış yapmaz, bu yüzden düşüş o çizgiyi geçebilir.`,
            )}
          </p>
          <a className="linkbtn" href="#/settings">
            {T("See all limits →", "Bütün limitleri gör →")}
          </a>
        </article>

        <article className="card how-card">
          <div className="diagram roles" aria-hidden="true">
            <div className="role">
              <span className="okx">OKX</span>
              <small>{T("prices · orders", "fiyat · emir")}</small>
            </div>
            <span className="arrow">⇄</span>
            <div className="role">
              <b className="grail-dot">GRAIL</b>
              <small>{T("decides", "karar verir")}</small>
            </div>
            <span className="arrow">⇄</span>
            <div className="role">
              <AvalancheMark size={30} />
              <small>{T("record", "kayıt")}</small>
            </div>
          </div>
          <h2>5 · OKX + Avalanche</h2>
          <p>
            {T(
              "OKX Agent Trade Kit gives GRAIL live prices and places its orders on OKX TR. Avalanche keeps the record of every decision, which no one can edit.",
              "OKX Agent Trade Kit, GRAIL'e canlı fiyatları verir ve emirlerini OKX TR'de iletir. Avalanche her kararın kaydını tutar; bu kaydı kimse değiştiremez.",
            )}
          </p>
          <a className="linkbtn" href="#/ledger">
            {T("Open the on-chain record →", "Zincir kaydını aç →")}
          </a>
        </article>
      </div>

      {s && Object.keys(s.metrics.signals).length > 0 && <SmartEntry s={s} />}

      <section className="card replay" style={{ marginTop: 16 }} aria-label={T(`Last ${days} days`, `Son ${days} gün`)}>
        <div className="replay-head">
          <div>
            <div className="eyebrow">{T(`Last ${days} days · simulation on real OKX hourly prices, no real orders`, `Son ${days} gün · gerçek OKX saatlik fiyatlarıyla simülasyon, gerçek emir yok`)}</div>
            <h2>
              {drawdownHeadline(g.max_drawdown_pct, b.max_drawdown_pct)}: <span className="gold">{pct(g.max_drawdown_pct, 1)}</span> {T("vs", "-")}{" "}
              {pct(b.max_drawdown_pct, 1)}
            </h2>
            <p className="muted">
              {isTr() ? (
                <>
                  {n(R_START(), 0)} USDT ile başlayınca GRAIL'in zirveden en kötü düşüşü {pct(g.max_drawdown_pct, 1)} oldu; 5 coini sadece tutmakta (al-tut) bu{" "}
                  {pct(b.max_drawdown_pct, 1)}. Bu sakinliğin bedeli: GRAIL <b>{signed(g.return_pct)}</b> kazanırken al-tut <b>{signed(b.return_pct)}</b> kazandı.
                  Fiyatlar düşüşe geçince {g.times_went_to_cash ?? "—"} kez tamamen nakde geçti.
                </>
              ) : (
                <>
                  Starting from {n(R_START(), 0)} USDT, GRAIL's worst fall from a high was {pct(g.max_drawdown_pct, 1)}, against {pct(b.max_drawdown_pct, 1)} for
                  simply holding all 5 coins. The price of that calm: it made <b>{signed(g.return_pct)}</b> while buy-and-hold made <b>{signed(b.return_pct)}</b>.
                  It stepped fully into cash {g.times_went_to_cash ?? "—"} times when prices turned down.
                </>
              )}
            </p>
          </div>
          <dl className="replay-stats">
            <div>
              <dt>{T("Worst drop", "En kötü düşüş")}</dt>
              <dd>
                <span className="gold">{pct(g.max_drawdown_pct, 1)}</span> <span className="muted">{T("vs", "al-tut:")} {pct(b.max_drawdown_pct, 1)}</span>
              </dd>
            </div>
            <div>
              <dt>{T("Return", "Getiri")}</dt>
              <dd>
                {signed(g.return_pct)} <span className="muted">{T("vs", "al-tut:")} {signed(b.return_pct)}</span>
              </dd>
            </div>
          </dl>
        </div>
        <ReplayChart />
        <p className="tech" style={{ marginTop: 8 }}>
          {T(
            "engine/out/replay.json · 1 engine decision per closed 1H bar · 0.1% fee · fills at bar close, no slippage · same limits as the live config · past results are no promise",
            "engine/out/replay.json · kapanan her 1H mumda 1 engine kararı · %0,1 komisyon · mum kapanışında dolum, slippage yok · canlı config ile aynı limitler · geçmiş sonuçlar garanti değildir",
          )}
        </p>
      </section>

      <details className="card math" style={{ marginTop: 16 }}>
        <summary>{T("Glossary — plain words and the technical names behind them", "Sözlük — sade kelimeler ve arkalarındaki teknik adlar")}</summary>
        {isTr() ? (
          <dl className="glossary">
            <dt>Bağımsız varlık</dt>
            <dd>Etkin varlık sayısı (n_eff) = N / (1 + (N−1)·ρ̄). Coinlerinin kaç gerçekten ayrı varlık gibi davrandığı.</dd>
            <dt>Birliktelik</dt>
            <dd>ρ̄, getirilerin ortalama ikili korelasyonu: 0 (bağımsız) ile 1 (tamamen birlikte) arası.</dd>
            <dt>Risk başına getiri</dt>
            <dd>Sharpe ratio (SR). Panelde bir örnektir: coin başına SR₁ = 0,5 varsayım, × √n_eff.</dd>
            <dt>Sepetin trendinin gerçek olma ihtimali</dt>
            <dd>Tüm coinlerin risk dengeli sepetinin son 48 saatteki PSR(SR&gt;0) değeri, in-sample. GRAIL'in kendi geçmiş performansı değildir.</dd>
            <dt>Aile bazlı boyutlama</dt>
            <dd>HRP (hierarchical risk parity): benzer davranan coinler gruplanır, her aile kendi risk payını alır.</dd>
            <dt>Mühürlü zarf</dt>
            <dd>GrailLedger üzerinde commit / reveal: commit_hash = keccak256(payload ‖ salt), sonra revealDecision(payload, salt, okxOrderId).</dd>
            <dt>Parmak izi</dt>
            <dd>hash (keccak256). Tek bir karakter değişirse tamamen değişir.</dd>
            <dt>Rastgele kod</dt>
            <dd>salt, her check-in için 32 rastgele bayt. Şifre veya cüzdan anahtarı değildir.</dd>
            <dt>Deneme modu</dt>
            <dd>dry run (dry_run): kararlar gerçekten verilir ve mühürlenir, emirler sadece simüle edilir.</dd>
            <dt>Acil durdurma</dt>
            <dd>kill switch: hesap zirvesinin belirlenen yüzde veya daha fazla altındayken yeni emir yok. Satış yapmaz.</dd>
            <dt>Check-in</dt>
            <dd>cycle (döngü): piyasayı oku, karar ver, mühürle, işlem yap, aç.</dd>
            <dt>AI kararı</dt>
            <dd>llm_flag: approved · reduced · vetoed · exempt (satışlar incelenmez) · skipped (incelenecek yok ya da AI'a ulaşılamadı).</dd>
            <dt>Zincirdeki kimlik kartı</dt>
            <dd>ERC-8004 IdentityRegistry agentId.</dd>
          </dl>
        ) : (
          <dl className="glossary">
            <dt>Independent bets</dt>
            <dd>n_eff (effective N) = N / (1 + (N−1)·ρ̄). How many truly separate bets your coins add up to.</dd>
            <dt>Togetherness</dt>
            <dd>ρ̄, average pairwise correlation of returns, from 0 (independently) to 1 (in lockstep).</dd>
            <dt>Return per unit of risk</dt>
            <dd>Sharpe ratio (SR). On the dashboard it is an illustration: SR₁ = 0.5 assumed per coin, × √n_eff.</dd>
            <dt>Chance the basket's trend is real</dt>
            <dd>PSR(SR&gt;0) of the risk-balanced basket of all coins over the last 48h, in-sample. Not GRAIL's own track record.</dd>
            <dt>Family-based sizing</dt>
            <dd>HRP, hierarchical risk parity: coins that behave alike are grouped and each family gets its share of risk.</dd>
            <dt>Seal / Open</dt>
            <dd>commit / reveal on GrailLedger: commit_hash = keccak256(payload ‖ salt), then revealDecision(payload, salt, okxOrderId).</dd>
            <dt>Fingerprint</dt>
            <dd>hash (keccak256). Change one character and it changes completely.</dd>
            <dt>Random code</dt>
            <dd>salt, 32 random bytes per check-in. Not a password or wallet key.</dd>
            <dt>Practice mode</dt>
            <dd>dry_run: decisions are made and sealed for real, orders are only simulated.</dd>
            <dt>Emergency stop</dt>
            <dd>kill switch: no new orders while equity is the set percentage or more below its peak. It does not sell.</dd>
            <dt>Check-in</dt>
            <dd>cycle: read the market, decide, seal, trade, open.</dd>
            <dt>AI verdict</dt>
            <dd>llm_flag: approved · reduced · vetoed · exempt (sells are not reviewed) · skipped (nothing to review, or AI unavailable).</dd>
            <dt>On-chain ID card</dt>
            <dd>ERC-8004 IdentityRegistry agentId.</dd>
          </dl>
        )}
      </details>
    </>
  );
}

/** Headline from the replay numbers themselves, so it stays true when replay.json changes. */
export function drawdownHeadline(g?: number, b?: number): string {
  if (g === undefined || b === undefined || !(b > 0)) return T("Worst drop", "En kötü düşüş");
  const f = g / b;
  if (f > 1.1) return T("A deeper worst drop than buy-and-hold", "Al-tut'tan daha derin bir en kötü düşüş");
  if (f >= 0.9) return T("About the same worst drop", "Yaklaşık aynı en kötü düşüş");
  if (f >= 0.55) return T(`A ${Math.round((1 - f) * 100)}% smaller worst drop`, `%${Math.round((1 - f) * 100)} daha küçük en kötü düşüş`);
  if (f >= 0.48) return T("Half the worst drop", "En kötü düşüşün yarısı");
  if (f >= 0.36) return T("Less than half the worst drop", "En kötü düşüşün yarısından az");
  if (f >= 0.3) return T("About a third of the worst drop", "En kötü düşüşün yaklaşık üçte biri");
  if (f >= 0.2) return T("Less than a third of the worst drop", "En kötü düşüşün üçte birinden az");
  return T(`A ${n(1 / f, 0)}× smaller worst drop`, `${n(1 / f, 0)}× daha küçük en kötü düşüş`);
}

const signed = (v?: number) => (v === undefined ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${pct(Math.abs(v), 1)}`);
const R_START = () => (replaySummary() as unknown as { g: { start_usdt?: number } }).g.start_usdt ?? 50;

function SmartEntry({ s }: { s: GrailState }) {
  const sig = s.metrics.signals;
  const coins = Object.keys(sig);
  const trending = coins.filter((c) => sig[c].regime === "trending").length;
  const confirmed = coins.filter((c) => sig[c].setup === "retest").length;
  return (
    <article className="card how-card" style={{ marginTop: 16 }}>
      <EntryDiagram />
      <h2>{T("6 · Smart entry", "6 · Akıllı giriş · Hurst, breakout, retest")}</h2>
      <p>
        {T(
          "First GRAIL asks whether the market is trending or just moving sideways, using the Hurst exponent. In a sideways market, breakouts usually fail, so it waits.",
          "GRAIL önce Hurst ile sorar: piyasa trendde mi, yoksa yatay mı? Yatay piyasada breakout'lar genelde başarısız olur, bu yüzden bekler.",
        )}{" "}
        {T(
          "If the market is ranging (Hurst) and the price is clearly below its average, it makes a small mean-reversion buy (Ornstein-Uhlenbeck); in a trend, momentum does the work.",
          "Piyasa yataysa (Hurst) ve fiyat ortalamasının belirgin altındaysa küçük bir ortalamaya dönüş (Ornstein-Uhlenbeck) alımı yapar; trendde momentum çalışır.",
        )}
      </p>
      <p>
        {T(
          `When a price breaks out of its range, GRAIL waits for it to come back, test the old ceiling and hold. That retest confirms the move and allows a full-size buy; with no breakout at all it buys only half size. These checks can only shrink a buy, never enlarge it. Right now: ${trending} of ${coins.length} coins trending, ${confirmed} breakout${confirmed === 1 ? "" : "s"} confirmed by a retest.`,
          `Fiyat aralığından çıkınca (breakout) GRAIL geri gelip eski tavanı test etmesini ve tutunmasını bekler. Bu retest hareketi onaylar ve tam boy alıma izin verir; hiç breakout yoksa sadece yarım boy alır. Bu kontroller bir alımı sadece küçültebilir, asla büyütemez. Şu an: ${coins.length} coinden ${trending} tanesi trendde, ${confirmed} breakout retest ile onaylandı.`,
        )}
      </p>
      <a className="linkbtn" href="#/decisions">
        {T("See the signals per coin →", "Coin bazında sinyalleri gör →")}
      </a>
    </article>
  );
}

function EntryDiagram() {
  // range box, breakout above it, pullback to the old top (retest), then continuation
  return (
    <svg className="diagram" viewBox="0 0 240 80" aria-hidden="true">
      <rect x="14" y="34" width="96" height="30" rx="3" fill="rgba(245,165,36,.08)" stroke="var(--warn)" strokeDasharray="3 3" />
      <text x="62" y="76" textAnchor="middle" fontSize="9" fill="var(--muted)">
        {T("range (sideways)", "aralık (yatay)")}
      </text>
      <path d="M18 56 L30 42 L42 58 L54 40 L66 57 L78 41 L90 55 L104 38 L122 18 L138 34 L154 34 L170 16 L196 8 L226 4" fill="none" stroke="var(--grail)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="122" cy="18" r="3.5" fill="var(--proof)" />
      <text x="122" y="12" textAnchor="middle" fontSize="9" fill="var(--proof)">
        breakout
      </text>
      <circle cx="146" cy="34" r="3.5" fill="var(--buy)" />
      <text x="146" y="48" textAnchor="middle" fontSize="9" fill="var(--buy)">
        {T("retest holds", "retest tuttu")}
      </text>
    </svg>
  );
}

function CorrDiagram() {
  // five coins: four clustered (move together) + one apart → "≈ 1.4 bets"
  return (
    <svg className="diagram" viewBox="0 0 240 90" aria-hidden="true">
      <ellipse cx="70" cy="45" rx="52" ry="32" fill="rgba(232,176,75,.10)" stroke="var(--grail)" strokeDasharray="3 3" />
      {[
        [52, 34],
        [80, 30],
        [60, 58],
        [88, 55],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill="var(--surface-2)" stroke="var(--grail)" strokeWidth="1.5" />
      ))}
      <circle cx="158" cy="45" r="9" fill="var(--surface-2)" stroke="var(--proof)" strokeWidth="1.5" />
      <text x="70" y="88" textAnchor="middle" fontSize="10" fill="var(--muted)">
        {T("4 of 5 coins move together", "5 coinden 4'ü birlikte hareket eder")}
      </text>
      <text x="158" y="72" textAnchor="middle" fontSize="10" fill="var(--muted)">
        {T("apart", "ayrı")}
      </text>
      <text x="215" y="50" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--grail)">
        {T("≈1.5", "≈1,5")}
      </text>
    </svg>
  );
}

function EnvelopeDiagram() {
  const step = (x: number, label: string, color: string, glyph: string) => (
    <g>
      <circle cx={x} cy="34" r="16" fill="var(--surface-2)" stroke={color} strokeWidth="1.5" />
      <text x={x} y="39" textAnchor="middle" fontSize="14" fill={color}>
        {glyph}
      </text>
      <text x={x} y="68" textAnchor="middle" fontSize="10" fill="var(--muted)">
        {label}
      </text>
    </g>
  );
  return (
    <svg className="diagram" viewBox="0 0 240 80" aria-hidden="true">
      <line x1="30" y1="34" x2="210" y2="34" stroke="var(--border-strong)" />
      {step(30, T("decide", "karar"), "var(--text)", "✎")}
      {step(90, T("seal", "mühür"), "var(--proof)", "🔒")}
      {step(150, T("trade", "işlem"), "var(--text)", "⇄")}
      {step(210, T("open", "aç"), "var(--buy)", "✓")}
    </svg>
  );
}

function AiDiagram() {
  return (
    <svg className="diagram" viewBox="0 0 240 80" aria-hidden="true">
      <rect x="10" y="20" width="56" height="28" rx="6" fill="var(--buy-wash)" stroke="var(--buy)" />
      <text x="38" y="38" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--buy)">
        Buy $10
      </text>
      <path d="M70 34h26" stroke="var(--muted)" />
      <circle cx="116" cy="34" r="17" fill="var(--surface-2)" stroke="var(--proof)" />
      <text x="116" y="38" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--proof)">
        AI
      </text>
      <path d="M134 26l30-12M134 34h30M134 42l30 12" stroke="var(--muted)" />
      <text x="170" y="17" fontSize="10" fill="var(--buy)">
        {T("keep $10", "tut $10")}
      </text>
      <text x="170" y="38" fontSize="10" fill="var(--warn)">
        {T("smaller $4", "küçült $4")}
      </text>
      <text x="170" y="59" fontSize="10" fill="var(--danger)">
        {T("cancel", "iptal")}
      </text>
      <text x="120" y="76" textAnchor="middle" fontSize="10" fill="var(--muted)">
        {T("never bigger · never new", "asla büyütmez · asla yeni eklemez")}
      </text>
    </svg>
  );
}

function ShieldDiagram() {
  return (
    <svg className="diagram" viewBox="0 0 240 80" aria-hidden="true">
      <path d="M40 8 18 16v18c0 15 9 27 22 31 13-4 22-16 22-31V16Z" fill="var(--surface-2)" stroke="var(--buy)" strokeWidth="1.5" />
      <path d="m31 36 6 6 12-13" fill="none" stroke="var(--buy)" strokeWidth="2" strokeLinecap="round" />
      {[
        [T("per trade cap", "işlem başına sınır"), 20],
        [T("total cap", "toplam sınır"), 40],
        [T("emergency stop", "acil durdurma"), 60],
      ].map(([t, y]) => (
        <g key={t as string}>
          <rect x="80" y={(y as number) - 10} width="140" height="14" rx="3" fill="var(--surface-2)" />
          <text x="88" y={(y as number) + 1} fontSize="10" fill="var(--text)">
            ✓ {t}
          </text>
        </g>
      ))}
    </svg>
  );
}

import type { GrailState } from "../state";
import { Section } from "../components/Bits";
import { coin, n, usdt } from "../format";

type Guard = { key: string; label: string; fmt: (v: unknown) => string; desc: string };

const asNum = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const pctFmt = (v: unknown) => (Number.isFinite(asNum(v)) ? `%${n(asNum(v), 2)}` : String(v));
const usdtFmt = (v: unknown) => (Number.isFinite(asNum(v)) ? usdt(String(v)) : String(v));

const MONEY: Guard[] = [
  { key: "max_order_usdt", label: "Emir başına üst sınır", fmt: usdtFmt, desc: "Tek bir emir bu tutarı aşamaz; aşan kısım kesilir." },
  { key: "max_total_deploy_usdt", label: "Toplam kullanılabilir sermaye", fmt: usdtFmt, desc: "Agent'ın pozisyona koyabileceği toplam USDT. Dolunca yeni alım yok." },
  { key: "min_order_usdt", label: "En küçük emir", fmt: usdtFmt, desc: "Bunun altındaki farklar için emir verilmez (gereksiz işlem ücreti yok)." },
  { key: "kill_switch_drawdown_pct", label: "Kill switch (düşüş sınırı)", fmt: pctFmt, desc: "Portföy bu kadar düşerse agent yeni emir vermez." },
];
const RISK: Guard[] = [
  { key: "max_position_pct", label: "Coin başına en fazla ağırlık", fmt: pctFmt, desc: "Tek coin portföyün bu yüzdesini geçemez." },
  { key: "risk_budget_pct", label: "Coin başına risk bütçesi", fmt: pctFmt, desc: "Ağırlık × yıllık volatilite bu değeri geçemez (D-010)." },
  { key: "target_vol_pct", label: "Portföy volatilite hedefi", fmt: pctFmt, desc: "Ağırlıklar yıllık portföy volatilitesi bu hedefe inecek şekilde ölçeklenir." },
  { key: "cycle_seconds", label: "Döngü süresi", fmt: (v) => `${String(v)} sn`, desc: "Her döngüde veri → karar → commit → emir → reveal." },
  { key: "candle_bar", label: "Mum aralığı", fmt: (v) => String(v), desc: "OKX'ten çekilen mum periyodu." },
  { key: "lookback_bars", label: "Trend penceresi", fmt: (v) => `${String(v)} bar`, desc: "Trend ve korelasyon bu kadar barlık geçmişten hesaplanır." },
];
const KNOWN = new Set([...MONEY, ...RISK].map((g) => g.key).concat(["coins", "dry_run", "mode"]));

const PERMS: { ok: boolean; title: string; text: string }[] = [
  { ok: true, title: "Piyasa verisi ve bakiye okuma", text: "OKX Agent Trade Kit üzerinden mum, ticker ve hesap bakiyesi." },
  { ok: true, title: "Spot emir (sadece listedeki coinler)", text: "Emri yalnızca agent kodu verir; AI kod asistanlarının emir yetkisi yok." },
  { ok: false, title: "Para çekme ve transfer", text: "API anahtarında Withdraw yetkisi yok; kodda çekim/transfer çağrısı yok." },
  { ok: false, title: "Kaldıraç, vadeli, marjin", text: "Sadece spot. Kaldıraç ayarı çağrılmaz." },
  { ok: false, title: "Hesap ayarı değişikliği", text: "Agent hesap yapılandırmasına dokunmaz." },
  { ok: true, title: "Canlıya geçiş insan kararı", text: "dry_run varsayılan açık; canlı emri kullanıcı açar ve ilk emri izler." },
];

const FAILS: { when: string; then: string }[] = [
  { when: "Zincire commit başarısız", then: "O döngüde emir verilmez (fail-closed); hata kaydedilir, sonraki döngüye geçilir." },
  { when: "OKX veya RPC zaman aşımı", then: "Döngü atlanır. Belirsiz emir/tx önce kimliğiyle sorgulanır, körlemesine tekrar gönderilmez." },
  { when: "Bozuk veya eksik veri", then: "İlgili coin için BEKLE kararı; sebep gerekçede yazar." },
  { when: "Agent çöker", then: "Salt commit'ten önce diske yazılır; yeniden başlayınca açıkta kalan commit'ler önce reveal edilir." },
];

export default function Settings({ s }: { s: GrailState }) {
  const cfg = s.config;
  const coins = Array.isArray(cfg.coins) ? (cfg.coins as unknown[]).filter((c): c is string => typeof c === "string") : [];
  const extra = Object.entries(cfg).filter(([k]) => !KNOWN.has(k));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Yetki ve limitler</h1>
          <p>
            Agent'a ne yapma yetkisi verildi, ne kadar parayı riske atabilir ve bir şey ters giderse ne olur. Değerler agent'ın çalışan
            yapılandırmasından okunur; limitler emirden önce kodda zorlanır.
          </p>
        </div>
        <span className={`pill ${s.dry_run === false ? "avax" : "gold"}`}>
          {s.dry_run === false ? "Canlı emir açık" : s.dry_run ? "dry_run: emir gönderilmiyor" : "dry_run bilinmiyor"}
        </span>
      </div>

      <Section title="İzin verilen coinler" meta="sadece spot, karşı para USDT">
        {coins.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {coins.map((c) => (
              <span key={c} className="pill" style={{ fontSize: 14, color: "var(--ink)" }}>
                <b>{coin(c)}</b> <span className="faint">{c}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="faint">Coin listesi state'te yok.</p>
        )}
      </Section>

      <div className="grid-2">
        <Section title="Para limitleri" meta="emirden önce kod zorlar">
          {MONEY.map((g) => (
            <GuardRow key={g.key} g={g} v={cfg[g.key]} />
          ))}
        </Section>
        <Section title="Risk ve döngü" meta="quant engine parametreleri">
          {RISK.map((g) => (
            <GuardRow key={g.key} g={g} v={cfg[g.key]} />
          ))}
        </Section>
      </div>

      <div className="grid-2">
        <Section title="Yetkiler" meta="yetkiyi daralt, harcamayı sınırla, izi tut">
          {PERMS.map((p) => (
            <div className="perm" key={p.title}>
              <span className={p.ok ? "y" : "n"} aria-label={p.ok ? "izinli" : "yasak"}>
                {p.ok ? "✓" : "✕"}
              </span>
              <div>
                <b>{p.title}</b>
                <p>{p.text}</p>
              </div>
            </div>
          ))}
        </Section>
        <Section title="Bir şey ters giderse" meta="agent durmaz, para riske girmez">
          {FAILS.map((f) => (
            <div className="perm" key={f.when}>
              <span className="faint">→</span>
              <div>
                <b>{f.when}</b>
                <p>{f.then}</p>
              </div>
            </div>
          ))}
        </Section>
      </div>

      {extra.length > 0 && (
        <Section title="Diğer ayarlar" meta="state.config içindeki ek alanlar">
          <table className="table">
            <tbody>
              {extra.map(([k, v]) => (
                <tr key={k}>
                  <td className="mono">{k}</td>
                  <td className="r mono">{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}

function GuardRow({ g, v }: { g: Guard; v: unknown }) {
  const missing = v === undefined || v === null || v === "";
  return (
    <div className="guard">
      <span className="k">{g.label}</span>
      <span className="v num">{missing ? <span className="faint">—</span> : g.fmt(v)}</span>
      <span className="d">{g.desc}</span>
      {missing && <span className="src">Agent bu değeri state'e yazmıyor (config: {g.key}).</span>}
    </div>
  );
}

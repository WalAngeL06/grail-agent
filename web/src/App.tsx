import { useEffect, useState } from "react";
import { useGrailFeed, type Feed, type GrailState } from "./state";
import { Boundary, Skeleton } from "./components/Bits";
import { ago, time } from "./format";
import Dashboard from "./screens/Dashboard";
import Decisions from "./screens/Decisions";
import Ledger from "./screens/Ledger";
import Settings from "./screens/Settings";

type Route = "dashboard" | "kararlar" | "sicil" | "limitler";
const ROUTES: { id: Route; label: string; icon: JSX.Element }[] = [
  { id: "dashboard", label: "Portföy", icon: <IconGrail /> },
  { id: "kararlar", label: "Karar akışı", icon: <IconList /> },
  { id: "sicil", label: "On-chain sicil", icon: <IconSeal /> },
  { id: "limitler", label: "Yetki ve limitler", icon: <IconShield /> },
];

const readRoute = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, "") as Route;
  return ROUTES.some((r) => r.id === h) ? h : "dashboard";
};

export default function App() {
  const feed = useGrailFeed();
  const [route, setRoute] = useState<Route>(readRoute);
  const now = useNow(1000);

  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => window.scrollTo(0, 0), [route]);

  const s = feed.state;
  const unrevealed = s?.chain.unrevealed;

  return (
    <div className="shell">
      <aside className="rail">
        <a className="brand" href="#/dashboard" aria-label="GRAIL ana ekran">
          <IconGrail size={30} />
          <div>
            <b>GRAIL</b>
            <span>mühürlü agent sicili</span>
          </div>
        </a>

        {s && (
          <div className="agent-id">
            <div className="row">
              <span>
                <span className={`dot ${statusDot(s.agent.status)}`} />
                {s.agent.name ?? "agent"}
              </span>
              <span className="muted">{statusLabel(s.agent.status)}</span>
            </div>
            <div className="row faint">
              <span>döngü #{s.agent.cycle_id ?? "—"}</span>
              <span>{nextCycle(s, now)}</span>
            </div>
          </div>
        )}

        <nav className="nav" aria-label="Ekranlar">
          {ROUTES.map((r) => (
            <a key={r.id} href={`#/${r.id}`} aria-current={route === r.id ? "page" : undefined}>
              <span className="ico">{r.icon}</span>
              <span>{r.label}</span>
              {r.id === "kararlar" && s && <span className="count">{s.decisions.length}</span>}
              {r.id === "sicil" && unrevealed !== undefined && unrevealed > 0 && (
                <span className="count alert" title="Açıkta kalan commit">
                  {unrevealed} açık
                </span>
              )}
            </a>
          ))}
        </nav>

        {s && <ModeSeal state={s} />}
      </aside>

      <main className="main">
        <StatusStrip feed={feed} now={now} />
        {!s ? (
          <div style={{ maxWidth: 640, marginTop: 40 }}>
            <Skeleton lines={4} />
            <p className="faint">Agent durumu okunuyor…</p>
          </div>
        ) : (
          <Boundary key={route} name={ROUTES.find((r) => r.id === route)!.label}>
            {route === "dashboard" && <Dashboard s={s} />}
            {route === "kararlar" && <Decisions s={s} chainJson={feed.chainJson} />}
            {route === "sicil" && <Ledger s={s} chainJson={feed.chainJson} />}
            {route === "limitler" && <Settings s={s} />}
          </Boundary>
        )}
      </main>
    </div>
  );
}

function StatusStrip({ feed, now }: { feed: Feed; now: number }) {
  const s = feed.state;
  const age = s?.generated_at_ms !== undefined ? now - s.generated_at_ms : undefined;
  const stale = feed.source === "live" && age !== undefined && age > 5 * 60_000;
  return (
    <>
      <div className="strip" role="status" aria-live="polite">
        <SourcePill feed={feed} />
        {s?.chain.network && (
          <span className="pill avax" title={`chain_id ${s.chain.chain_id ?? "?"}`}>
            Avalanche {s.chain.network === "fuji" ? "Fuji" : s.chain.network}
          </span>
        )}
        <span>
          state yazıldı: <b className="num">{time(s?.generated_at_ms)}</b>{" "}
          <span className="faint">({ago(s?.generated_at_ms, now)})</span>
        </span>
        <span className="sp" />
        {s?.contract_version && <span className="faint">sözleşme v{s.contract_version}</span>}
      </div>
      {feed.error && (
        <div className="banner warn" role="alert">
          <div>
            <b>Son okuma başarısız:</b> {feed.error}.{" "}
            {feed.state ? "Ekranda en son okunan durum duruyor; 3 sn'de bir yeniden deneniyor." : ""}
          </div>
        </div>
      )}
      {feed.missingPath && (
        <div className="banner warn">
          <div>
            <b>GRAIL_STATE_PATH bulunamadı:</b> <span className="mono">{feed.missingPath}</span>. Agent henüz state yazmadı; örnek
            (mock) veri gösteriliyor.
          </div>
        </div>
      )}
      {stale && (
        <div className="banner warn">
          <div>
            <b>State {Math.round(age! / 60000)} dakikadır güncellenmedi.</b> Agent durmuş olabilir; döngü süresi{" "}
            {String(s?.config.cycle_seconds ?? "?")} sn.
          </div>
        </div>
      )}
    </>
  );
}

function SourcePill({ feed }: { feed: Feed }) {
  switch (feed.source) {
    case "live":
      return <span className="pill ok">● canlı state.json</span>;
    case "demo":
      return <span className="pill warn" title="web/fixtures/demo-state.json — gerçek hash'ler, uydurma tx'ler">demo verisi</span>;
    case "bundled":
      return <span className="pill warn">paketlenmiş örnek (sunucu yok)</span>;
    case "mock":
      return <span className="pill warn" title="contracts/state.example.json">örnek veri (mock)</span>;
    default:
      return <span className="pill">bağlanıyor…</span>;
  }
}

function ModeSeal({ state }: { state: GrailState }) {
  if (state.dry_run === false)
    return (
      <div className="seal live">
        <strong>Canlı mod</strong>
        <p>Emirler OKX TR'ye gerçek bakiyeyle gidiyor. Limitler kodda zorlanır.</p>
      </div>
    );
  return (
    <div className="seal">
      <strong>{state.dry_run === undefined ? "Mod bilinmiyor" : "dry_run açık"}</strong>
      <p>Kararlar zincire mühürlenir; emirler OKX'e gönderilmez, simüle edilir.</p>
    </div>
  );
}

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

const statusDot = (st?: string) => (st === "running" ? "on" : st === "stopped" || st === "error" ? "off" : "warn");
const statusLabel = (st?: string) =>
  ({ running: "çalışıyor", stopped: "durdu", error: "hata", paused: "duraklatıldı", killed: "kill switch" })[st ?? ""] ?? st ?? "bilinmiyor";
function nextCycle(s: GrailState, now: number) {
  const t = s.agent.next_cycle_at_ms;
  if (t === undefined) return "";
  const d = Math.round((t - now) / 1000);
  return d > 0 ? `sonraki ${d} sn` : `sonraki ${time(t)}`;
}

function IconGrail({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 6h14c0 6.5-3 10.5-7 10.5S9 12.5 9 6Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" style={{ color: "var(--gold)" }} />
      <path d="M16 16.5V23m-5.5 2.5h11" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}
function IconSeal() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="10" r="6.5" />
      <path d="M8.5 15.5 7 22l5-2.5 5 2.5-1.5-6.5" />
      <path d="m9.5 10 1.8 1.8L15 8.2" strokeLinecap="round" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="M12 8v5M12 16v.5" strokeLinecap="round" />
    </svg>
  );
}

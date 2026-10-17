import { useEffect, useState } from "react";
import { useGrailFeed, type Feed, type GrailState } from "./state";
import { Boundary } from "./components/Bits";
import { ago, countdown } from "./format";
import Dashboard from "./screens/Dashboard";
import Decisions from "./screens/Decisions";
import Ledger from "./screens/Ledger";
import Settings from "./screens/Settings";

export type Route = "dashboard" | "decisions" | "ledger" | "settings";
const ROUTES: { id: Route; label: string; icon: JSX.Element }[] = [
  { id: "dashboard", label: "Dashboard", icon: <IconGrid /> },
  { id: "decisions", label: "Decisions", icon: <IconList /> },
  { id: "ledger", label: "On-chain Ledger", icon: <IconSeal /> },
  { id: "settings", label: "Settings", icon: <IconShield /> },
];

const readRoute = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, "").split("/")[0] as Route;
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
  useEffect(() => {
    const anchor = window.location.hash.split("/")[2];
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [route]);

  const s = feed.state;
  const open = s?.chain.unrevealed;

  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="#/dashboard" aria-label="GRAIL dashboard">
          <IconGrail />
          <b>GRAIL</b>
        </a>
        <nav className="nav" aria-label="Screens">
          {ROUTES.map((r) => (
            <a key={r.id} href={`#/${r.id}`} aria-current={route === r.id ? "page" : undefined}>
              {r.icon}
              <span>{r.label}</span>
              {r.id === "ledger" && open !== undefined && open > 0 && (
                <span className="badge" title={`${open} open (unrevealed) commit${open === 1 ? "" : "s"}`}>
                  {open}
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <i aria-hidden="true" />
          Avalanche Fuji · OKX TR
        </div>
      </aside>

      <div className="page">
        <TopBar feed={feed} now={now} />
        <main className="content">
          <Strips feed={feed} now={now} />
          {!s ? (
            <div className="stack" aria-busy="true" aria-label="Loading">
              <div className="skeleton" style={{ height: 180 }} />
              <div className="cols four">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 90 }} />
                ))}
              </div>
              <div className="skeleton" style={{ height: 320 }} />
            </div>
          ) : (
            <Boundary key={route} name={ROUTES.find((r) => r.id === route)!.label}>
              {route === "dashboard" && <Dashboard s={s} />}
              {route === "decisions" && <Decisions s={s} chainJson={feed.chainJson} now={now} demo={feed.source === "demo"} />}
              {route === "ledger" && <Ledger s={s} chainJson={feed.chainJson} now={now} demo={feed.source === "demo"} />}
              {route === "settings" && <Settings s={s} />}
            </Boundary>
          )}
        </main>
      </div>
    </div>
  );
}

function TopBar({ feed, now }: { feed: Feed; now: number }) {
  const s = feed.state;
  if (!s)
    return (
      <header className="topbar" role="status">
        <span className="agent">
          <span className="dot" /> connecting…
        </span>
      </header>
    );
  const running = s.agent.status === "running";
  const next = countdown(s.agent.next_cycle_at_ms, now);
  const c = s.chain;
  const errs = s.errors.length;
  return (
    <header className="topbar" role="status" aria-live="off">
      <span className="agent" title={`status: ${s.agent.status ?? "unknown"}`}>
        <span className={`dot ${running ? "on" : ""}`} />
        {s.agent.name ?? "agent"}
        {!running && <span className="muted" style={{ fontWeight: 400 }}>{s.agent.status ?? "status unknown"}</span>}
      </span>
      <ModeChip state={s} />
      {(feed.source === "mock" || feed.source === "bundled") && (
        <span className="chip mock" title={feed.source === "bundled" ? "No state server; bundled example state" : "runtime/state.json not found; contracts/state.example.json"}>
          MOCK DATA
        </span>
      )}
      {feed.source === "demo" && (
        <span className="chip mock" title="web/fixtures/demo-state.json — real hashes, made-up tx ids">
          DEMO DATA
        </span>
      )}
      <span className="sep" />
      <span>
        Cycle <b>#{s.agent.cycle_id ?? "—"}</b>
      </span>
      {next && (
        <span>
          next in <b>{next}</b>
        </span>
      )}
      <span className="sep" />
      {c.commits !== undefined || c.reveals !== undefined ? (
        <a className="mini" href="#/ledger" style={{ textDecoration: "none" }} title="commits / reveals / unrevealed">
          <span>chain</span>
          <b>{c.commits ?? "—"}</b>/<b>{c.reveals ?? "—"}</b>/<b className={(c.unrevealed ?? 0) > 0 ? "open" : ""}>{c.unrevealed ?? "—"}</b>
        </a>
      ) : null}
      <a className={`chip ${errs > 0 ? "danger" : ""}`} href="#/settings/system" title="Agent errors (Settings › System)">
        {errs} {errs === 1 ? "error" : "errors"}
      </a>
      <span className="grow" />
      <span title={s.generated_at_ms ? new Date(s.generated_at_ms).toISOString() : ""}>updated {ago(s.generated_at_ms, now)}</span>
    </header>
  );
}

function ModeChip({ state }: { state: GrailState }) {
  if (state.dry_run === false) return <span className="chip danger">LIVE · real funds</span>;
  if (state.dry_run === true) return <span className="chip warn">DRY RUN · simulated orders</span>;
  return <span className="chip">mode unknown</span>;
}

function Strips({ feed, now }: { feed: Feed; now: number }) {
  const s = feed.state;
  const cyc = Number(s?.config.cycle_seconds);
  const age = s?.generated_at_ms !== undefined ? now - s.generated_at_ms : undefined;
  const stale = feed.source === "live" && age !== undefined && Number.isFinite(cyc) && cyc > 0 && age > 3 * cyc * 1000;
  return (
    <>
      {feed.error && (
        <div className="strip-msg danger" role="alert">
          Can't read state.json (retrying) — {feed.error}. {s ? "Last good state shown." : ""}
        </div>
      )}
      {feed.missingPath && (
        <div className="strip-msg mock">
          GRAIL_STATE_PATH points to <span className="mono">{feed.missingPath}</span>, which doesn't exist yet. Showing mock data.
        </div>
      )}
      {stale && (
        <div className="strip-msg warn" role="alert">
          Agent silent for {Math.max(1, Math.round(age! / 60000))}m — last state shown.
        </div>
      )}
    </>
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

function IconGrail() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 6h14c0 6.5-3 10.5-7 10.5S9 12.5 9 6Z" fill="none" stroke="var(--grail)" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M16 16.5V23m-5.5 2.5h11" stroke="var(--grail)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M7 15c3-6 6-7.5 13-8.5" strokeLinecap="round" />
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

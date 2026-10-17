import { useEffect, useMemo, useRef, useState } from "react";
import { useGrailFeed, type Feed, type GrailState } from "./state";
import { readChainJson, type ChainInfo } from "./chain";
import { Boundary, Toaster } from "./components/Bits";
import { ago, countdown } from "./format";
import Dashboard from "./screens/Dashboard";
import Decisions from "./screens/Decisions";
import Ledger from "./screens/Ledger";
import Settings from "./screens/Settings";
import HowItWorks from "./screens/HowItWorks";

export type Route = "dashboard" | "decisions" | "ledger" | "settings" | "how";
const ROUTES: { id: Route; label: string; short: string; icon: JSX.Element }[] = [
  { id: "dashboard", label: "Dashboard", short: "Home", icon: <IconGrid /> },
  { id: "decisions", label: "Decisions", short: "Decisions", icon: <IconList /> },
  { id: "ledger", label: "On-chain Ledger", short: "Ledger", icon: <IconSeal /> },
  { id: "settings", label: "Safety limits", short: "Limits", icon: <IconShield /> },
  { id: "how", label: "How it works", short: "How", icon: <IconHelp /> },
];

const readRoute = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, "").split("/")[0] as Route;
  return ROUTES.some((r) => r.id === h) ? h : "dashboard";
};

export type ScreenProps = { s: GrailState; chain: ChainInfo; now: number; demo: boolean };

export default function App() {
  const feed = useGrailFeed();
  const [route, setRoute] = useState<Route>(readRoute);
  const now = useNow(1000);
  const chain = useMemo(() => readChainJson(feed.chainJson), [feed.chainJson]);

  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => {
      setRoute(readRoute());
      setHash(window.location.hash);
    };
    // A link to the hash we are already on fires no hashchange: scroll to its anchor anyway.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href^='#/']");
      if (a && a.getAttribute("href") === window.location.hash) scrollToAnchor(window.location.hash);
    };
    window.addEventListener("hashchange", on);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", on);
      document.removeEventListener("click", onClick);
    };
  }, []);
  const lastRoute = useRef(route);
  useEffect(() => {
    // #/screen/anchor scrolls to the anchor (also within the same screen); a new screen without anchor starts at the top
    if (hash.split("/")[2]) scrollToAnchor(hash);
    else if (lastRoute.current !== route) window.scrollTo(0, 0);
    lastRoute.current = route;
  }, [hash, route]);

  const s = feed.state;
  const open = s?.chain.unrevealed;
  const props = s ? { s, chain, now, demo: feed.source === "demo" } : null;

  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="#/dashboard" aria-label="GRAIL dashboard">
          <i className="diamond" aria-hidden="true" />
          <b>GRAIL</b>
        </a>
        <nav className="nav" aria-label="Screens">
          {ROUTES.map((r) => (
            <a key={r.id} href={`#/${r.id}`} aria-current={route === r.id ? "page" : undefined}>
              {r.icon}
              <span className="nav-label">{r.label}</span>
              <span className="nav-short">{r.short}</span>
              {r.id === "ledger" && open !== undefined && open > 0 && (
                <span className="badge" title={`${open} decision${open === 1 ? "" : "s"} still sealed (not opened yet)`}>
                  {open}
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <div>
            <i aria-hidden="true" /> Avalanche Fuji · OKX TR
          </div>
          <div>Read-only · no wallet, no orders</div>
        </div>
      </aside>

      <div className="page">
        <TopBar feed={feed} now={now} />
        <main className="content">
          <Strips feed={feed} now={now} />
          {route !== "how" && <Intro />}
          {route === "how" ? (
            <HowItWorks s={s} />
          ) : !props ? (
            <div className="stack" aria-busy="true" aria-label="Loading">
              <p className="muted">Connecting to the agent… the first reading usually takes a second.</p>
              <div className="skeleton" style={{ height: 180 }} />
              <div className="cols four">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 90 }} />
                ))}
              </div>
            </div>
          ) : (
            <Boundary key={route} name={ROUTES.find((r) => r.id === route)!.label}>
              {route === "dashboard" && <Dashboard {...props} />}
              {route === "decisions" && <Decisions {...props} />}
              {route === "ledger" && <Ledger {...props} />}
              {route === "settings" && <Settings {...props} />}
            </Boundary>
          )}
        </main>
      </div>
      <Toaster />
    </div>
  );
}

/** Scroll to the element named by #/screen/<id>; retries briefly while the screen renders its data. */
function scrollToAnchor(h: string, tries = 12) {
  const id = h.split("/")[2];
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ block: "start" }); // instant: smooth scrolling was unreliable in testing
  else if (tries > 0) window.setTimeout(() => scrollToAnchor(h, tries - 1), 100);
}

// ---------- first-visit intro (dismissible, remembered per browser) ----------
const INTRO_KEY = "grail.intro.dismissed";
function Intro() {
  const [show, setShow] = useState(() => {
    try {
      return window.localStorage.getItem(INTRO_KEY) !== "1";
    } catch {
      return true;
    }
  });
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      window.localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* private mode: just hide for this visit */
    }
  };
  return (
    <section className="intro" aria-label="Quick tour">
      <ol>
        <li>
          <b>1 · An AI trades for you</b>
          <span>GRAIL picks coins on OKX and sizes them by how independent they really are.</span>
        </li>
        <li>
          <b>2 · Every decision is sealed first</b>
          <span>Before any trade, the decision is locked on Avalanche. Nobody can change it later.</span>
        </li>
        <li>
          <b>3 · You can check it yourself</b>
          <span>Press "Verify" on any decision: your browser re-checks the seal against the blockchain.</span>
        </li>
      </ol>
      <div className="intro-actions">
        <a className="btn sm" href="#/how" onClick={close}>
          How it works
        </a>
        <button className="btn sm" onClick={close} aria-label="Close the tour">
          Got it ✕
        </button>
      </div>
    </section>
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
      <span className="agent" title={`agent status: ${s.agent.status ?? "unknown"}`}>
        <span className={`dot ${running ? "on" : ""}`} />
        {s.agent.name ?? "agent"}
        <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
          {running ? "running" : (s.agent.status ?? "status unknown")}
        </span>
      </span>
      <ModeChip state={s} />
      {(feed.source === "mock" || feed.source === "bundled") && (
        <span className="chip mock" title="No live agent data found. Showing sample data.">
          MOCK DATA
        </span>
      )}
      {feed.source === "snapshot" && (
        <span
          className="chip snap"
          title="Agent data is a frozen snapshot of the real practice-mode run. The Ledger and every Verify read Avalanche live from your browser."
        >
          Snapshot of {s.generated_at_ms ? new Date(s.generated_at_ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} · live chain checks
        </span>
      )}
      {feed.source === "demo" && (
        <span className="chip mock" title="web/fixtures/demo-state.json — one real Fuji cycle plus made-up demo cycles">
          DEMO DATA
        </span>
      )}
      <span className="sep" />
      <span>
        Check-in <b>#{s.agent.cycle_id ?? "—"}</b>
      </span>
      {feed.source !== "snapshot" && (
        <span>{!running ? "paused" : next ? <>next in <b className="mono">{next}</b></> : "next check-in overdue"}</span>
      )}
      <span className="sep" />
      {(c.commits !== undefined || c.reveals !== undefined) && (
        <a className="mini" href="#/ledger" title="Decisions sealed on Avalanche / opened / still sealed">
          <b>{c.commits ?? "—"}</b> sealed <b>{c.reveals ?? "—"}</b> opened{" "}
          <b className={(c.unrevealed ?? 0) > 0 ? "open" : ""}>{c.unrevealed ?? "—"}</b>
          <span className={(c.unrevealed ?? 0) > 0 ? "open" : ""}>still sealed</span>
        </a>
      )}
      <a className={`chip ${errs > 0 ? "danger" : ""}`} href="#/settings/system" title="Errors the agent reported (it skips the check-in and keeps running)">
        {errs} {errs === 1 ? "error" : "errors"}
      </a>
      <span className="grow" />
      {feed.source !== "snapshot" && (
        <span title={s.generated_at_ms ? new Date(s.generated_at_ms).toISOString() : ""}>updated {ago(s.generated_at_ms, now)}</span>
      )}
    </header>
  );
}

function ModeChip({ state }: { state: GrailState }) {
  if (state.dry_run === false)
    return (
      <span className="chip danger" title="Real money on OKX TR">
        LIVE · real funds
      </span>
    );
  if (state.dry_run === true)
    return (
      <span className="chip warn" title="Practice mode (dry run): orders are simulated, but every decision is really sealed on Avalanche.">
        PRACTICE MODE · orders simulated
      </span>
    );
  return <span className="chip">mode unknown</span>;
}

function Strips({ feed, now }: { feed: Feed; now: number }) {
  const s = feed.state;
  const cyc = Number(s?.config.cycle_seconds);
  const age = s?.generated_at_ms !== undefined ? now - s.generated_at_ms : undefined;
  const stale = feed.source === "live" && age !== undefined && Number.isFinite(cyc) && cyc > 0 && age > 3 * cyc * 1000;
  const stopped = s && s.agent.status && s.agent.status !== "running";
  return (
    <>
      {feed.error && (
        <div className="strip-msg danger" role="alert">
          Can't read the agent's data right now. Retrying — showing the last known state.
          <span className="tech">{feed.error}</span>
        </div>
      )}
      {feed.missingPath && (
        <div className="strip-msg mock">
          The agent hasn't written live data yet, so example data is shown. <span className="tech">missing: {feed.missingPath}</span>
        </div>
      )}
      {stale && (
        <div className="strip-msg warn" role="alert">
          No update from the agent for {Math.max(1, Math.round(age! / 60000))}m — showing the last known state.
        </div>
      )}
      {stopped && (
        <div className="strip-msg warn">The agent is stopped. No new check-ins until it is restarted.</div>
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
function IconHelp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8v.2" strokeLinecap="round" />
    </svg>
  );
}

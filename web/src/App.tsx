import { useEffect, useMemo, useRef, useState } from "react";
import { useGrailFeed, type Feed, type GrailState } from "./state";
import { readChainJson, type ChainInfo } from "./chain";
import { Boundary, Toaster } from "./components/Bits";
import { ago, countdown } from "./format";
import { P, T, setLang, useLang } from "./i18n";
import Dashboard from "./screens/Dashboard";
import Decisions from "./screens/Decisions";
import Ledger from "./screens/Ledger";
import Settings from "./screens/Settings";
import HowItWorks from "./screens/HowItWorks";

export type Route = "dashboard" | "decisions" | "ledger" | "settings" | "how";
const ROUTES: { id: Route; label: () => string; short: () => string; icon: JSX.Element }[] = [
  { id: "dashboard", label: () => T("Dashboard", "Panel"), short: () => T("Home", "Panel"), icon: <IconGrid /> },
  { id: "decisions", label: () => T("Decisions", "Kararlar"), short: () => T("Decisions", "Kararlar"), icon: <IconList /> },
  { id: "ledger", label: () => T("On-chain Ledger", "Zincir Kaydı"), short: () => T("Ledger", "Kayıt"), icon: <IconSeal /> },
  { id: "settings", label: () => T("Safety limits", "Güvenlik limitleri"), short: () => T("Limits", "Limitler"), icon: <IconShield /> },
  { id: "how", label: () => T("How it works", "Nasıl çalışır"), short: () => T("How", "Nasıl"), icon: <IconHelp /> },
];

const readRoute = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, "").split("/")[0] as Route;
  return ROUTES.some((r) => r.id === h) ? h : "dashboard";
};

export type ScreenProps = { s: GrailState; chain: ChainInfo; now: number; demo: boolean };

export default function App() {
  const feed = useGrailFeed();
  const lang = useLang();
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
    <div className="shell" key={lang}>
      <aside className="side">
        <a className="brand" href="#/dashboard" aria-label="GRAIL dashboard">
          <i className="diamond" aria-hidden="true" />
          <b>GRAIL</b>
        </a>
        <nav className="nav" aria-label="Screens">
          {ROUTES.map((r) => (
            <a key={r.id} href={`#/${r.id}`} aria-current={route === r.id ? "page" : undefined}>
              {r.icon}
              <span className="nav-label">{r.label()}</span>
              <span className="nav-short">{r.short()}</span>
              {r.id === "ledger" && open !== undefined && open > 0 && (
                <span className="badge" title={T(`${open} decision${open === 1 ? "" : "s"} still sealed (not opened yet)`, `${open} karar hâlâ mühürlü (henüz açılmadı)`)}>
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
          <div>{T("Read-only · no wallet, no orders", "Salt okunur · cüzdan yok, emir yok")}</div>
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
              <p className="muted">{T("Connecting to the agent… the first reading usually takes a second.", "Agent'a bağlanılıyor… ilk okuma genelde bir saniye sürer.")}</p>
              <div className="skeleton" style={{ height: 180 }} />
              <div className="cols four">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 90 }} />
                ))}
              </div>
            </div>
          ) : (
            <Boundary key={route} name={ROUTES.find((r) => r.id === route)!.label()}>
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
    <section className="intro" aria-label={T("Quick tour", "Kısa tur")}>
      <ol>
        <li>
          <b>{T("1 · An AI trades for you", "1 · Senin yerine bir AI işlem yapar")}</b>
          <span>{T("GRAIL picks coins on OKX and sizes them by how independent they really are.", "GRAIL, OKX'te coin seçer ve her birine gerçekte ne kadar bağımsız olduğuna göre pay verir.")}</span>
        </li>
        <li>
          <b>{T("2 · Every decision is sealed first", "2 · Her karar önce mühürlenir")}</b>
          <span>{T("Before any trade, the decision is locked on Avalanche. Nobody can change it later.", "Hiçbir işlemden önce karar Avalanche'a kilitlenir. Sonradan kimse değiştiremez.")}</span>
        </li>
        <li>
          <b>{T("3 · You can check it yourself", "3 · Kendin kontrol edebilirsin")}</b>
          <span>{T('Press "Verify yourself" on any decision: your browser re-checks the seal against the blockchain.', "Herhangi bir kararda \"Verify yourself\" düğmesine bas: tarayıcın mührü blockchain'e karşı yeniden kontrol eder.")}</span>
        </li>
      </ol>
      <div className="intro-actions">
        <a className="btn sm" href="#/how" onClick={close}>
          {T("How it works", "Nasıl çalışır")}
        </a>
        <button className="btn sm" onClick={close} aria-label={T("Close the tour", "Turu kapat")}>
          {T("Got it ✕", "Anladım ✕")}
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
          <span className="dot" /> {T("connecting…", "bağlanıyor…")}
        </span>
        <span className="grow" />
        <LangSwitch />
      </header>
    );
  const running = s.agent.status === "running";
  const next = countdown(s.agent.next_cycle_at_ms, now);
  const c = s.chain;
  const errs = s.errors.length;
  return (
    <header className="topbar" role="status" aria-live="off">
      <span className="agent" title={`${T("agent status", "agent durumu")}: ${s.agent.status ?? "unknown"}`}>
        <span className={`dot ${running ? "on" : ""}`} />
        {s.agent.name ?? "agent"}
        <span className="muted tb-opt" style={{ fontWeight: 400, fontSize: 12 }}>
          {running ? T("running", "çalışıyor") : (s.agent.status ?? T("status unknown", "durum bilinmiyor"))}
        </span>
      </span>
      <ModeChip state={s} />
      {(feed.source === "mock" || feed.source === "bundled") && (
        <span className="chip mock" title={T("No live agent data found. Showing sample data.", "Canlı agent verisi bulunamadı. Örnek veri gösteriliyor.")}>
          MOCK DATA
        </span>
      )}
      {feed.source === "snapshot" && (
        <span
          className="chip snap"
          title={T(
            "Agent data is a frozen snapshot of the real practice-mode run. The Ledger and every Verify read Avalanche live from your browser.",
            "Agent verisi, gerçek deneme modu (dry run) çalışmasının dondurulmuş bir kopyasıdır. Zincir Kaydı ve her Verify, Avalanche'ı tarayıcından canlı okur.",
          )}
        >
          {T("Snapshot of", "Kopya:")} {s.generated_at_ms ? new Date(s.generated_at_ms).toLocaleString(T("en-GB", "tr-TR"), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} · {T("live chain checks", "zincir kontrolü canlı")}
        </span>
      )}
      {feed.source === "demo" && (
        <span className="chip mock" title={T("web/fixtures/demo-state.json — one real Fuji cycle plus made-up demo cycles", "web/fixtures/demo-state.json — bir gerçek Fuji döngüsü + uydurma demo döngüleri")}>
          DEMO DATA
        </span>
      )}
      <span className="sep" />
      <span>
        Check-in <b>#{s.agent.cycle_id ?? "—"}</b>
      </span>
      {feed.source !== "snapshot" && (
        <span>{!running ? T("paused", "duraklatıldı") : next ? <>{T("next in", "sonraki:")} <b className="mono">{next}</b></> : T("next check-in overdue", "sonraki check-in gecikti")}</span>
      )}
      <span className="sep" />
      {(c.commits !== undefined || c.reveals !== undefined) && (
        <a className="mini tb-opt" href="#/ledger" title={T("Decisions sealed on Avalanche / opened / still sealed", "Avalanche'ta mühürlenen / açılan / hâlâ mühürlü kararlar")}>
          <b>{c.commits ?? "—"}</b> {T("sealed", "mühürlü")} <b>{c.reveals ?? "—"}</b> {T("opened", "açıldı")}{" "}
          <b className={(c.unrevealed ?? 0) > 0 ? "open" : ""}>{c.unrevealed ?? "—"}</b>
          <span className={(c.unrevealed ?? 0) > 0 ? "open" : ""}>{T("still sealed", "hâlâ mühürlü")}</span>
        </a>
      )}
      <a className={`chip ${errs > 0 ? "danger" : ""}`} href="#/settings/system" title={T("Errors the agent reported (it skips the check-in and keeps running)", "Agent'ın bildirdiği hatalar (o check-in'i atlar, çalışmaya devam eder)")}>
        {errs} {P(errs, "error", "errors", "hata")}
      </a>
      <span className="grow" />
      {feed.source !== "snapshot" && (
        <span className="tb-opt" title={s.generated_at_ms ? new Date(s.generated_at_ms).toISOString() : ""}>
          {T("updated", "güncellendi:")} {ago(s.generated_at_ms, now)}
        </span>
      )}
      <LangSwitch />
    </header>
  );
}

function ModeChip({ state }: { state: GrailState }) {
  if (state.dry_run === false)
    return (
      <span className="chip danger" title={T("Real money on OKX TR", "OKX TR'de gerçek para")}>
        LIVE · {T("real funds", "gerçek para")}
      </span>
    );
  if (state.dry_run === true)
    return (
      <span className="chip warn" title={T("Practice mode (dry run): orders are simulated, but every decision is really sealed on Avalanche.", "Deneme modu (dry run): emirler simüle edilir ama her karar gerçekten Avalanche'ta mühürlenir.")}>
        PRACTICE MODE · {T("orders simulated", "emirler simüle")}
      </span>
    );
  return <span className="chip">{T("mode unknown", "mod bilinmiyor")}</span>;
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
          {T("Can't read the agent's data right now. Retrying — showing the last known state.", "Agent'ın verisi şu an okunamıyor. Yeniden deneniyor — bilinen son durum gösteriliyor.")}
          <span className="tech">{feed.error}</span>
        </div>
      )}
      {feed.missingPath && (
        <div className="strip-msg mock">
          {T("The agent hasn't written live data yet, so example data is shown.", "Agent henüz canlı veri yazmadı, bu yüzden örnek veri gösteriliyor.")} <span className="tech">missing: {feed.missingPath}</span>
        </div>
      )}
      {stale && (
        <div className="strip-msg warn" role="alert">
          {T(`No update from the agent for ${Math.max(1, Math.round(age! / 60000))}m — showing the last known state.`, `Agent'tan ${Math.max(1, Math.round(age! / 60000))} dakikadır güncelleme yok — bilinen son durum gösteriliyor.`)}
        </div>
      )}
      {stopped && (
        <div className="strip-msg warn">{T("The agent is stopped. No new check-ins until it is restarted.", "Agent durdu. Yeniden başlatılana kadar yeni check-in yok.")}</div>
      )}
    </>
  );
}

/** EN | TR switch; Turkish is the default (final presentation). Terms and method names stay English in both. */
function LangSwitch() {
  const lang = useLang();
  return (
    <span className="lang" role="group" aria-label="Language / Dil">
      <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>
        EN
      </button>
      <button aria-pressed={lang === "tr"} onClick={() => setLang("tr")}>
        TR
      </button>
    </span>
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

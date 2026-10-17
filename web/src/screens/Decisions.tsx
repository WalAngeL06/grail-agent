import { useEffect, useMemo, useRef, useState } from "react";
import { groupCycles, type Cycle, type Decision } from "../state";
import type { ScreenProps } from "../App";
import { ActionChip, Empty, ExplorerLink, Hash, LlmBadge, ModeTag, PageHead, SignalChips, Term } from "../components/Bits";
import type { Signal } from "../state";
import VerifySheet from "../components/VerifySheet";
import { clock, coin, countdown, dayClock, price } from "../format";
import { P, T, isTr } from "../i18n";

export default function Decisions({ s, chain, now, demo }: ScreenProps) {
  const cycles = useMemo(() => groupCycles(s), [s]);
  const [onlyTrades, setOnlyTrades] = useState(false);
  const [verify, setVerify] = useState<Cycle | null>(null);
  const fresh = useFreshKeys(cycles.map((c) => c.id));
  const trades = s.decisions.filter(isTrade).length;
  const next = countdown(s.agent.next_cycle_at_ms, now);

  return (
    <>
      <PageHead
        eyebrow={T("Decisions", "Kararlar")}
        title={T("What the agent decided for each coin, and why. Every check-in is sealed before any order.", "Agent her coin için ne karar verdi ve neden. Her check-in, herhangi bir emirden önce mühürlenir.")}
        summary={
          cycles.length
            ? decisionsSummary(cycles[0], s.dry_run)
            : undefined
        }
        aside={
          trades > 0 ? (
            <label className="chip toggle">
              <input type="checkbox" checked={onlyTrades} onChange={(e) => setOnlyTrades(e.target.checked)} /> {T("Only trades", "Sadece işlemler")} ({trades})
            </label>
          ) : undefined
        }
      />

      {cycles.length === 0 ? (
        <Empty title={T(`Waiting for the first check-in${next ? ` — next in ${next}` : ""}`, `İlk check-in bekleniyor${next ? ` — sonraki: ${next}` : ""}`)}>
          {T(
            `Every ${String(s.config.cycle_seconds ?? 90)} seconds GRAIL reads prices, decides buy / sell / hold for each coin, and seals that decision on Avalanche before any trade. The first check-in appears here.`,
            `GRAIL her ${String(s.config.cycle_seconds ?? 90)} saniyede fiyatları okur, her coin için BUY / SELL / HOLD kararı verir ve bu kararı herhangi bir işlemden önce Avalanche'ta mühürler. İlk check-in burada görünür.`,
          )}
        </Empty>
      ) : (
        <div className="stack">
          {cycles.map((c) => (
            <CycleCard
              key={c.id}
              c={c}
              explorer={s.chain.explorer ?? chain.explorer}
              onlyTrades={onlyTrades}
              flash={fresh.has(c.id)}
              onVerify={() => setVerify(c)}
              signals={c === cycles[0] ? s.metrics.signals : undefined}
            />
          ))}
        </div>
      )}

      {verify && (
        <VerifySheet
          cycle={verify}
          chain={chain}
          agentId={chain.agentId ?? s.chain.agent_id}
          agentName={chain.agentName ?? s.agent.name}
          explorer={s.chain.explorer ?? chain.explorer}
          demo={demo}
          onClose={() => setVerify(null)}
        />
      )}
    </>
  );
}

const isTrade = (d: Decision) => d.action === "BUY" || d.action === "SELL";

// docs/ui-copy.md (c) Decisions live summary
function decisionsSummary(c: Cycle, dry?: boolean) {
  if (!c.commit_tx) return T(`Check-in #${c.id} could not be sealed, so no order was sent.`, `Check-in #${c.id} mühürlenemedi, bu yüzden emir gönderilmedi.`);
  const k = (a: string) => c.decisions.filter((d) => d.action === a).length;
  return T(
    `Check-in #${c.id} at ${clock(c.decided_at_ms)}: ${k("BUY")} buy · ${k("SELL")} sell · ${k("HOLD")} hold. Sealed${c.reveal_tx ? " and opened" : ", waiting to be opened"}.${dry ? " Practice mode — orders were simulated." : ""}`,
    `Check-in #${c.id}, saat ${clock(c.decided_at_ms)}: ${k("BUY")} BUY · ${k("SELL")} SELL · ${k("HOLD")} HOLD. Mühürlendi${c.reveal_tx ? " ve açıldı" : ", açılmayı bekliyor"}.${dry ? " Deneme modu (dry run) — emirler simüle edildi." : ""}`,
  );
}

function CycleCard({
  c,
  explorer,
  onlyTrades,
  flash,
  onVerify,
  signals,
}: {
  c: Cycle;
  explorer?: string;
  onlyTrades: boolean;
  flash: boolean;
  onVerify: () => void;
  signals?: Record<string, Signal>;
}) {
  const [proof, setProof] = useState(false);
  const all = [...c.decisions].sort((a, b) => Number(isTrade(b)) - Number(isTrade(a)) || (a.inst_id ?? "").localeCompare(b.inst_id ?? ""));
  const rows = onlyTrades ? all.filter(isTrade) : all;
  const hidden = all.length - rows.length;

  return (
    <article className={`card cycle-card ${flash ? "flash" : ""}`} aria-label={`Check-in ${c.id}`}>
      <div className="cycle-top">
        <h3>
          Check-in #{c.id} <span className="mono muted">{dayClock(c.decided_at_ms)}</span> <span className="muted">· {c.decisions.length} {P(c.decisions.length, "decision", "decisions", "karar")}</span>{" "}
          <ModeTag dry={c.dry_run} />
        </h3>
        <Stepper c={c} />
      </div>
      {isTr() && c.decisions.some((d) => d.reason) && (
        <div className="sealed-note" title="reason · payload_utf8 · commit_hash">
          Gerekçeler engine'in mühürlü orijinal metnidir: hash'e dahil olduğu için İngilizce ve değiştirilmeden gösterilir.
        </div>
      )}
      {!c.commit_tx && (
        <div className="failbar">
          ✕ {T("Couldn't seal this decision, so no order was sent (safe stop).", "Bu karar mühürlenemedi, bu yüzden emir gönderilmedi (güvenli durma).")} <span className="tech">commit_tx missing</span>
        </div>
      )}

      {rows.map((d) => (
        <div className="drow" key={d.key}>
          <span className="coin">{coin(d.inst_id)}</span>
          <span>
            <ActionChip action={d.action} size={d.size_usdt} />
          </span>
          <span className="reason">
            {d.reason ?? <span className="dim">{T("No reason recorded.", "Gerekçe kaydedilmemiş.")}</span>}
            {d.llm_flag && (
              <span className="llm-line">
                <LlmBadge flag={d.llm_flag} note={d.llm_note} />
                {d.llm_note && !/^skipped|^exempt/.test(d.llm_note) && <span className="llm-note">{d.llm_note}</span>}
              </span>
            )}
            {signals && d.inst_id && <SignalChips sig={signals[d.inst_id]} />}
          </span>
          <span className="px">
            {T("at", "fiyat")} {price(d.ref_price)}
            {d.fill_price && <> → {T("filled", "gerçekleşti")} {price(d.fill_price)}</>}
          </span>
          <span className="ord">{isTrade(d) ? <OrderStatus d={d} failed={!c.commit_tx} /> : null}</span>
        </div>
      ))}
      {onlyTrades && hidden > 0 && <div className="drow-note">{rows.length ? T(`+ ${hidden} ${hidden === 1 ? "hold" : "holds"} hidden`, `+ ${hidden} HOLD gizli`) : T("All hold — nothing to trade this check-in.", "Hepsi HOLD — bu check-in'de işlem yok.")}</div>}

      <div className="cycle-foot">
        <span>
          <Term plain={T("sealed", "mühürlendi")} tech="commit tx" /> {c.commit_tx ? <ExplorerLink explorer={explorer} kind="tx" value={c.commit_tx} /> : <span style={{ color: "var(--danger)" }}>{T("failed", "başarısız")}</span>}
        </span>
        <span>
          <Term plain={T("opened", "açıldı")} tech="reveal tx" />{" "}
          {c.reveal_tx ? <ExplorerLink explorer={explorer} kind="tx" value={c.reveal_tx} /> : c.commit_tx ? <span className="tag open" title={T("Sealed but not opened yet. It stays visible on chain.", "Mühürlü ama henüz açılmadı. Zincirde görünür kalır.")}>OPEN</span> : "—"}
        </span>
        <span className="grow" />
        <button className="btn sm" aria-expanded={proof} onClick={() => setProof(!proof)}>
          {proof ? T("Hide the math", "Hesabı gizle") : T("Show the math", "Hesabı göster")}
        </button>
        {c.commit_tx && (
          <button className="btn sm proofbtn" onClick={onVerify} title={isTr() ? "kendin doğrula" : undefined}>
            Verify yourself
          </button>
        )}
      </div>

      {proof && <Proof c={c} explorer={explorer} />}
    </article>
  );
}

function Proof({ c, explorer }: { c: Cycle; explorer?: string }) {
  let pretty = c.payload_utf8 ?? "";
  try {
    if (pretty) pretty = JSON.stringify(JSON.parse(pretty), null, 2);
  } catch {
    /* raw */
  }
  return (
    <div className="detail">
      <div style={{ flex: "3 1 340px", minWidth: 0 }}>
        <div className="label">{T("The sealed decision", "Mühürlü karar")} (payload_utf8 · {c.payload_utf8 ? new TextEncoder().encode(c.payload_utf8).length : 0} bytes)</div>
        {pretty ? <pre>{pretty}</pre> : <p className="muted">{T("Published when the envelope is opened (revealed).", "Zarf açılınca (reveal) yayımlanır.")}</p>}
      </div>
      <dl className="kvrows" style={{ flex: "2 1 280px" }}>
        <dt>
          <Term plain={T("fingerprint", "parmak izi")} tech="commit_hash" />
        </dt>
        <dd>
          <Hash value={c.commit_hash} full />
        </dd>
        <dt>
          <Term plain={T("random code", "rastgele kod")} tech="salt_hex" />
        </dt>
        <dd>{c.salt_hex ? <Hash value={c.salt_hex} full /> : <span className="muted">{T("kept private until opened", "açılana kadar gizli")}</span>}</dd>
        <dt>{T("sealed tx", "mühür tx")} </dt>
        <dd>
          <ExplorerLink explorer={explorer} kind="tx" value={c.commit_tx} full />
        </dd>
        <dt>{T("opened tx", "açılış tx")}</dt>
        <dd>{c.reveal_tx ? <ExplorerLink explorer={explorer} kind="tx" value={c.reveal_tx} full /> : <span className="tag open">OPEN</span>}</dd>
      </dl>
    </div>
  );
}

function Stepper({ c }: { c: Cycle }) {
  const ordered = c.decisions.filter(isTrade);
  // simulated (practice) and filled orders count as done even without an OKX id
  const allIds = ordered.length > 0 && ordered.every((d) => d.okx_order_id || d.order_status === "simulated" || d.order_status === "filled");
  const t = (ms?: number) => (ms ? clock(ms) : "");
  type St = { label: string; cls: string; sub: string };
  const steps: St[] = [
    { label: T("Decided", "Karar"), cls: c.decided_at_ms !== undefined ? "done" : "pending", sub: t(c.decided_at_ms) || T("pending", "bekliyor") },
    { label: T("Sealed", "Mühür"), cls: c.commit_tx ? "done proof" : "fail", sub: c.commit_tx ? T("on-chain", "zincirde") : T("failed", "başarısız") },
    c.commit_tx
      ? ordered.length === 0
        ? { label: T("Order", "Emir"), cls: "skip", sub: T("no order", "emir yok") }
        : { label: T("Order", "Emir"), cls: allIds ? "done" : "pending", sub: allIds ? (c.dry_run ? T("simulated", "simüle") : T("sent", "gönderildi")) : T("pending", "bekliyor") }
      : { label: T("Order", "Emir"), cls: "fail", sub: T("not sent", "gönderilmedi") },
    { label: T("Opened", "Açıldı"), cls: c.reveal_tx ? "done proof" : c.commit_tx ? "pending" : "skip", sub: c.reveal_tx ? T("public", "herkese açık") : c.commit_tx ? T("pending", "bekliyor") : "—" },
    {
      label: T("Checked", "Kontrol"),
      cls: c.verified === true ? "done ok" : c.verified === false ? "fail" : c.commit_tx ? "pending" : "skip",
      sub: c.verified === true ? T("matches", "eşleşti") : c.verified === false ? T("mismatch", "uyuşmadı") : c.commit_tx ? T("pending", "bekliyor") : "—",
    },
  ];
  return (
    <ol className="stepper" aria-label={T("Check-in lifecycle", "Check-in yaşam döngüsü")}>
      {steps.map((st) => (
        <li key={st.label} className={`step ${st.cls}`}>
          <i aria-hidden="true" />
          <span className="step-l">{st.label}</span>
          <span className={`step-s ${st.sub === T("simulated", "simüle") ? "sim" : ""}`}>{st.sub}</span>
        </li>
      ))}
    </ol>
  );
}

function OrderStatus({ d, failed }: { d: Decision; failed: boolean }) {
  if (failed) return <span className="ostat fail">{T("NOT SENT", "GÖNDERİLMEDİ")}</span>;
  const st = d.order_status;
  const cls = st === "filled" ? "filled" : st === "simulated" ? "simulated" : st === "pending" ? "simulated" : "other";
  const label = st === "simulated" ? T("SIMULATED", "SİMÜLE") : st === "filled" ? T("FILLED", "GERÇEKLEŞTİ") : st === "pending" ? T("pending", "bekliyor") : (st ?? T("no status", "durum yok"));
  return (
    <span style={{ display: "grid", gap: 2, justifyItems: "end" }}>
      <span className={`ostat ${cls}`}>{label}</span>
      {d.okx_order_id && (
        <span className="mono dim" style={{ fontSize: 11 }} title="OKX order id">
          {d.okx_order_id}
        </span>
      )}
    </span>
  );
}

/** Round ids that appeared since the previous state (first render: none) → gold flash. */
function useFreshKeys(keys: string[]) {
  const seen = useRef<Set<string> | null>(null);
  const fresh = new Set(seen.current ? keys.filter((k) => !seen.current!.has(k)) : []);
  useEffect(() => {
    seen.current = new Set(keys);
  });
  return fresh;
}

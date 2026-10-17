import { useEffect, useMemo, useRef, useState } from "react";
import type { Cycle } from "../state";
import { computeCommit, isHex32, payloadMatchesRows } from "../verify";
import { checkReveal, parseOrderIds, readDecision, type ChainInfo, type RevealCall } from "../chain";
import { decideVerdict, type ChainRead, type RevealRead } from "../verifyLogic";
import { ExplorerLink } from "./Bits";
import { clock, coin, shortHash } from "../format";
import { T, tx } from "../i18n";

type Props = { cycle: Cycle; chain: ChainInfo; agentId?: string; agentName?: string; explorer?: string; demo?: boolean; onClose: () => void };
type Phase = "computing" | "reading" | "done";

/**
 * "Check it yourself": fingerprint keccak256(payload ‖ salt) computed in the browser, compared with the agent's file and with
 * GrailLedger.decisions(agentId, cycleId) on Fuji. Payload + salt come from the reveal tx only when that tx is proven to be
 * this agent's successful revealDecision on the ledger (R-003-1, R-010-3). The verdict itself is decideVerdict (R-010).
 */
export default function VerifySheet({ cycle, chain, agentId, agentName, explorer, demo, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("computing");
  const [chainRead, setChainRead] = useState<ChainRead | null>(null);
  const [onchainAt, setOnchainAt] = useState<number | undefined>();
  const [revealRead, setRevealRead] = useState<RevealRead | null>(null);
  const [revealCall, setRevealCall] = useState<RevealCall | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tamper, setTamper] = useState<{ payload: string; diff: string } | null>(null);

  const skipChain = !!(demo && cycle.synthetic);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const cycleNo = cycle.cycle_id;
  const claimsReveal = !!cycle.reveal_tx;

  useEffect(() => {
    let alive = true;
    const t0 = Date.now();
    setPhase("computing");
    setChainRead(null);
    setRevealRead(null);
    setRevealCall(null);
    (async () => {
      await new Promise((r) => setTimeout(r, 400)); // the hash is instant; 400 ms makes the moment visible
      if (!alive) return;
      setPhase("reading");
      let cr: ChainRead;
      let rr: RevealRead = { kind: "none" };
      let call: RevealCall | null = null;
      if (skipChain) cr = { kind: "skipped-demo" };
      else if (!agentId) cr = { kind: "error", error: "the agent has no on-chain ID yet" };
      else if (cycleNo === undefined) cr = { kind: "error", error: "this check-in has no number" };
      else {
        const [dec, rev] = await Promise.allSettled([
          readDecision(chain, agentId, cycleNo),
          // a placeholder reveal id (sample data) is not a network failure: there is simply nothing to read
          claimsReveal && isHex32(cycle.reveal_tx) ? checkReveal(chain, cycle.reveal_tx!, agentId, cycleNo) : Promise.resolve(null),
        ]);
        if (dec.status === "fulfilled") {
          cr = { kind: "ok", committed: dec.value.committed, commitHash: dec.value.commitHash, revealed: dec.value.revealed };
          if (alive) setOnchainAt(dec.value.committedAt);
        } else cr = { kind: "error", error: errText(dec.reason) };
        if (rev.status === "fulfilled" && rev.value) {
          rr = { kind: "ok", problems: rev.value.problems };
          call = rev.value.call;
        } else if (rev.status === "rejected") rr = { kind: "error", error: errText(rev.reason) };
      }
      if (!alive) return;
      setChainRead(cr);
      setRevealRead(rr);
      setRevealCall(call);
      await new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - t0))));
      if (alive) setPhase("done");
    })();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [chain, agentId, cycleNo, cycle.reveal_tx, claimsReveal, skipChain, attempt]);

  // Inputs: the reveal calldata is used only once it is bound to this ledger/agent/check-in (no problems); else the file.
  const revealBound = revealRead?.kind === "ok" && revealRead.problems.length === 0 && !!revealCall;
  const fromChain = revealBound;
  const basePayload = revealBound ? revealCall!.payloadUtf8 : cycle.payload_utf8;
  const salt = revealBound ? revealCall!.saltHex : cycle.salt_hex;
  const payload = tamper?.payload ?? basePayload;
  const usable = !!payload && !!salt && /^0x[0-9a-fA-F]{64}$/.test(salt);

  const local = useMemo(() => (usable ? computeCommit(payload!, salt!, cycle.commit_hash) : null), [usable, payload, salt, cycle.commit_hash]);
  const computed = local?.ok ? local.computed : undefined;
  const onchainHash = chainRead?.kind === "ok" && chainRead.committed ? chainRead.commitHash : undefined;
  const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

  const parsed = useMemo(() => {
    try {
      return payload ? (JSON.parse(payload) as { cycle_id?: unknown; agent?: unknown }) : null;
    } catch {
      return null;
    }
  }, [payload]);
  const cycleOk = parsed ? parsed.cycle_id === cycleNo : undefined;
  const agentOk = parsed && agentName ? parsed.agent === agentName : undefined;
  const rows = usable ? payloadMatchesRows(payload!, cycle.decisions) : null;

  const verdict =
    phase === "done" && chainRead && revealRead
      ? decideVerdict({
          usable,
          computed,
          stated: cycle.commit_hash,
          tampered: !!tamper,
          cycleOk,
          agentOk,
          rowsOk: rows ? rows.ok : null,
          stateClaimsReveal: claimsReveal,
          chain: chainRead,
          reveal: revealRead,
        })
      : null;
  const orders = revealBound ? parseOrderIds(revealCall!.okxOrderId) : null;

  const pretty = (() => {
    try {
      return payload ? JSON.stringify(JSON.parse(payload), null, 2) : "";
    } catch {
      return payload ?? "";
    }
  })();

  const cheat = () => {
    if (!basePayload) return;
    try {
      const p = JSON.parse(basePayload) as { decisions: { action: string; size_usdt: string; inst_id: string }[] };
      const i = p.decisions.findIndex((d) => d.action === "BUY" || d.action === "SELL");
      let diff: string;
      if (i >= 0) {
        const old = p.decisions[i].size_usdt;
        p.decisions[i].size_usdt = (Number(old) * 10).toFixed(2);
        diff = `decisions[${i}].size_usdt "${old}" → "${p.decisions[i].size_usdt}" (${coin(p.decisions[i].inst_id)})`;
      } else {
        p.decisions[0].action = "BUY";
        p.decisions[0].size_usdt = "5";
        diff = `decisions[0].action "HOLD" → "BUY" (${coin(p.decisions[0].inst_id)})`;
      }
      setTamper({ payload: JSON.stringify(p), diff });
    } catch {
      /* not JSON — nothing to tamper */
    }
  };

  const reading = phase !== "done";
  const chainErr = chainRead?.kind === "error" ? chainRead.error : null;

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={`Verify check-in ${cycle.id}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet">
        <header className="sheet-head">
          <div>
            <b>{T("Check it yourself", "Kendin kontrol et")}</b>
            <span className="muted"> · check-in #{cycle.id}</span>
          </div>
          <button className="btn sm" onClick={onClose} aria-label={T("Close", "Kapat")}>
            ✕
          </button>
        </header>

        <div className="sheet-body">
          <p className="lead">
            {T(
              "Your browser rebuilds the fingerprint from the opened decision and compares it with the seal on Avalanche. Nothing is sent to a server.",
              "Tarayıcın, açılmış karardan parmak izini (hash) yeniden hesaplar ve Avalanche'taki mühürle karşılaştırır. Hiçbir sunucuya bir şey gönderilmez.",
            )}
          </p>

          <ol className="checks-list">
            <CheckRow
              title={T("Fingerprint computed in your browser", "Tarayıcında hesaplanan parmak izi")}
              tech="keccak256(payload ‖ salt)"
              value={
                phase === "computing"
                  ? T("computing…", "hesaplanıyor…")
                  : usable
                    ? computed
                    : chainErr || revealRead?.kind === "error"
                      ? T("not computed: the opened decision lives on Avalanche, which could not be read", "hesaplanmadı: açılmış karar Avalanche'ta duruyor ve okunamadı")
                      : reading
                        ? T("waiting for the opened decision…", "açılmış karar bekleniyor…")
                        : T("Sample data — there is nothing real to check.", "Örnek veri — kontrol edilecek gerçek bir şey yok.")
              }
              mark={phase === "computing" || !usable || !cycle.commit_hash ? undefined : eq(computed, cycle.commit_hash)}
              note={usable ? (fromChain ? T("input read from the verified reveal transaction on Fuji", "girdi, Fuji'deki doğrulanmış reveal işleminden okundu") : T("input taken from the agent's file", "girdi agent'ın dosyasından alındı")) : undefined}
            />
            <CheckRow
              title={T("Fingerprint the agent reported", "Agent'ın bildirdiği parmak izi")}
              tech={cycle.fromChain ? "DecisionCommitted event · commitHash" : "state.json · commit_hash"}
              value={cycle.commit_hash ?? "—"}
              mark={!reading && onchainHash && cycle.commit_hash ? eq(cycle.commit_hash, onchainHash) : undefined}
              note={!reading ? (onchainHash ? T("compared with the seal on Avalanche", "Avalanche'taki mühürle karşılaştırıldı") : T("not compared: the seal on Avalanche was not read", "karşılaştırılmadı: Avalanche'taki mühür okunamadı")) : undefined}
            />
            <CheckRow
              title={T("Seal on Avalanche", "Avalanche'taki mühür")}
              tech={`GrailLedger.decisions(${agentId ?? "?"}, ${cycleNo ?? "?"})`}
              value={
                skipChain
                  ? T("demo check-in — never sent to Fuji, nothing to read", "demo check-in — Fuji'ye hiç gönderilmedi, okunacak bir şey yok")
                  : reading
                    ? phase === "reading"
                      ? T("reading Avalanche…", "Avalanche okunuyor…")
                      : T("waiting", "bekleniyor")
                    : chainErr
                      ? T(`could not read Avalanche (${chainErr})`, `Avalanche okunamadı (${chainErr})`)
                      : chainRead?.kind === "ok" && !chainRead.committed
                        ? T("not sealed on Avalanche", "Avalanche'ta mühürlenmemiş")
                        : onchainHash
              }
              warn={!reading && !!chainErr}
              mark={!reading && chainRead?.kind === "ok" && usable ? chainRead.committed && eq(computed, onchainHash) : undefined}
              note={
                chainRead?.kind === "ok" && chainRead.committed && onchainAt
                  ? T(
                      `sealed at ${clock(onchainAt * 1000)} · ${chainRead.revealed ? "opened (revealed)" : "not opened yet"} · contract ${shortHash(chain.ledger)}`,
                      `mühür saati ${clock(onchainAt * 1000)} · ${chainRead.revealed ? "açıldı (reveal)" : "henüz açılmadı"} · kontrat ${shortHash(chain.ledger)}`,
                    )
                  : undefined
              }
            />
            <CheckRow
              title={T("Opening on Avalanche", "Avalanche'taki açılış")}
              tech="revealDecision tx · receipt · DecisionRevealed"
              value={
                !claimsReveal
                  ? T("not opened yet", "henüz açılmadı")
                  : skipChain
                    ? T("demo check-in — nothing to read", "demo check-in — okunacak bir şey yok")
                    : reading
                      ? T("reading Avalanche…", "Avalanche okunuyor…")
                      : revealRead?.kind === "error"
                        ? T(`could not read the opening (${revealRead.error})`, `açılış okunamadı (${revealRead.error})`)
                        : revealRead?.kind === "ok" && revealRead.problems.length
                          ? revealRead.problems.map(tx).join(" · ")
                          : revealRead?.kind === "ok"
                            ? T(
                                `successful · sent by the agent · to GrailLedger · agent #${revealCall?.agentId} · check-in #${revealCall?.cycleId}`,
                                `başarılı · agent gönderdi · GrailLedger'a · agent #${revealCall?.agentId} · check-in #${revealCall?.cycleId}`,
                              )
                            : "—"
              }
              warn={!reading && revealRead?.kind === "error"}
              mark={!reading && revealRead?.kind === "ok" ? revealRead.problems.length === 0 : undefined}
            />
            <CheckRow
              title={T("It is the right agent and check-in", "Doğru agent ve doğru check-in")}
              tech="payload.cycle_id == cycleId · payload.agent == agent name"
              value={parsed ? T(`the sealed text says check-in ${String(parsed.cycle_id)}${agentName ? `, agent ${String(parsed.agent)}` : ""}`, `mühürlü metne göre check-in ${String(parsed.cycle_id)}${agentName ? `, agent ${String(parsed.agent)}` : ""}`) : "—"}
              mark={!reading && cycleOk !== undefined ? cycleOk && agentOk !== false : undefined}
            />
          </ol>

          {verdict && <Result kind={verdict.kind} reasons={verdict.reasons} cycle={cycle} at={onchainAt} tampered={!!tamper} hasLocal={usable && !!computed && !!cycle.commit_hash && eq(computed, cycle.commit_hash)} onRetry={() => setAttempt((a) => a + 1)} />}

          {phase === "done" && usable && (
            <div className="cheat">
              <b>{T("Try to cheat", "Hile yapmayı dene")}</b>
              <p className="muted">{T("Change one number and check again.", "Tek bir sayıyı değiştir ve yeniden kontrol et.")}</p>
              {tamper ? (
                <>
                  <p className="mono" style={{ color: "var(--sell)", fontSize: 12 }}>
                    {T("edited", "değiştirildi")}: {tamper.diff}
                  </p>
                  <button className="btn sm" onClick={() => setTamper(null)}>
                    {T("Put the original back", "Orijinali geri koy")}
                  </button>
                </>
              ) : (
                <button className="btn sm danger" onClick={cheat}>
                  {T("Change one number", "Bir sayıyı değiştir")}
                </button>
              )}
            </div>
          )}

          {phase === "done" && claimsReveal && !skipChain && (
            <section>
              <div className="label">{T("What happened to the orders · from the opening", "Emirlere ne oldu · açılıştan")}</div>
              {!orders ? (
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {T("Not shown: the opening transaction could not be verified, so its order results are not trusted.", "Gösterilmiyor: açılış işlemi doğrulanamadı, bu yüzden emir sonuçlarına güvenilmiyor.")}
                </p>
              ) : orders === "none" ? (
                <p className="muted">{T("No order was sent in this check-in.", "Bu check-in'de emir gönderilmedi.")}</p>
              ) : (
                <table className="table" style={{ marginTop: 6 }}>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.inst}>
                        <td style={{ fontWeight: 600 }}>{coin(o.inst)}</td>
                        <td className="r mono">
                          {o.id === "simulated" ? (
                            <span style={{ color: "var(--warn)" }}>{T("simulated (practice mode)", "simüle (deneme modu)")}</span>
                          ) : o.id === "unknown" ? (
                            <span style={{ color: "var(--warn)" }}>{T("unknown — checked later", "bilinmiyor — sonra kontrol edilir")}</span>
                          ) : (
                            <span title="OKX order id">OKX {T("order", "emir")} {o.id}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {orders && <p className="tech">okxOrderId (v0.6): {revealCall!.okxOrderId === "" ? '""' : revealCall!.okxOrderId}</p>}
            </section>
          )}

          {rows && !rows.ok && <p style={{ color: "var(--danger)", fontSize: 13 }}>✕ {tx(rows.note)}</p>}

          <details className="math">
            <summary>{T("Show the math", "Hesabı göster")}</summary>
            <p className="mono small">{T("fingerprint", "parmak izi")} = keccak256( utf8(payload_utf8) ‖ bytes(salt_hex) )</p>
            <div className="kvrows">
              <dt>salt</dt>
              <dd className="mono small">{salt ?? "—"}</dd>
              <dt>commit tx</dt>
              <dd>
                <ExplorerLink explorer={explorer} kind="tx" value={cycle.commit_tx} />
              </dd>
              <dt>reveal tx</dt>
              <dd>{cycle.reveal_tx ? <ExplorerLink explorer={explorer} kind="tx" value={cycle.reveal_tx} /> : T("not opened yet", "henüz açılmadı")}</dd>
            </div>
            <div className="label" style={{ marginTop: 12 }}>
              payload_utf8 · {payload ? new TextEncoder().encode(payload).length : 0} bytes {fromChain ? T("· from the verified reveal tx", "· doğrulanmış reveal tx'ten") : ""}
            </div>
            <pre className={tamper ? "tampered" : ""}>{pretty || "—"}</pre>
          </details>
        </div>
      </aside>
    </div>
  );
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Result({
  kind,
  reasons,
  cycle,
  at,
  tampered,
  hasLocal,
  onRetry,
}: {
  kind: "match" | "mismatch" | "unverified" | "demo" | "mock" | "not-opened";
  reasons: string[];
  cycle: Cycle;
  at?: number;
  tampered: boolean;
  hasLocal: boolean;
  onRetry: () => void;
}) {
  const n = cycle.decisions.length;
  if (kind === "match")
    return (
      <div className="result ok">
        <span className="result-mark" aria-hidden="true">
          ✓
        </span>
        <div>
          <b>{T("Match — you didn't have to trust us", "Eşleşti — bize güvenmek zorunda değilsin")}</b>
          <p>
            {T(
              `${n === 1 ? "The decision" : `All ${n} decisions`} in check-in #${cycle.id}${cycle.decisions.some((d) => d.action === "HOLD") ? ", holds included," : ""} ${n === 1 ? "is" : "are"} exactly what was sealed on Avalanche${at ? ` at ${clock(at * 1000)}` : ""}, before any order was sent.`,
              `Check-in #${cycle.id} içindeki ${n === 1 ? "karar" : `${n} kararın tamamı`}${cycle.decisions.some((d) => d.action === "HOLD") ? " (HOLD'lar dahil)" : ""}, herhangi bir emir gönderilmeden önce Avalanche'ta mühürlenenle birebir aynı${at ? ` (mühür saati ${clock(at * 1000)})` : ""}.`,
            )}
          </p>
        </div>
      </div>
    );
  if (kind === "mismatch")
    return (
      <div className="result bad">
        <span className="result-mark" aria-hidden="true">
          ✕
        </span>
        <div>
          <b>{T("Mismatch", "Uyuşmadı")}</b>
          <p>
            {tampered
              ? T("The edited decision no longer matches its seal. Changing a single digit breaks it.", "Değiştirilen karar artık mührüyle eşleşmiyor. Tek bir rakamı değiştirmek bile bozar.")
              : T("This decision does not match its seal on Avalanche.", "Bu karar Avalanche'taki mührüyle eşleşmiyor.")}
          </p>
          {reasons.length > 0 && (
            <ul className="reasons">
              {reasons.map((r) => (
                <li key={r}>{tx(r)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  if (kind === "unverified")
    return (
      <div className="result warn">
        <span className="result-mark" aria-hidden="true">
          !
        </span>
        <div>
          <b>{T("Could not reach Avalanche", "Avalanche'a ulaşılamadı")}</b>
          <p>
            {hasLocal
              ? T(
                  "Your browser's fingerprint matches the agent's file, but the seal on Avalanche was not checked, so this is not a verified match yet.",
                  "Tarayıcındaki parmak izi agent'ın dosyasıyla eşleşiyor ama Avalanche'taki mühür kontrol edilemedi, yani bu henüz doğrulanmış bir eşleşme değil.",
                )
              : T(
                  "The seal and the opening live on Avalanche and could not be read, so nothing has been checked yet.",
                  "Mühür ve açılış Avalanche'ta duruyor ve okunamadı, yani henüz hiçbir şey kontrol edilmedi.",
                )}
          </p>
          {reasons.length > 0 && <p className="tech">{reasons.map(tx).join(" · ")}</p>}
          <button className="btn sm" style={{ marginTop: 8 }} onClick={onRetry}>
            {T("Retry", "Tekrar dene")}
          </button>
        </div>
      </div>
    );
  const grey =
    kind === "demo"
      ? [
          T("Demo check-in — not on Avalanche", "Demo check-in — Avalanche'ta değil"),
          T("This check-in is made-up demo data. The fingerprint is consistent, but there is no seal to compare it with.", "Bu check-in uydurma demo verisi. Parmak izi tutarlı ama karşılaştırılacak bir mühür yok."),
        ]
      : kind === "not-opened"
        ? [
            T("Not opened yet — nothing to check", "Henüz açılmadı — kontrol edilecek bir şey yok"),
            T("The envelope is still sealed. The decision and its random code are published when it is opened.", "Zarf hâlâ mühürlü. Karar ve rastgele kodu (salt) zarf açılınca yayımlanır."),
          ]
        : [
            T("Sample data — nothing real to check", "Örnek veri — kontrol edilecek gerçek bir şey yok"),
            T("This state has placeholder values, so there is nothing real to check.", "Bu durumda yer tutucu değerler var, kontrol edilecek gerçek bir şey yok."),
          ];
  return (
    <div className="result grey">
      <span className="result-mark" aria-hidden="true">
        –
      </span>
      <div>
        <b>{grey[0]}</b>
        <p>{grey[1]}</p>
      </div>
    </div>
  );
}

function CheckRow({ title, tech, value, mark, note, warn }: { title: string; tech: string; value?: string; mark?: boolean; note?: string; warn?: boolean }) {
  return (
    <li className="check">
      <div>
        <div className="check-title">{title}</div>
        <div className="tech">{tech}</div>
        <div className="mono small check-value" style={warn ? { color: "var(--warn)" } : undefined}>
          {value ?? "—"}
        </div>
        {note && <div className="tech">{note}</div>}
      </div>
      {mark !== undefined ? (
        <span className={`mark ${mark ? "ok" : "bad"}`} aria-label={mark ? T("matches", "eşleşiyor") : T("does not match", "eşleşmiyor")}>
          {mark ? "✓" : "✕"}
        </span>
      ) : warn ? (
        <span className="mark warn" aria-label={T("not checked", "kontrol edilmedi")}>
          !
        </span>
      ) : null}
    </li>
  );
}

import { useMemo } from "react";
import { decisionDryRun, type Decision, type GrailState } from "../state";
import { DryTag, Empty, ExplorerLink, Section } from "../components/Bits";
import { chainHints } from "../verify";
import { dateTime } from "../format";

export default function Ledger({ s, chainJson }: { s: GrailState; chainJson: unknown }) {
  const hints = chainHints(chainJson);
  const c = s.chain;

  const cycles = useMemo(() => {
    const map = new Map<string, Decision[]>();
    for (const d of s.decisions) {
      const k = d.cycle_id !== undefined ? String(d.cycle_id) : "?";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    }
    return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [s.decisions]);

  const derived = {
    commits: cycles.filter(([, ds]) => ds.some((d) => d.commit_tx)).length,
    reveals: cycles.filter(([, ds]) => ds.some((d) => d.reveal_tx)).length,
  };
  const fromState = c.commits !== undefined;
  const commits = c.commits ?? derived.commits;
  const reveals = c.reveals ?? derived.reveals;
  const unrevealed = c.unrevealed ?? Math.max(0, commits - reveals);
  const agentId = c.agent_id ?? hints.agentId;
  const address = c.address ?? hints.address;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>On-chain sicil</h1>
          <p>
            Agent her döngüde önce kararın hash'ini Avalanche'a yazar (commit), sonra emri verir, en son kararın kendisini açıklar (reveal).
            Açıklanmayan commit'ler burada sayılır: kötü kararları gizlemek mümkün değil.
          </p>
        </div>
      </div>

      <div className="counters" role="group" aria-label="Sicil sayaçları">
        <div className="counter">
          <div className="big num">{commits}</div>
          <div className="lbl">karar mühürlendi (commit)</div>
        </div>
        <div className="counter">
          <div className="big num">{reveals}</div>
          <div className="lbl">karar açıklandı (reveal)</div>
        </div>
        <div className={`counter ${unrevealed > 0 ? "alert" : "clean"}`}>
          <div className="big num">{unrevealed}</div>
          <div className="lbl">
            {unrevealed > 0 ? "açıkta kalan commit: reveal bekliyor veya agent açıklamadı" : "açıkta kalan commit yok"}
          </div>
        </div>
      </div>
      <p className="faint" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
        {fromState ? "Sayaçlar agent'ın state kaydından." : "Sayaçlar state'teki karar listesinden türetildi (agent sayaç yazmadı)."} Son döngü için reveal
        birkaç saniye gecikebilir.
      </p>

      <Section title="Agent kimliği" meta="ERC-8004 IdentityRegistry">
        <dl className="identity">
          <dt>Agent</dt>
          <dd>{s.agent.name ?? "—"}</dd>
          <dt>ERC-8004 agentId</dt>
          <dd>
            {agentId !== undefined ? (
              <b className="num" style={{ fontSize: 18 }}>
                #{agentId}
              </b>
            ) : (
              <span className="faint">Kayıt bilgisi henüz yazılmadı (chain.json / state.chain.agent_id)</span>
            )}
          </dd>
          {c.identity_registry && (
            <>
              <dt>Identity registry</dt>
              <dd>
                <ExplorerLink explorer={c.explorer} kind="address" value={c.identity_registry} full />
              </dd>
            </>
          )}
          <dt>Sicil kontratı</dt>
          <dd>
            <ExplorerLink explorer={c.explorer} kind="address" value={address} full />
          </dd>
          <dt>Ağ</dt>
          <dd>
            {c.network === "fuji" ? "Avalanche Fuji C-Chain" : (c.network ?? "—")}
            {c.chain_id !== undefined && <span className="faint"> · chain id {c.chain_id}</span>}
          </dd>
          <dt>Explorer</dt>
          <dd>
            {c.explorer ? (
              <a className="link" href={c.explorer} target="_blank" rel="noreferrer">
                {c.explorer.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </dl>
      </Section>

      <Section title="Döngü kayıtları" meta={`${cycles.length} döngü state'te`}>
        {cycles.length === 0 ? (
          <Empty title="Henüz zincir kaydı yok">İlk döngü commit edildiğinde tx bağlantıları burada belirir.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Döngü</th>
                  <th>Zaman</th>
                  <th>Akış</th>
                  <th>Commit tx</th>
                  <th>Reveal tx</th>
                  <th>Mod</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map(([cid, ds]) => {
                  const head = ds[0];
                  const trades = ds.filter((d) => d.action === "BUY" || d.action === "SELL");
                  const reveal = ds.find((d) => d.reveal_tx)?.reveal_tx;
                  const revealed = !!reveal || ds.some((d) => d.verified);
                  const dry = decisionDryRun(head, s);
                  return (
                    <tr key={cid}>
                      <td>
                        <b className="num">#{cid}</b>
                      </td>
                      <td className="num faint">{dateTime(head.decided_at_ms)}</td>
                      <td>
                        <div className="timeline">
                          <span className={`tl ${head.commit_tx ? "done" : "open"}`}>{head.commit_tx ? "✓" : "…"} commit</span>
                          <span className={`tl ${trades.length ? "done" : "skip"}`} title={trades.length ? "" : "Bütün kararlar HOLD; emir yok"}>
                            {trades.length ? `${trades.length} emir${dry ? " (sim.)" : ""}` : "emir yok"}
                          </span>
                          <span className={`tl ${revealed ? "done" : "open"}`}>{revealed ? "✓ reveal" : "reveal bekliyor"}</span>
                        </div>
                      </td>
                      <td>
                        <ExplorerLink explorer={c.explorer} kind="tx" value={head.commit_tx} />
                      </td>
                      <td>
                        <ExplorerLink explorer={c.explorer} kind="tx" value={reveal} />
                      </td>
                      <td>
                        <DryTag dry={dry} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

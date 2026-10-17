import { useMemo, useState } from "react";
import type { Decision } from "../state";
import { checkOnChain, computeCommit, payloadMatchesRow, type ChainResult } from "../verify";
import { ExplorerLink } from "./Bits";

type Props = { d: Decision; explorer?: string; rpc: string; contract?: string; onClose: () => void };

/** "Bize güvenme, kendin hesapla": hash tarayıcıda hesaplanır, sonra zincirdeki commit tx'iyle karşılaştırılır. */
export default function VerifyPanel({ d, explorer, rpc, contract, onClose }: Props) {
  const original = d.payload_utf8 ?? "";
  const [payload, setPayload] = useState(original);
  const [chain, setChain] = useState<ChainResult | "loading" | null>(null);
  const salt = d.salt_hex ?? "";
  const edited = payload !== original;

  const local = useMemo(() => (payload && salt ? computeCommit(payload, salt, d.commit_hash) : null), [payload, salt, d.commit_hash]);
  const row = useMemo(() => (payload ? payloadMatchesRow(payload, d.inst_id, d.action, d.size_usdt) : null), [payload, d]);

  if (!d.payload_utf8 || !d.salt_hex) {
    return (
      <div className="verify" role="region" aria-label="Kendin doğrula">
        <h4>Bu karar henüz doğrulanamaz</h4>
        <p className="muted" style={{ margin: 0 }}>
          {d.reveal_tx || d.verified
            ? "State'te payload veya salt yok; agent bu döngüyü reveal etmiş görünüyor ama ham veriyi yazmamış."
            : "Döngü zincire commit edildi ama henüz reveal edilmedi. Salt reveal'a kadar gizli tutulur, bu yüzden hash şimdilik hesaplanamaz. Reveal edilmeyen her commit On-chain sicil ekranında açıkta kalan olarak sayılır; seçici gösterim yapılamaz."}
        </p>
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    );
  }

  const runChain = async () => {
    if (!local?.ok) return;
    setChain("loading");
    setChain(await checkOnChain(d.commit_tx, local.computed, rpc, contract));
  };

  return (
    <div className="verify" role="region" aria-label="Kendin doğrula">
      <h4>Kendin doğrula: döngü #{d.cycle_id ?? "?"}</h4>
      <p className="formula">commit_hash = keccak256( utf8(payload) ‖ salt )</p>

      <div className="steps">
        <div className="step">
          <span className="no">1</span>
          <div>
            <p>
              <b>Agent'ın mühürlediği karar metni</b>{" "}
              <span className="faint">(düzenleyebilirsiniz; tek karakter değişse hash tutmaz)</span>
            </p>
            <textarea value={payload} onChange={(e) => {
                setPayload(e.target.value);
                setChain(null);
              }} spellCheck={false} aria-label="Payload" />
            {edited && (
              <div className="edited">
                Metni değiştirdiniz.{" "}
                <button className="btn" style={{ padding: "2px 8px" }} onClick={() => {
                    setPayload(original);
                    setChain(null);
                  }}>
                  Orijinale dön
                </button>
              </div>
            )}
            <div className="hashline">
              <span className="faint">salt</span>
              <span className="mono">{salt}</span>
            </div>
          </div>
        </div>

        <div className={`step ${local?.ok && local.matches ? "ok" : "bad"}`}>
          <span className="no">2</span>
          <div>
            <p>
              <b>Tarayıcınızda hesaplanan hash</b>
            </p>
            {local && !local.ok ? (
              <p className="verdict bad">❌ {local.error}</p>
            ) : (
              local?.ok && (
                <>
                  <div className="hashline">
                    <span className="faint">hesaplanan</span>
                    <span className="mono">{local.computed}</span>
                    <span className="faint">state'teki</span>
                    <span className="mono">{d.commit_hash ?? "—"}</span>
                  </div>
                  <p className={`verdict ${local.matches ? "ok" : "bad"}`} style={{ marginTop: 6 }}>
                    {local.matches ? "✅ Eşleşiyor: karar metni commit'ten sonra değiştirilmemiş." : "❌ Eşleşmiyor: metin veya salt commit edilenle aynı değil."}
                  </p>
                  {local.saltBytes !== 32 && <p className="verdict wait">Uyarı: salt {local.saltBytes} bayt; sözleşme 32 bayt diyor.</p>}
                </>
              )
            )}
          </div>
        </div>

        {row && (
          <div className={`step ${row.ok ? "ok" : "bad"}`}>
            <span className="no">3</span>
            <div>
              <p>
                <b>Metindeki karar ekrandaki satırla aynı mı</b>
              </p>
              <p className={`verdict ${row.ok ? "ok" : "bad"}`}>
                {row.ok ? "✅" : "❌"} {row.note}
              </p>
            </div>
          </div>
        )}

        <div className={`step ${chain && chain !== "loading" ? (chain.kind === "match" ? "ok" : chain.kind === "skipped" || chain.kind === "unreachable" ? "" : "bad") : ""}`}>
          <span className="no">{row ? 4 : 3}</span>
          <div>
            <p>
              <b>Avalanche Fuji'deki commit işlemi bu hash'i taşıyor mu</b>
            </p>
            <p className="muted" style={{ margin: "2px 0 8px", fontSize: 13 }}>
              Commit tx: <ExplorerLink explorer={explorer} kind="tx" value={d.commit_tx} /> · salt-okunur RPC, cüzdan gerekmez
            </p>
            <button className="btn primary" onClick={runChain} disabled={!local?.ok || chain === "loading"}>
              {chain === "loading" ? "Zincir okunuyor…" : "Zincirde kontrol et"}
            </button>
            {chain && chain !== "loading" && <ChainVerdict r={chain} />}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="btn" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  );
}

function ChainVerdict({ r }: { r: ChainResult }) {
  const p = (cls: string, text: string) => (
    <p className={`verdict ${cls}`} style={{ marginTop: 8 }}>
      {text}
    </p>
  );
  switch (r.kind) {
    case "match":
      return p("ok", `✅ Zincirdeki commit tx'i bu hash'i içeriyor${r.block ? ` (blok ${r.block})` : ""}. Karar, emirden önce mühürlenmiş.`);
    case "mismatch":
      return p("bad", "❌ Tx bulundu ama calldata'sında bu hash yok.");
    case "wrong_contract":
      return p("bad", `❌ Tx başka bir kontrata gitmiş (${r.to}).`);
    case "not_found":
      return p("bad", "❌ Bu tx Fuji'de bulunamadı.");
    case "unreachable":
      return p("wait", `Fuji RPC'ye ulaşılamadı: ${r.error}. Yerel hash kontrolü yine de geçerli.`);
    case "skipped":
      return p("wait", `Zincir kontrolü yapılamadı: ${r.why}.`);
  }
}

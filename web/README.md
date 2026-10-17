# GRAIL web (T-005)

Vite + React + TypeScript. Dört ekran: Portföy (Holy Grail eğrisi + ρ kaydırıcısı), Karar akışı ("Kendin doğrula"), On-chain sicil, Yetki ve limitler.

```bash
npm install
npm run dev        # mock: ../contracts/state.example.json
npm run dev:demo   # gerçek hash'li demo verisi: fixtures/demo-state.json (zamanları tazelemek için önce: npm run fixture)
npm run build
```

Gerçek agent verisi: `GRAIL_STATE_PATH` (web/ klasörüne göre ya da mutlak yol). Dosya yoksa mock gösterilir ve üstte uyarı çıkar.

```bash
GRAIL_STATE_PATH="../../../Agentic Hack/runtime/state.json" npm run dev
```

- `/api/state` her istekte dosyayı yeniden okur; UI 3 sn'de bir yoklar.
- `/api/chain` → `GRAIL_CHAIN_PATH` yoksa `../contracts/chain.json` (opsiyonel: RPC, kontrat adresi, agentId).
- "Kendin doğrula": `keccak256(utf8(payload_utf8) ‖ salt_hex)` tarayıcıda (@noble/hashes) hesaplanır, `commit_hash` ile karşılaştırılır;
  ardından Fuji RPC'den `eth_getTransactionByHash(commit_tx)` ile calldata'nın bu hash'i taşıyıp taşımadığına bakılır (ABI gerekmez, cüzdan gerekmez).
- State okuyucu (`src/state.ts`) her alanı opsiyonel kabul eder; bilinmeyen alanlar yok sayılır.

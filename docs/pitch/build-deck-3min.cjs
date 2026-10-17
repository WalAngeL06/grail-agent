// GRAIL 3 dakikalık final sunumu (5 slayt). 11 slaytlık tam sürüm: build-deck.cjs (yedek).
// Çalıştır:  NODE_PATH=<pptxgenjs node_modules> node docs/pitch/build-deck-3min.cjs
// Sayı kaynakları: engine/out/replay.json + grinold-30d.md (role/engine@aa77641, T-017 açık), chain faf65cb audit (80/80),
// agents runtime/live (cycle 2 canlı emir), contracts/config.example.json. <TBD> = bilinmiyor; sayı uydurulmaz.
const pptxgen = require("pptxgenjs");
const path = require("path");

const OUT = path.join(__dirname, "GRAIL-pitch-3min.pptx");

const V = {
  motto: "Proof before profit.",
  mottoTr: "Önce kanıt, sonra kâr.",
  bets: "1,4",
  audit: "80/80",
  liveOrder: { when: "15:37", what: "BTC 2 USDT alım", okx: "4017748393474314240" },
  replay: { ddGrail: "%4,5", ddHold: "%14,5", retGrail: "+%1,6", retHold: "+%8,8" },
  maxOrder: "$10",
  maxTotal: "$50",
  pagesUrl: "<PAGES_URL>",
  repo: "github.com/WalAngeL06/grail-agent",
};

const C = {
  bg: "0B0E14", surface: "121722", surface2: "1A2130", border: "263043",
  text: "E6EAF2", muted: "8A94A8", dim: "5B6578",
  gold: "E8B04B", proof: "8B9CFF", green: "22C55E", sell: "F97066", warn: "F5A524", danger: "EF4444",
};
const HEAD = "Cambria";
const BODY = "Calibri";
const MONO = "Courier New";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "GRAIL — Proof before profit";
pres.author = "GRAIL";

function base(kicker, title) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  if (kicker) s.addText(kicker, { x: 0.5, y: 0.32, w: 9, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 3, margin: 0 });
  if (title) s.addText(title, { x: 0.5, y: 0.6, w: 9, h: 0.7, fontFace: HEAD, fontSize: 30, bold: true, color: C.text, margin: 0, valign: "top" });
  return s;
}
function card(s, x, y, w, h, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill || C.surface }, line: { color: C.border, width: 0.75 } });
}
function badge(s, x, y, label, color, d) {
  const dia = d || 0.42;
  const col = color || C.gold;
  s.addShape(pres.shapes.OVAL, { x, y, w: dia, h: dia, fill: { color: C.bg }, line: { color: col, width: 1.5 } });
  s.addText(label, { x, y, w: dia, h: dia, align: "center", valign: "middle", fontFace: BODY, fontSize: dia > 0.5 ? 16 : 13, bold: true, color: col, margin: 0 });
}
function timer(s, t) {
  s.addText(t, { x: 7.9, y: 0.32, w: 1.6, h: 0.3, fontFace: BODY, fontSize: 10, color: C.dim, align: "right", margin: 0 });
}

// ---------- 1 · Kanca (0:00–0:30) ----------
{
  const s = base(null, null);
  timer(s, "0:00–0:30");
  s.addText("OKX AGENT TRADE KIT  ×  AVALANCHE", { x: 0.5, y: 0.55, w: 5, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 3, margin: 0 });
  s.addText("GRAIL", { x: 0.5, y: 0.95, w: 5, h: 1.0, fontFace: HEAD, fontSize: 60, bold: true, color: C.text, margin: 0 });
  s.addText(V.motto, { x: 0.5, y: 2.0, w: 4.8, h: 0.55, fontFace: HEAD, fontSize: 26, bold: true, color: C.gold, margin: 0 });
  s.addText(V.mottoTr, { x: 0.5, y: 2.55, w: 4.8, h: 0.4, fontFace: BODY, fontSize: 18, color: C.muted, margin: 0 });
  s.addText([
    { text: "5 coin aldınız, ", options: { color: C.text, bold: true } },
    { text: "aslında " + V.bets + " bağımsız bahis (n_eff).", options: { color: C.muted } },
  ], { x: 0.5, y: 3.35, w: 4.8, h: 0.5, fontFace: BODY, fontSize: 17, margin: 0, valign: "top" });
  s.addText("Agentic Trading Hackathon · Ankara · 17 Ekim 2026", { x: 0.5, y: 4.85, w: 5, h: 0.3, fontFace: BODY, fontSize: 11, color: C.dim, margin: 0 });
  const coins = ["BTC", "ETH", "SOL", "AVAX", "OKB"];
  const pos = [[5.55, 2.05], [6.15, 1.85], [6.6, 2.4], [6.0, 2.65], [5.5, 2.75]];
  coins.forEach((c, i) => s.addShape(pres.shapes.OVAL, { x: pos[i][0], y: pos[i][1], w: 0.75, h: 0.75, fill: { color: C.surface2, transparency: 10 }, line: { color: C.muted, width: 1 } }));
  coins.forEach((c, i) => s.addText(c, { x: pos[i][0], y: pos[i][1], w: 0.75, h: 0.75, align: "center", valign: "middle", fontFace: BODY, fontSize: 10, bold: true, color: C.text, margin: 0 }));
  s.addText("5 coin", { x: 5.45, y: 3.6, w: 2.0, h: 0.3, align: "center", fontFace: BODY, fontSize: 12, color: C.muted, margin: 0 });
  s.addText("≈", { x: 7.45, y: 2.2, w: 0.45, h: 0.6, align: "center", fontFace: BODY, fontSize: 32, color: C.muted, margin: 0 });
  s.addShape(pres.shapes.OVAL, { x: 7.95, y: 1.75, w: 1.6, h: 1.6, fill: { color: C.bg }, line: { color: C.gold, width: 2.5 } });
  s.addText(V.bets, { x: 7.95, y: 1.75, w: 1.6, h: 1.6, align: "center", valign: "middle", fontFace: HEAD, fontSize: 30, bold: true, color: C.gold, margin: 0 });
  s.addText("bağımsız bahis · 30 gün ort.", { x: 7.6, y: 3.6, w: 2.3, h: 0.3, align: "center", fontFace: BODY, fontSize: 11, color: C.gold, margin: 0 });
  s.addNotes(
    "0:00–0:30 · 5 coin aldınız ama birlikte hareket ettikleri için son 30 günde aslında " + V.bets + " bağımsız bahis gibi davrandılar. " +
    "GRAIL bunu ölçen ve her kararını işlemden önce zincire mühürleyen bir ajan: Proof before profit, önce kanıt sonra kâr."
  );
}

// ---------- 2 · Problem (0:30–1:00) ----------
{
  const s = base("SORUN", "Bir AI ajanının sicili doğrulanamıyor");
  timer(s, "0:30–1:00");
  const rows = [
    ["1", "Test sonuçları seçilerek gösteriliyor", "Sadece iyi denemeler öne çıkarılıyor."],
    ["2", "Ekran görüntüsü düzenlenebilir", "Kâr gösteren bir resim kanıt değildir."],
    ["3", "Kararlar sonradan \"düzeltiliyor\"", "Piyasa hareket edince kayıtlar yeniden yazılabilir."],
  ];
  rows.forEach((r, i) => {
    const y = 1.55 + i * 0.95;
    card(s, 0.5, y, 8.95, 0.8);
    badge(s, 0.7, y + 0.19, r[0]);
    s.addText(r[1], { x: 1.3, y: y + 0.1, w: 7.9, h: 0.32, fontFace: BODY, fontSize: 16, bold: true, color: C.text, margin: 0 });
    s.addText(r[2], { x: 1.3, y: y + 0.42, w: 7.9, h: 0.3, fontFace: BODY, fontSize: 12, color: C.muted, margin: 0 });
  });
  s.addText([
    { text: "Kimin için: ", options: { bold: true, color: C.gold } },
    { text: "parasını bir AI ajanına emanet etmek isteyen ve önce kanıt görmek isteyen herkes.", options: { color: C.text } },
  ], { x: 0.5, y: 4.6, w: 9, h: 0.45, fontFace: BODY, fontSize: 14, margin: 0 });
  s.addNotes(
    "0:30–1:00 · Parasını bir AI ajanına emanet etmek isteyen biri bugün sadece iddia görüyor: seçilmiş testler, düzenlenebilir ekran görüntüleri, sonradan düzeltilen kayıtlar. " +
    "Ajanın sicilini kimse bağımsız olarak doğrulayamıyor."
  );
}

// ---------- 3 · Nasıl (1:00–1:45) ----------
{
  const s = base("NASIL ÇALIŞIR", "Önce mühür, sonra emir, sonra açılış");
  timer(s, "1:00–1:45");
  const steps = [
    ["1", "Mühürle", "Kararın parmak izi (hash) emirden önce Avalanche'a yazılır.", C.proof],
    ["2", "Emir", "OKX Agent Trade Kit ile OKX TR'de spot emir.", C.gold],
    ["3", "Aç", "Karar yayınlanır; herkes mühürle eşleştiğini kontrol eder.", C.proof],
  ];
  steps.forEach((st, i) => {
    const x = 0.5 + i * 3.1;
    card(s, x, 1.45, 2.75, 1.35);
    badge(s, x + 0.2, 1.6, st[0], st[3], 0.42);
    s.addText(st[1], { x: x + 0.75, y: 1.6, w: 1.85, h: 0.42, fontFace: HEAD, fontSize: 18, bold: true, color: C.text, valign: "middle", margin: 0 });
    s.addText(st[2], { x: x + 0.2, y: 2.1, w: 2.35, h: 0.65, fontFace: BODY, fontSize: 11.5, color: C.muted, margin: 0, valign: "top" });
    if (i < 2) s.addText("→", { x: x + 2.75, y: 1.85, w: 0.35, h: 0.5, fontFace: BODY, fontSize: 20, color: C.gold, align: "center", margin: 0 });
  });
  card(s, 0.5, 2.95, 4.35, 1.45, C.surface2);
  s.addText("Rejime göre strateji (Hurst tahmini)", { x: 0.7, y: 3.05, w: 4.0, h: 0.32, fontFace: BODY, fontSize: 13, bold: true, color: C.gold, margin: 0 });
  s.addText([
    { text: "Trend → ", options: { bold: true, color: C.gold } },
    { text: "momentum", options: { color: C.text, breakLine: true } },
    { text: "Yatay → ", options: { bold: true, color: C.gold } },
    { text: "ortalamaya dönüş (Ornstein-Uhlenbeck)", options: { color: C.text } },
  ], { x: 0.7, y: 3.42, w: 4.0, h: 0.6, fontFace: BODY, fontSize: 13, margin: 0, valign: "top" });
  s.addText("48 barlık Hurst bir tahmindir, kesin tespit değil.", { x: 0.7, y: 4.05, w: 4.0, h: 0.3, fontFace: BODY, fontSize: 10, italic: true, color: C.muted, margin: 0 });
  card(s, 5.1, 2.95, 4.35, 1.45, C.surface2);
  s.addText("Limitler kodda", { x: 5.3, y: 3.05, w: 4.0, h: 0.32, fontFace: BODY, fontSize: 13, bold: true, color: C.gold, margin: 0 });
  s.addText([
    { text: "Sadece spot · kaldıraç yok · para çekme yok", options: { breakLine: true } },
    { text: "Emir başı " + V.maxOrder + ", toplam " + V.maxTotal, options: { breakLine: true } },
    { text: "Acil durdurma (kill switch) · AI sadece azaltır" },
  ], { x: 5.3, y: 3.42, w: 4.0, h: 0.9, fontFace: BODY, fontSize: 12, color: C.text, margin: 0, valign: "top", paraSpaceAfter: 2 });
  s.addText("Her 90 saniyede, insan tıklaması olmadan. Gerçek moda geçişi sadece insan açar.", { x: 0.5, y: 4.6, w: 9, h: 0.4, fontFace: BODY, fontSize: 13, italic: true, color: C.muted, margin: 0 });
  s.addNotes(
    "1:00–1:45 · Ajan her 90 saniyede kararını önce Avalanche'a mühürlüyor, sonra OKX'te emri veriyor, sonra kararı açıyor; trend varsa momentum, piyasa yatay görünüyorsa ortalamaya dönüş seçiyor. " +
    "Limitler kodda: sadece spot, kaldıraç ve para çekme yok, emir başı 10, toplam 50 dolar, yapay zekâ sadece azaltabilir."
  );
}

// ---------- 4 · Canlı kanıt (1:45–2:40) ----------
{
  const s = base("CANLI KANIT", "Bize güvenme, doğrula");
  timer(s, "1:45–2:40");
  const tiles = [
    ["✓", "Verify yourself", "(kendin doğrula) tarayıcın mührü Avalanche'tan okur → yeşil", C.green],
    ["✕", "Try to cheat", "(hile yapmayı dene) tek bir sayıyı değiştir → kırmızı", C.sell],
    ["1", "İlk gerçek emir " + V.liveOrder.when, V.liveOrder.what + " · OKX " + V.liveOrder.okx, C.gold],
    ["≡", "npm run audit", "bütün sicil: " + V.audit + " MATCH, 0 açılmamış", C.proof],
  ];
  tiles.forEach((t, i) => {
    const x = 0.5 + (i % 2) * 4.6;
    const y = 1.45 + Math.floor(i / 2) * 1.2;
    card(s, x, y, 4.35, 1.05, i < 2 ? C.surface2 : C.surface);
    badge(s, x + 0.2, y + 0.3, t[0], t[3], 0.45);
    s.addText(t[1], { x: x + 0.8, y: y + 0.12, w: 3.4, h: 0.38, fontFace: BODY, fontSize: 15, bold: true, color: t[3] === C.gold ? C.text : t[3], margin: 0, valign: "middle" });
    s.addText(t[2], { x: x + 0.8, y: y + 0.5, w: 3.4, h: 0.48, fontFace: BODY, fontSize: 11, color: C.muted, margin: 0, valign: "top" });
  });
  card(s, 0.5, 3.95, 8.95, 1.1, C.surface2);
  s.addText([
    { text: "Dürüst sonuç: ", options: { bold: true, color: C.gold } },
    { text: "30 gün tekrar oynatmada en kötü düşüş " + V.replay.ddGrail + " (al-tut " + V.replay.ddHold + "), getiri " + V.replay.retGrail + " (al-tut " + V.replay.retHold + "). ", options: { color: C.text } },
    { text: "İsabet (IC) iddiamız yok; ölçtüğümüz ve yönettiğimiz şey genişlik (n_eff " + V.bets + ").", options: { color: C.text } },
  ], { x: 0.75, y: 3.95, w: 8.5, h: 1.1, fontFace: BODY, fontSize: 13, valign: "middle", margin: 0 });
  s.addNotes(
    "1:45–2:40 · Siteye geç: Kararlar'da bir kartta Verify yourself'e basıyorum, tarayıcı mührü Avalanche'tan okuyup yeşil gösteriyor; Try to cheat ile tek bir sayıyı değiştirince kırmızıya dönüyor. " +
    "İlk gerçek emir bugün 15:37'de verildi ve npm run audit bütün sicilin " + V.audit + " eşleştiğini gösteriyor; getiride al-tutu geçtiğimizi iddia etmiyoruz, düşüşü yarıdan fazla azalttık."
  );
}

// ---------- 5 · Kapanış (2:40–3:00) ----------
{
  const s = base(null, null);
  timer(s, "2:40–3:00");
  s.addText("GRAIL", { x: 0.5, y: 0.75, w: 9, h: 0.8, fontFace: HEAD, fontSize: 40, bold: true, color: C.text, margin: 0 });
  s.addText(V.motto, { x: 0.5, y: 1.55, w: 9, h: 0.8, fontFace: HEAD, fontSize: 44, bold: true, color: C.gold, margin: 0 });
  s.addText(V.mottoTr, { x: 0.5, y: 2.35, w: 9, h: 0.5, fontFace: BODY, fontSize: 22, color: C.muted, margin: 0 });
  s.addText("Bize güvenme, doğrula.", { x: 0.5, y: 3.15, w: 9, h: 0.55, fontFace: HEAD, fontSize: 26, bold: true, color: C.text, margin: 0 });
  s.addText([
    { text: "Canlı demo: ", options: { color: C.muted } },
    { text: V.pagesUrl, options: { color: C.proof, fontFace: MONO } },
    { text: "    Kod: ", options: { color: C.muted } },
    { text: V.repo, options: { color: C.proof, fontFace: MONO } },
  ], { x: 0.5, y: 4.55, w: 9, h: 0.35, fontFace: BODY, fontSize: 12, margin: 0 });
  s.addNotes(
    "2:40–3:00 · GRAIL kârı vaat etmiyor, kanıtı veriyor: her karar emirden önce mühürlü ve herkes kontrol edebilir. " +
    "Proof before profit, önce kanıt sonra kâr; bize güvenmeyin, doğrulayın."
  );
}

pres.writeFile({ fileName: OUT }).then((f) => console.log("wrote " + f));

// GRAIL sunum üreticisi (T-011; final sunum Türkçe). Kaynak: docs/pitch-outline.md, sade dil.
// Çalıştır:  npm i pptxgenjs@3.12.0  (herhangi bir klasörde; NODE_PATH'i o node_modules'e ver)  →  node docs/pitch/build-deck.cjs
// <TBD> = henüz bilinmiyor; sayı uydurulmaz. Ekran/UI etiketleri İngilizce kalır (site İngilizce).
const pptxgen = require("pptxgenjs");
const path = require("path");

const OUT = path.join(__dirname, "GRAIL-pitch.pptx");

// Doğrulanmış değerler: coord/STATE.md r31, contracts/chain.json, contracts/config.example.json,
// engine/out/replay.json (role/engine@87539f8, T-014 sonrası), Fuji commitCount/revealCount(1) = 31/31 @ 16:29.
const V = {
  bets: "1,36",              // 30 günlük ortalama bağımsız bahis (replay)
  cyclesOnChain: "40+",      // Fuji commitCount = revealCount = 42 @16:47, açık 0 (alt sınır olarak 40+)
  liveOrder: { when: "17 Ekim 15:37", what: "BTC 2 USDT alım", okx: "4017748393474314240", commit: "0x16f2…9569", reveal: "0xae65…41f7" },
  replay: {
    ddGrail: "%4,3", ddHold: "%14,5", ddOld: "%7,5", retGrail: "+%2,0", retHold: "+%8,8",
    tradesOld: "382", tradesNew: "220",
  },
  cycleSeconds: "90",
  maxOrder: "$10",
  maxTotal: "$50",
  killPct: "%5",
  agentId: "1",
  ledger: "0x1B5fcf6DeFf2F9375338A2C35932224522118851",
  testsEngine: "167",
  testsAgents: "157",
  testsChain: "48",
  backupVideo: "<TBD>",
  repo: "github.com/WalAngeL06/grail-agent",
};

// Palet = docs/ui-brief.md §3 (sunum ürünle aynı görünür)
const C = {
  bg: "0B0E14", surface: "121722", surface2: "1A2130", border: "263043",
  text: "E6EAF2", muted: "8A94A8", dim: "5B6578",
  gold: "E8B04B", proof: "8B9CFF", green: "22C55E", sell: "F97066", warn: "F5A524", danger: "EF4444",
};
const HEAD = "Cambria";
const BODY = "Calibri";
const MONO = "Courier New";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.title = "GRAIL — sicili doğrulanabilen otonom alım-satım ajanı";
pres.author = "GRAIL";

function base(kicker, title) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  if (kicker) {
    s.addText(kicker, { x: 0.5, y: 0.32, w: 9, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 3, margin: 0 });
  }
  if (title) {
    s.addText(title, { x: 0.5, y: 0.6, w: 9, h: 0.7, fontFace: HEAD, fontSize: 30, bold: true, color: C.text, margin: 0, valign: "top" });
  }
  return s;
}

function card(s, x, y, w, h, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill || C.surface }, line: { color: C.border, width: 0.75 } });
}

// Motif: altın çerçeveli daire içinde numara/işaret
function badge(s, x, y, label, color, d) {
  const dia = d || 0.42;
  const col = color || C.gold;
  s.addShape(pres.shapes.OVAL, { x, y, w: dia, h: dia, fill: { color: C.bg }, line: { color: col, width: 1.5 } });
  s.addText(label, { x, y, w: dia, h: dia, align: "center", valign: "middle", fontFace: BODY, fontSize: dia > 0.5 ? 16 : 13, bold: true, color: col, margin: 0 });
}

// ---------- 1 · Giriş ----------
{
  const s = base(null, null);
  s.addText("OKX AGENT TRADE KIT  ×  AVALANCHE", { x: 0.5, y: 0.55, w: 5, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 3, margin: 0 });
  s.addText("GRAIL", { x: 0.5, y: 0.95, w: 5, h: 1.0, fontFace: HEAD, fontSize: 60, bold: true, color: C.text, margin: 0 });
  s.addText("Sicili herkesçe doğrulanabilen otonom alım-satım ajanı.", { x: 0.5, y: 2.0, w: 4.6, h: 0.9, fontFace: BODY, fontSize: 22, color: C.muted, margin: 0, valign: "top" });
  s.addText([
    { text: "5 coin tutuyorsun. ", options: { color: C.text } },
    { text: "Birlikte hareket ettikleri için son 30 günde ortalama " + V.bets + " bağımsız bahis (n_eff) gibi davrandılar.", options: { color: C.muted } },
  ], { x: 0.5, y: 3.15, w: 4.6, h: 0.8, fontFace: BODY, fontSize: 15, margin: 0, valign: "top" });
  s.addText("Agentic Trading Hackathon · Ankara · 17 Ekim 2026", { x: 0.5, y: 4.85, w: 5, h: 0.3, fontFace: BODY, fontSize: 11, color: C.dim, margin: 0 });

  // 5 iç içe coin  ≈  tek altın "bahis" dairesi
  const coins = ["BTC", "ETH", "SOL", "AVAX", "OKB"];
  const pos = [[5.55, 2.05], [6.15, 1.85], [6.6, 2.4], [6.0, 2.65], [5.5, 2.75]];
  coins.forEach((c, i) => {
    s.addShape(pres.shapes.OVAL, { x: pos[i][0], y: pos[i][1], w: 0.75, h: 0.75, fill: { color: C.surface2, transparency: 10 }, line: { color: C.muted, width: 1 } });
  });
  // etiketler bütün dairelerden sonra; hiçbir daire bir etiketi örtmesin
  coins.forEach((c, i) => {
    s.addText(c, { x: pos[i][0], y: pos[i][1], w: 0.75, h: 0.75, align: "center", valign: "middle", fontFace: BODY, fontSize: 10, bold: true, color: C.text, margin: 0 });
  });
  s.addText("5 coin", { x: 5.45, y: 3.6, w: 2.0, h: 0.3, align: "center", fontFace: BODY, fontSize: 12, color: C.muted, margin: 0 });
  s.addText("≈", { x: 7.45, y: 2.2, w: 0.45, h: 0.6, align: "center", fontFace: BODY, fontSize: 32, color: C.muted, margin: 0 });
  s.addShape(pres.shapes.OVAL, { x: 7.95, y: 1.75, w: 1.6, h: 1.6, fill: { color: C.bg }, line: { color: C.gold, width: 2.5 } });
  s.addText(V.bets, { x: 7.95, y: 1.75, w: 1.6, h: 1.6, align: "center", valign: "middle", fontFace: HEAD, fontSize: 26, bold: true, color: C.gold, margin: 0 });
  s.addText("bağımsız bahis · 30 gün ort.", { x: 7.6, y: 3.6, w: 2.3, h: 0.3, align: "center", fontFace: BODY, fontSize: 11, color: C.gold, margin: 0 });
  s.addNotes(
    "Ekibi değil, sayıyı söyleyerek aç. \"Beş coin aldınız. Birlikte yükselip düştükleri için son 30 günde ortalama " + V.bets +
    " bağımsız bahis gibi davrandılar. Bu coinleri sizin yerinize bir yapay zekâ ajanı yönetseydi, onun sicilini de kontrol edemezdiniz. GRAIL ikisini birden çözüyor.\""
  );
}

// ---------- 2 · Sorun ----------
{
  const s = base("SORUN", "Bir ajanın sicilini kontrol edemezsin");
  const rows = [
    ["1", "Test sonuçları seçilerek gösteriliyor", "Sadece iyi denemeler öne çıkarılıyor."],
    ["2", "Ekran görüntüsü düzenlenebilir", "Kâr gösteren bir resim kanıt değildir."],
    ["3", "Kararlar sonradan \"düzeltiliyor\"", "Piyasa hareket edince kayıtlar yeniden yazılabilir."],
  ];
  rows.forEach((r, i) => {
    const y = 1.55 + i * 0.95;
    card(s, 0.5, y, 4.6, 0.8);
    badge(s, 0.7, y + 0.19, r[0]);
    s.addText(r[1], { x: 1.3, y: y + 0.1, w: 3.7, h: 0.32, fontFace: BODY, fontSize: 15, bold: true, color: C.text, margin: 0 });
    s.addText(r[2], { x: 1.3, y: y + 0.42, w: 3.7, h: 0.3, fontFace: BODY, fontSize: 12, color: C.muted, margin: 0 });
  });
  card(s, 5.4, 1.55, 4.1, 2.7, C.surface2);
  s.addText("\"Çeşitlendirilmiş\" çoğu zaman tek bahistir", { x: 5.65, y: 1.75, w: 3.6, h: 0.7, fontFace: HEAD, fontSize: 18, bold: true, color: C.gold, margin: 0, valign: "top" });
  s.addText("Kripto coinlerin çoğu birlikte yükselip düşer. Beş tane almak güvenli hissettirir ama neredeyse tek bir bahis gibi davranır.",
    { x: 5.65, y: 2.5, w: 3.6, h: 1.0, fontFace: BODY, fontSize: 14, color: C.text, margin: 0, valign: "top" });
  [0, 1, 2, 3, 4].forEach((i) => {
    s.addShape(pres.shapes.OVAL, { x: 5.75 + i * 0.32, y: 3.55, w: 0.5, h: 0.5, fill: { color: C.surface, transparency: 20 }, line: { color: C.muted, width: 1 } });
  });
  s.addText("≈ " + V.bets + " bahis", { x: 7.7, y: 3.55, w: 1.65, h: 0.5, fontFace: BODY, fontSize: 14, bold: true, color: C.gold, valign: "middle", margin: 0 });
  s.addText([
    { text: "Kimin için: ", options: { bold: true, color: C.gold } },
    { text: "parasını bir yapay zekâ ajanına emanet etmek isteyen ve önce kanıt görmek isteyen herkes.", options: { color: C.text } },
  ], { x: 0.5, y: 4.6, w: 9, h: 0.45, fontFace: BODY, fontSize: 14, margin: 0 });
  s.addNotes(
    "Jürinin 'sorun ve hedef kullanıcı' sorusunun doğrudan cevabı. Tek nefeste söyle: insanlar parayı alım-satım ajanlarına emanet etmek istiyor, " +
    "ama hiçbir ajan geçmişini kanıtlayamıyor. Üstelik 'çeşitlendirilmiş' kripto portföylerin çoğu aslında tek bir bahis. Sonra geç."
  );
}

// ---------- 3 · Bağımsız bahis ----------
{
  const s = base("FİKİR", "Coin'i değil, bahsi say");
  const labels = Array.from({ length: 20 }, (_, i) => String(i + 1));
  const series = [[0.2, "Nadiren birlikte hareket ediyor"], [0.5, "Sık sık birlikte"], [0.8, "Neredeyse hep birlikte"]].map(([rho, name]) => ({
    name,
    labels,
    values: labels.map((_, i) => { const n = i + 1; return Math.round((n / (1 + (n - 1) * rho)) * 100) / 100; }),
  }));
  s.addChart(pres.charts.LINE, series, {
    x: 0.4, y: 1.4, w: 5.7, h: 3.75,
    chartColors: [C.green, C.proof, C.gold],
    lineSize: 2.5, lineDataSymbol: "none",
    showTitle: true, title: "Bağımsız bahis (n_eff) ve coin sayısı", titleColor: C.text, titleFontFace: BODY, titleFontSize: 12,
    showLegend: true, legendPos: "b", legendColor: C.muted, legendFontFace: BODY, legendFontSize: 9,
    catAxisLabelColor: C.muted, valAxisLabelColor: C.muted, catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
    catAxisLabelFrequency: 1,
    showCatAxisTitle: true, catAxisTitle: "Coin sayısı", catAxisTitleColor: C.muted, catAxisTitleFontSize: 10,
    showValAxisTitle: true, valAxisTitle: "Bağımsız bahis", valAxisTitleColor: C.muted, valAxisTitleFontSize: 10,
    valGridLine: { color: C.border, size: 0.5 }, catGridLine: { style: "none" },
    catAxisLineColor: C.border, valAxisLineColor: C.border,
    plotArea: { fill: { color: C.surface } }, chartArea: { fill: { color: C.surface }, roundedCorners: false },
  });
  card(s, 6.4, 1.4, 3.1, 1.55, C.surface2);
  s.addText("Son 30 gün", { x: 6.6, y: 1.5, w: 2.7, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 2, margin: 0 });
  s.addText(V.bets, { x: 6.6, y: 1.8, w: 2.7, h: 0.6, fontFace: HEAD, fontSize: 30, bold: true, color: C.gold, margin: 0 });
  s.addText("5 coin'den ortalama bağımsız bahis (gerçek OKX fiyatlarıyla tekrar oynatma)", { x: 6.6, y: 2.4, w: 2.7, h: 0.5, fontFace: BODY, fontSize: 11, color: C.muted, margin: 0, valign: "top" });
  s.addText([
    { text: "Birlikte hareket eden coinler tek bahis sayılır.", options: { bullet: true, breakLine: true } },
    { text: "Aynı türden coin eklemek neredeyse hiçbir şey katmaz.", options: { bullet: true, breakLine: true } },
    { text: "GRAIL parayı coin sayısına göre değil, birlikte hareketlerine göre dağıtır.", options: { bullet: true } },
  ], { x: 6.4, y: 3.15, w: 3.1, h: 2.0, fontFace: BODY, fontSize: 13, color: C.text, paraSpaceAfter: 6, margin: 0, valign: "top" });
  s.addNotes(
    "Ray Dalio'nun 'Kutsal Kâse' (Holy Grail) fikri, sade haliyle. Eğri, coin ekledikçe kaç gerçekten bağımsız bahis elde ettiğini gösteriyor. " +
    "Coinler birlikte hareket ediyorsa (altın çizgi) eğri hemen düzleşir: onuncu coin neredeyse hiçbir şey katmaz. " +
    "Canlı panelde 'you are here' noktası ve birlikte hareketi değiştiren bir kaydırıcı var. " +
    "Arka planda motor N / (1 + (N-1) x ortalama korelasyon) kullanıyor, ama bunu basitçe anlat."
  );
}

// ---------- 4 · Ürün ----------
{
  const s = base("ÜRÜN", "GRAIL dört adımda ne yapar");
  const steps = [
    ["1", "Bak", "OKX Agent Trade Kit ile OKX TR'den fiyatları, fiyat geçmişini ve hesap bakiyesini okur."],
    ["2", "Karar ver", "Sabit matematik her coin için al, sat ya da bekle der. Aynı veri, aynı karar."],
    ["3", "Mühürle", "Kararı, emir verilmeden önce Avalanche'a kilitler."],
    ["4", "Göster", "Herkesin her kararı yeniden kontrol edebildiği bir panel."],
  ];
  steps.forEach((st, i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 1.5, 2.05, 2.65);
    badge(s, x + 0.2, 1.7, st[0], i === 2 ? C.proof : C.gold, 0.5);
    s.addText(st[1], { x: x + 0.2, y: 2.35, w: 1.7, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: C.text, margin: 0 });
    s.addText(st[2], { x: x + 0.2, y: 2.8, w: 1.7, h: 1.3, fontFace: BODY, fontSize: 12, color: C.muted, margin: 0, valign: "top" });
  });
  card(s, 0.5, 4.4, 8.95, 0.7, C.surface2);
  s.addText([
    { text: "Yapay zekâ sadece hayır diyebilir. ", options: { bold: true, color: C.gold } },
    { text: "Her alımı bir yapay zekâ ikinci kez kontrol eder: küçültebilir ya da iptal edebilir, asla büyütemez.", options: { color: C.text } },
  ], { x: 0.75, y: 4.4, w: 8.5, h: 0.7, fontFace: BODY, fontSize: 14, valign: "middle", margin: 0 });
  s.addNotes(
    "Dört parça: bak, karar ver, mühürle, göster. Para kararlarının yapay zekânın keyfine değil, sabit matematiğe bağlı olduğunu vurgula. " +
    "Yapay zekâ (bir dil modeli) sadece bir güvenlik kontrolü: bir alımı küçültebilir ya da iptal edebilir, asla risk ekleyemez ve satışlara dokunmaz. " +
    "Yapay zekâ yoksa ya da yavaşsa karar değişmeden geçer ve bu da kayda yazılır."
  );
}

// ---------- 5 · Akıllı giriş ----------
{
  const s = base("AKILLI GİRİŞ", "Alımdan önce iki kapı");
  const gates = [
    ["1", "Piyasa yatay mı? (Hurst)", "Son 48 saatlik fiyattan bir tahmin: fiyat bir yöne mi gidiyor, yoksa bir aşağı bir yukarı mı? Kısa geçmişte gürültülüdür; kesin tespit değil, temkin sinyalidir."],
    ["2", "Kırılım geri test edildi mi?", "Fiyat eski tepeyi aştıysa, alımdan önce o seviyeye geri dönüp tutunmasını bekler."],
  ];
  gates.forEach((g, i) => {
    const y = 1.45 + i * 1.5;
    card(s, 0.5, y, 4.35, 1.35);
    badge(s, 0.7, y + 0.18, g[0]);
    s.addText(g[1], { x: 1.3, y: y + 0.18, w: 3.4, h: 0.42, fontFace: BODY, fontSize: 15, bold: true, color: C.text, valign: "middle", margin: 0 });
    s.addText(g[2], { x: 0.7, y: y + 0.68, w: 4.0, h: 0.62, fontFace: BODY, fontSize: 11, color: C.muted, margin: 0, valign: "top" });
  });
  card(s, 5.1, 1.45, 4.35, 2.85, C.surface2);
  s.addText("Durum → alım büyüklüğü", { x: 5.35, y: 1.6, w: 3.9, h: 0.35, fontFace: BODY, fontSize: 13, bold: true, color: C.gold, margin: 0 });
  const rows = [
    ["Piyasa yatay görünüyor (Hurst < 0,45)", "0 · bekle", C.muted],
    ["Kırılım var, geri test yok", "0 · bekle", C.muted],
    ["Henüz kırılım yok", "yarım", C.text],
    ["Kırılım + geri test", "tam", C.green],
  ];
  rows.forEach((r, i) => {
    const y = 2.05 + i * 0.55;
    s.addShape(pres.shapes.LINE, { x: 5.35, y: y - 0.04, w: 3.9, h: 0, line: { color: C.border, width: 0.75 } });
    s.addText(r[0], { x: 5.35, y, w: 2.75, h: 0.46, fontFace: BODY, fontSize: 12, color: C.text, valign: "middle", margin: 0 });
    s.addText(r[1], { x: 8.1, y, w: 1.15, h: 0.46, fontFace: BODY, fontSize: 13, bold: true, color: r[2], align: "right", valign: "middle", margin: 0 });
  });
  card(s, 0.5, 4.5, 8.95, 0.7, C.surface2);
  s.addText([
    { text: "Kapılar sadece azaltır, asla alım üretmez. ", options: { bold: true, color: C.gold } },
    { text: "Satışlara dokunmaz. 30 günlük tekrar oynatmada işlem " + V.replay.tradesOld + " → " + V.replay.tradesNew +
      ", en kötü düşüş " + V.replay.ddOld + " → " + V.replay.ddGrail + ".", options: { color: C.text } },
  ], { x: 0.75, y: 4.5, w: 8.5, h: 0.7, fontFace: BODY, fontSize: 13, valign: "middle", margin: 0 });
  s.addNotes(
    "Trend pozitif bir coin için bile hemen almıyoruz; iki kapıdan geçiyor. Birincisi: piyasa yatay mı? Bunu Hurst değeriyle TAHMİN ediyoruz. " +
    "48 saatlik veride bu tahmin gürültülü; o yüzden 'tespit' demiyoruz, bir temkin sinyali diyoruz. Yatay görünüyorsa momentum alımını bekletiyoruz. " +
    "İkincisi: fiyat eski tepeyi kırdıysa, geri dönüp o seviyeyi test etmesini bekliyoruz; kırılım yoksa yarım boyut, kırılım ve geri test varsa tam boyut. " +
    "En önemli kural: kapılar sadece azaltır. Bekleyen bir coini alıma çeviremez, bir alımı büyütemez, satışa dokunmaz. " +
    "Aynı 30 günlük veride işlem sayısı " + V.replay.tradesOld + "'den " + V.replay.tradesNew + "'ye, en kötü düşüş " + V.replay.ddOld + "'ten " + V.replay.ddGrail + "'e indi."
  );
}

// ---------- 6 · Otonomi I ----------
{
  const s = base("OTONOMİ", "Kendi kendine çalışır, her " + V.cycleSeconds + " saniyede");
  card(s, 0.5, 1.5, 3.3, 3.55, C.surface2);
  s.addText(V.cycleSeconds + " sn", { x: 0.75, y: 1.65, w: 2.9, h: 0.95, fontFace: HEAD, fontSize: 48, bold: true, color: C.gold, margin: 0 });
  s.addText("insan tıklaması olmadan bir tam döngü", { x: 0.75, y: 2.6, w: 2.9, h: 0.35, fontFace: BODY, fontSize: 13, color: C.muted, margin: 0 });
  s.addText(V.cyclesOnChain, { x: 0.75, y: 3.15, w: 2.9, h: 0.6, fontFace: HEAD, fontSize: 28, bold: true, color: C.text, margin: 0 });
  s.addText("döngü mühürlendi, hepsi açıldı", { x: 0.75, y: 3.75, w: 2.9, h: 0.35, fontFace: BODY, fontSize: 13, color: C.muted, margin: 0 });
  s.addText("Kuralları bir kez sen koyarsın. Her işlem için \"onayla\" düğmesi yok.", { x: 0.75, y: 4.2, w: 2.9, h: 0.7, fontFace: BODY, fontSize: 12, italic: true, color: C.text, margin: 0, valign: "top" });

  const flow = [
    ["Piyasayı oku", "OKX", C.gold],
    ["Her coin için karar ver", "matematik", C.gold],
    ["Yapay zekâ kontrolü (sadece azaltır)", "AI", C.gold],
    ["Kararı mühürle", "Avalanche", C.proof],
    ["Emri ver", "OKX", C.gold],
    ["Zarfı aç", "Avalanche", C.proof],
    ["Paneli güncelle, tekrarla", "web", C.gold],
  ];
  flow.forEach((f, i) => {
    const y = 1.5 + i * 0.51;
    badge(s, 4.2, y, String(i + 1), f[2], 0.4);
    s.addText(f[0], { x: 4.8, y, w: 3.4, h: 0.4, fontFace: BODY, fontSize: 14, color: C.text, valign: "middle", margin: 0, bold: f[2] === C.proof });
    s.addText(f[1], { x: 8.2, y, w: 1.3, h: 0.4, fontFace: BODY, fontSize: 11, color: f[2] === C.proof ? C.proof : C.muted, align: "right", valign: "middle", margin: 0 });
  });
  s.addNotes(
    "Puanın %35'i bu slaytta: otonomi. Döngü her " + V.cycleSeconds + " saniyede, kimse bir şeye tıklamadan çalışıyor. " +
    "4. ve 6. adımları göster: karar, emir daha ortada yokken Avalanche'a mühürleniyor; ajan piyasa cevap vermeden bağlanıyor. " +
    "Beklemek de bir karar ve o da mühürleniyor. Zincirde " + V.cyclesOnChain + " döngü var, hepsi açılmış; her biri tarayıcıda \"Verify yourself\" ile ya da npm run verify:cycle ile kontrol edilebiliyor. " +
    "İnsanın işi kuralları (ayarları) koymak, işlemleri onaylamak değil."
  );
}

// ---------- 7 · Otonomi II: sınırlar ----------
{
  const s = base("OTONOMİ · SINIRLAR", "Dar yetki, kesin sınırlar");
  const stats = [[V.maxOrder, "tek emirde harcayabileceği en fazla"], [V.maxTotal, "piyasada aynı anda tutabileceği en fazla"], [V.killPct, "düşüşte yeni emirleri durdurur (acil durdurma)"]];
  stats.forEach((st, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.45, 2.85, 1.3, C.surface2);
    s.addText(st[0], { x: x + 0.2, y: 1.5, w: 2.45, h: 0.75, fontFace: HEAD, fontSize: 36, bold: true, color: C.gold, margin: 0 });
    s.addText(st[1], { x: x + 0.2, y: 2.25, w: 2.45, h: 0.45, fontFace: BODY, fontSize: 12, color: C.muted, margin: 0, valign: "top" });
  });
  s.addText("Güncel ayarlar. Kod bunları her emirden önce kontrol eder.", { x: 0.5, y: 2.82, w: 9, h: 0.3, fontFace: BODY, fontSize: 11, italic: true, color: C.dim, margin: 0 });

  card(s, 0.5, 3.25, 4.35, 1.4);
  s.addText("Yapabilir", { x: 0.7, y: 3.35, w: 4, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: C.green, margin: 0 });
  s.addText([
    { text: "✓  OKX TR'de coin alıp satmak (sadece spot)", options: { breakLine: true } },
    { text: "✓  Sadece ayarlarındaki 5 coin ile işlem" },
  ], { x: 0.7, y: 3.75, w: 4.0, h: 0.8, fontFace: BODY, fontSize: 13, color: C.text, margin: 0, valign: "top", paraSpaceAfter: 4 });
  card(s, 5.1, 3.25, 4.35, 1.4);
  s.addText("Yapamaz", { x: 5.3, y: 3.35, w: 4, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: C.sell, margin: 0 });
  s.addText([
    { text: "✕  Para çekmek ya da transfer etmek", options: { breakLine: true } },
    { text: "✕  Borç almak ya da kaldıraç kullanmak", options: { breakLine: true } },
    { text: "✕  Hesap ayarlarını değiştirmek" },
  ], { x: 5.3, y: 3.75, w: 4.0, h: 0.85, fontFace: BODY, fontSize: 13, color: C.text, margin: 0, valign: "top", paraSpaceAfter: 2 });
  s.addText([
    { text: "Deneme modu (dry run) varsayılan olarak açık. ", options: { bold: true, color: C.warn } },
    { text: "Canlıya geçmek insan kararıdır: ilk canlı emir (" + V.liveOrder.what + ", " + V.liveOrder.when + ") açık bir onayla verildi.", options: { color: C.text } },
  ], { x: 0.5, y: 4.8, w: 9, h: 0.5, fontFace: BODY, fontSize: 13, margin: 0, valign: "top" });
  s.addNotes(
    "Jürinin 'neye yetkisi var' sorusunun cevabı. Yetkiyi daralt, harcamayı sınırla, izi tut, canlıya geçişi insana bırak. " +
    "Borsa anahtarında para çekme izni yok; kodda para çekme, transfer, kaldıraç ya da hesap ayarı değiştiren hiçbir çağrı yok. " +
    "Acil durdurma (kill switch) yeni emirleri durdurur, pozisyon satmaz; bunu doğru söyle. " +
    "Deneme modu mühürlü kararın içinde; simüle ve gerçek işlemler asla karışmaz. Settings ekranını göster."
  );
}

// ---------- 8 · Otonomi III: hatalar ----------
{
  const s = base("OTONOMİ · HATALAR", "Bir şey bozulursa güvenle durur");
  const rows = [
    ["Kararı mühürleyemezse", "Bu döngüde işlem yapmaz."],
    ["Fiyat verisi eksik ya da bozuksa", "O coinde bekler ve nedenini yazar."],
    ["Yarıda çökerse", "Yeniden açılınca önce bekleyen zarfı açar."],
    ["Emir sonucu belirsizse", "Kimliğiyle sorgular, asla iki kez göndermez."],
  ];
  s.addText("Eğer…", { x: 0.75, y: 1.35, w: 3.5, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 2, margin: 0 });
  s.addText("GRAIL…", { x: 5.25, y: 1.35, w: 3.5, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 2, margin: 0 });
  rows.forEach((r, i) => {
    const y = 1.7 + i * 0.72;
    card(s, 0.5, y, 4.3, 0.6);
    s.addText(r[0], { x: 0.75, y, w: 3.9, h: 0.6, fontFace: BODY, fontSize: 14, bold: true, color: C.text, valign: "middle", margin: 0 });
    s.addText("→", { x: 4.8, y, w: 0.45, h: 0.6, fontFace: BODY, fontSize: 18, color: C.gold, align: "center", valign: "middle", margin: 0 });
    card(s, 5.25, y, 4.2, 0.6, C.surface2);
    s.addText(r[1], { x: 5.45, y, w: 3.9, h: 0.6, fontFace: BODY, fontSize: 14, color: C.text, valign: "middle", margin: 0 });
  });
  s.addText("Tek bir hata ajanı durdurmaz: döngü atlanır, hata kaydedilir, sonraki döngüde yeniden dener.",
    { x: 0.5, y: 4.7, w: 9, h: 0.45, fontFace: BODY, fontSize: 13, italic: true, color: C.muted, margin: 0 });
  s.addNotes(
    "'Beklenmedik girdide ne yapıyor?' sorusunun cevabı. Varsayılan güvenli: mühürleyemezse işlem yapmaz. " +
    "Mühürden önce zarfın gizli parçası diske yazılır; çökme bir kararı sonsuza kadar gizli bırakamaz. " +
    "Settings ekranındaki hata kaydında gerçek bir satır varsa onu göster."
  );
}

// ---------- 9 · Avalanche ----------
{
  const s = base("NEDEN AVALANCHE", "Mühürlü zarf (commit-reveal)");
  const steps = [
    ["1", "Mühürle", "Emirden önce kararın parmak izi (hash) Avalanche'a yazılır.", C.proof],
    ["2", "İşlem", "Emir OKX TR'ye gider (deneme modunda simüle edilir).", C.gold],
    ["3", "Aç", "Kararın tamamı yayınlanır. Herkes mühürle eşleştiğini kontrol edebilir.", C.proof],
  ];
  steps.forEach((st, i) => {
    const x = 0.5 + i * 3.1;
    card(s, x, 1.45, 2.75, 1.75);
    badge(s, x + 0.2, 1.62, st[0], st[3], 0.45);
    s.addText(st[1], { x: x + 0.8, y: 1.62, w: 1.8, h: 0.45, fontFace: HEAD, fontSize: 20, bold: true, color: C.text, valign: "middle", margin: 0 });
    s.addText(st[2], { x: x + 0.2, y: 2.2, w: 2.35, h: 0.95, fontFace: BODY, fontSize: 12, color: C.muted, margin: 0, valign: "top" });
    if (i < 2) s.addText("→", { x: x + 2.75, y: 2.05, w: 0.35, h: 0.5, fontFace: BODY, fontSize: 20, color: C.gold, align: "center", margin: 0 });
  });
  card(s, 0.5, 3.4, 4.35, 1.2, C.surface2);
  s.addText("Kötü kararlar saklanamaz", { x: 0.7, y: 3.5, w: 4, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: C.gold, margin: 0 });
  s.addText("Açılmamış zarflar zincirde sayılır. Ajan birini atladıysa herkes görür.", { x: 0.7, y: 3.85, w: 4, h: 0.7, fontFace: BODY, fontSize: 12, color: C.text, margin: 0, valign: "top" });
  card(s, 5.1, 3.4, 4.35, 1.2, C.surface2);
  s.addText("Zincirdeki kimlik kartı (ERC‑8004)", { x: 5.3, y: 3.5, w: 4, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: C.gold, margin: 0 });
  s.addText("GRAIL, Avalanche Fuji'de " + V.agentId + " numaralı ajan olarak kayıtlı. Siciline sadece kendisi yazabilir.", { x: 5.3, y: 3.85, w: 4, h: 0.7, fontFace: BODY, fontSize: 12, color: C.text, margin: 0, valign: "top" });
  s.addText("Sicil kontratı (Fuji): " + V.ledger, { x: 0.5, y: 4.75, w: 9, h: 0.28, fontFace: MONO, fontSize: 10, color: C.proof, margin: 0 });
  s.addText("İlk canlı emir: " + V.liveOrder.what + " · OKX " + V.liveOrder.okx + " · mühür " + V.liveOrder.commit + " → açılış " + V.liveOrder.reveal,
    { x: 0.5, y: 5.05, w: 9, h: 0.28, fontFace: MONO, fontSize: 10, color: C.muted, margin: 0 });
  s.addNotes(
    "Avalanche'ın neden çekirdek olduğu, bonus kutucuğu olmadığı burada. Diğer takımlar sonucu sonradan zincire yazıyor. " +
    "GRAIL niyetini işlemden ÖNCE yazıyor, mühürlü bir zarf gibi. Teknik olarak: kararın ve rastgele bir değerin (salt) parmak izini mühürle, sonra ikisini de aç. " +
    "Açılmamış zarflar görünür kalır; ajan sadece iyi kararlarını gösteremez. Sorulursa kontratı testnet.snowtrace.io'da aç; kaynak kodu doğrulanmış."
  );
}

// ---------- 10 · Canlı demo ----------
{
  const s = base("CANLI DEMO", "Bize güvenme, kendin kontrol et");
  const tiles = [
    ["Dashboard", "Bağımsız bahisler ve canlı eğri"],
    ["On-chain Ledger", "Mühürlenen ve açılan zarflar"],
    ["Decisions", "Bir döngü, adım adım"],
    ["Verify yourself", "(kendin doğrula) mührü kontrol eder"],
    ["Settings", "Yetkiler ve hata kaydı"],
  ];
  tiles.forEach((t, i) => {
    const x = 0.5 + i * 1.82;
    const hot = i === 3;
    card(s, x, 1.45, 1.65, 1.6, hot ? C.surface2 : C.surface);
    badge(s, x + 0.15, 1.6, hot ? "✓" : String(i + 1), hot ? C.green : C.gold, 0.4);
    s.addText(t[0], { x: x + 0.15, y: 2.08, w: 1.45, h: 0.35, fontFace: BODY, fontSize: 13, bold: true, color: hot ? C.green : C.text, margin: 0 });
    s.addText(t[1], { x: x + 0.15, y: 2.43, w: 1.4, h: 0.6, fontFace: BODY, fontSize: 11, color: C.muted, margin: 0, valign: "top" });
  });
  card(s, 0.5, 3.3, 8.95, 1.15, C.surface2);
  s.addText([
    { text: "\"Verify yourself\" (kendin doğrula) anı: ", options: { bold: true, color: C.gold } },
    { text: "tarayıcın açılan zarftan parmak izini yeniden hesaplar ve Avalanche'taki mühürle karşılaştırır. Parmak izi aynıysa karar hiç değişmemiştir.", options: { color: C.text } },
  ], { x: 0.75, y: 3.3, w: 8.5, h: 1.15, fontFace: BODY, fontSize: 14, valign: "middle", margin: 0 });
  s.addText([
    { text: "Terminalden: ", options: { color: C.muted } },
    { text: "cd chain && npm run verify:cycle:1", options: { color: C.proof, fontFace: MONO } },
    { text: "  →  MATCH", options: { color: C.green, bold: true } },
  ], { x: 0.5, y: 4.62, w: 9, h: 0.3, fontFace: BODY, fontSize: 12, margin: 0 });
  s.addText("Yedek video: " + V.backupVideo, { x: 0.5, y: 4.98, w: 9, h: 0.3, fontFace: BODY, fontSize: 12, color: C.dim, margin: 0 });
  s.addNotes(
    "Canlı uygulamaya geç. Sıra: Dashboard, On-chain Ledger, Decisions (bir döngüyü izle: mühürlendi, emir verildi, açıldı), 'Verify yourself' düğmesine bas, sonra Settings. " +
    "İsteyen jüri üyesi 'Verify yourself'e kendisi bassın. Cümle: 'Bize güvenmeyin, tarayıcınız az önce kontrol etti.' " +
    "Sahneye çıkmadan: sekmeler açık, gerçek veri yüklü (MOCK DATA rozeti yok), deneme/canlı rozeti görünür. Bir şey bozulursa yedek videoyu oynat."
  );
}

// ---------- 11 · Kapanış ----------
{
  const s = base(null, null);
  s.addText("Backtest yalan söyleyebilir.", { x: 0.5, y: 0.6, w: 9, h: 0.75, fontFace: HEAD, fontSize: 38, bold: true, color: C.text, margin: 0 });
  s.addText("Avalanche söyleyemez.", { x: 0.5, y: 1.3, w: 9, h: 0.75, fontFace: HEAD, fontSize: 38, bold: true, color: C.gold, margin: 0 });
  const stats = [
    [V.replay.ddGrail, "en kötü düşüş (al-tut: " + V.replay.ddHold + ")"],
    [V.replay.tradesOld + " → " + V.replay.tradesNew, "işlem sayısı, akıllı girişle"],
    ["0", "acil durdurma tetiklenmesi"],
  ];
  stats.forEach((st, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 2.35, 2.85, 1.1);
    s.addText(st[0], { x: x + 0.2, y: 2.4, w: 2.5, h: 0.6, fontFace: HEAD, fontSize: 28, bold: true, color: C.gold, margin: 0 });
    s.addText(st[1], { x: x + 0.2, y: 2.97, w: 2.5, h: 0.4, fontFace: BODY, fontSize: 11, color: C.muted, margin: 0 });
  });
  s.addText("30 günlük tekrar oynatma, gerçek OKX saatlik fiyatlarıyla, emir gönderilmeden. Getiri " + V.replay.retGrail + ", al-tut " + V.replay.retHold +
    ": al-tuttan iyi olduğunu iddia etmiyoruz. Testler: engine " + V.testsEngine + " · agents " + V.testsAgents + " · kontrat " + V.testsChain + ".",
    { x: 0.5, y: 3.6, w: 9, h: 0.45, fontFace: BODY, fontSize: 10, italic: true, color: C.muted, margin: 0, valign: "top" });
  s.addText([
    { text: "Sırada: ", options: { bold: true, color: C.gold } },
    { text: "her kararı zincirde inceleyen ikinci bir \"risk bekçisi\" ajanı · açılmış zarflardan oluşan itibar puanı · Avalanche ana ağı", options: { color: C.text } },
  ], { x: 0.5, y: 4.25, w: 9, h: 0.6, fontFace: BODY, fontSize: 13, margin: 0, valign: "top" });
  s.addText(V.repo, { x: 0.5, y: 4.95, w: 9, h: 0.3, fontFace: MONO, fontSize: 11, color: C.proof, margin: 0 });
  s.addNotes(
    "Risk tarafı tek cümle: aynı 30 günde en kötü düşüş " + V.replay.ddGrail + ", eşit ağırlıklı al-tut " + V.replay.ddHold + "; acil durdurma hiç tetiklenmedi. " +
    "Getiri daha düşük (" + V.replay.retGrail + " ve " + V.replay.retHold + "), bunu biz söylüyoruz. Kalite: karar Python'da, Avalanche kontratında ve tarayıcıda aynı şekilde kuruluyor ve hepsi aynı sonucu veriyor. " +
    "Sonraki adımdan kısaca bahset. Sonra kapanış: 'Backtest yalan söyleyebilir. Avalanche söyleyemez.' ve sus."
  );
}

pres.writeFile({ fileName: OUT }).then((f) => console.log("wrote " + f));

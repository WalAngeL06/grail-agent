// GRAIL pitch deck generator (T-011). Source: docs/pitch-outline.md, plain-language version.
// Run:  npm i pptxgenjs@3.12.0  (anywhere; set NODE_PATH to that node_modules)  →  node docs/pitch/build-deck.cjs
// Values marked <TBD> are filled after freeze from real state; never invent numbers.
const pptxgen = require("pptxgenjs");
const path = require("path");

const OUT = path.join(__dirname, "GRAIL-pitch.pptx");

// Real, verified values (coord/STATE.md r14, contracts/chain.json, contracts/config.example.json)
const V = {
  liveBets: "1.36",          // 30-day replay average (engine/out/replay.json)
  cyclesOnChain: "2",        // Fuji ledger: 2 committed, 2 revealed, 0 open
  liveOrder: { when: "17 Oct, 15:37", what: "BUY 2 USDT of BTC", okx: "4017748393474314240", commit: "0x16f2…9569", reveal: "0xae65…41f7" },
  replay: { ddGrail: "7.5%", ddHold: "14.5%", retGrail: "+1.8%", retHold: "+8.8%" },
  cycleSeconds: "90",
  maxOrder: "$10",
  maxTotal: "$50",
  killPct: "5%",
  agentId: "1",
  ledger: "0x1B5fcf6DeFf2F9375338A2C35932224522118851",
  testsEngine: "104",
  testsAgents: "157",
  testsChain: "38",
  testsAt: "17 Oct",
  backupVideo: "<TBD>",
  repo: "github.com/WalAngeL06/grail-agent",
};

// Palette = docs/ui-brief.md §3 (deck matches the product)
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
pres.title = "GRAIL — a trading agent whose record you can check";
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

// Motif: gold-outlined circle with a number or glyph
function badge(s, x, y, label, color, d) {
  const dia = d || 0.42;
  const col = color || C.gold;
  s.addShape(pres.shapes.OVAL, { x, y, w: dia, h: dia, fill: { color: C.bg }, line: { color: col, width: 1.5 } });
  s.addText(label, { x, y, w: dia, h: dia, align: "center", valign: "middle", fontFace: BODY, fontSize: dia > 0.5 ? 16 : 13, bold: true, color: col, margin: 0 });
}

// ---------- 1 · Hook ----------
{
  const s = base(null, null);
  s.addText("OKX AGENT TRADE KIT  ×  AVALANCHE", { x: 0.5, y: 0.55, w: 5, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 3, margin: 0 });
  s.addText("GRAIL", { x: 0.5, y: 0.95, w: 5, h: 1.0, fontFace: HEAD, fontSize: 60, bold: true, color: C.text, margin: 0 });
  s.addText("A trading agent whose record you can check.", { x: 0.5, y: 2.0, w: 4.6, h: 0.9, fontFace: BODY, fontSize: 22, color: C.muted, margin: 0, valign: "top" });
  s.addText([
    { text: "You hold 5 coins. ", options: { color: C.text } },
    { text: "Because they move together, they counted as " + V.liveBets + " independent bets on average over the last 30 days.", options: { color: C.muted } },
  ], { x: 0.5, y: 3.15, w: 4.6, h: 0.8, fontFace: BODY, fontSize: 15, margin: 0, valign: "top" });
  s.addText("Agentic Trading Hackathon · Ankara · 17 Oct 2026", { x: 0.5, y: 4.85, w: 5, h: 0.3, fontFace: BODY, fontSize: 11, color: C.dim, margin: 0 });

  // 5 overlapping coins  ≈  one gold "bets" circle
  const coins = ["BTC", "ETH", "SOL", "AVAX", "OKB"];
  const pos = [[5.55, 2.05], [6.15, 1.85], [6.6, 2.4], [6.0, 2.65], [5.5, 2.75]];
  coins.forEach((c, i) => {
    s.addShape(pres.shapes.OVAL, { x: pos[i][0], y: pos[i][1], w: 0.75, h: 0.75, fill: { color: C.surface2, transparency: 10 }, line: { color: C.muted, width: 1 } });
  });
  // labels after all circles so no circle covers a label
  coins.forEach((c, i) => {
    s.addText(c, { x: pos[i][0], y: pos[i][1], w: 0.75, h: 0.75, align: "center", valign: "middle", fontFace: BODY, fontSize: 10, bold: true, color: C.text, margin: 0 });
  });
  s.addText("5 coins", { x: 5.45, y: 3.6, w: 2.0, h: 0.3, align: "center", fontFace: BODY, fontSize: 12, color: C.muted, margin: 0 });
  s.addText("≈", { x: 7.45, y: 2.2, w: 0.45, h: 0.6, align: "center", fontFace: BODY, fontSize: 32, color: C.muted, margin: 0 });
  s.addShape(pres.shapes.OVAL, { x: 7.95, y: 1.75, w: 1.6, h: 1.6, fill: { color: C.bg }, line: { color: C.gold, width: 2.5 } });
  s.addText(V.liveBets, { x: 7.95, y: 1.75, w: 1.6, h: 1.6, align: "center", valign: "middle", fontFace: HEAD, fontSize: 26, bold: true, color: C.gold, margin: 0 });
  s.addText("independent bets · 30-day avg", { x: 7.6, y: 3.6, w: 2.3, h: 0.3, align: "center", fontFace: BODY, fontSize: 11, color: C.gold, margin: 0 });
  s.addNotes(
    "Open with the live number from the dashboard, not with the team. " +
    "\"You bought five coins. Because they rise and fall together, over the last 30 days they behaved like " + V.liveBets + " independent bets. " +
    "And if an AI agent traded them for you, you could not check its record either. GRAIL fixes both.\""
  );
}

// ---------- 2 · Problem ----------
{
  const s = base("THE PROBLEM", "You can't check a trading agent's record");
  const rows = [
    ["1", "Test results are hand-picked", "Only the good runs get shown."],
    ["2", "Screenshots can be edited", "A picture of profits is not proof."],
    ["3", "Decisions get \"fixed\" later", "Logs can be rewritten after the market moves."],
  ];
  rows.forEach((r, i) => {
    const y = 1.55 + i * 0.95;
    card(s, 0.5, y, 4.6, 0.8);
    badge(s, 0.7, y + 0.19, r[0]);
    s.addText(r[1], { x: 1.3, y: y + 0.1, w: 3.7, h: 0.32, fontFace: BODY, fontSize: 15, bold: true, color: C.text, margin: 0 });
    s.addText(r[2], { x: 1.3, y: y + 0.42, w: 3.7, h: 0.3, fontFace: BODY, fontSize: 12, color: C.muted, margin: 0 });
  });
  card(s, 5.4, 1.55, 4.1, 2.7, C.surface2);
  s.addText("And \"diversified\" is often one bet", { x: 5.65, y: 1.75, w: 3.6, h: 0.7, fontFace: HEAD, fontSize: 18, bold: true, color: C.gold, margin: 0, valign: "top" });
  s.addText("Most crypto coins rise and fall together. Buying five of them can feel safe, but it behaves like barely more than one.",
    { x: 5.65, y: 2.5, w: 3.6, h: 1.0, fontFace: BODY, fontSize: 14, color: C.text, margin: 0, valign: "top" });
  [0, 1, 2, 3, 4].forEach((i) => {
    s.addShape(pres.shapes.OVAL, { x: 5.75 + i * 0.32, y: 3.55, w: 0.5, h: 0.5, fill: { color: C.surface, transparency: 20 }, line: { color: C.muted, width: 1 } });
  });
  s.addText("≈ " + V.liveBets + " bets", { x: 7.7, y: 3.55, w: 1.65, h: 0.5, fontFace: BODY, fontSize: 14, bold: true, color: C.gold, valign: "middle", margin: 0 });
  s.addText([
    { text: "Who it's for: ", options: { bold: true, color: C.gold } },
    { text: "anyone who wants to let an AI agent trade their money — and wants proof first.", options: { color: C.text } },
  ], { x: 0.5, y: 4.6, w: 9, h: 0.45, fontFace: BODY, fontSize: 14, margin: 0 });
  s.addNotes(
    "This answers the jury's 'problem and target user' question directly. " +
    "Say it in one breath: people want to hand money to trading agents, but no agent can prove its history. " +
    "And most 'diversified' crypto portfolios are really a single bet. Then move on."
  );
}

// ---------- 3 · Independent bets ----------
{
  const s = base("THE INSIGHT", "Count bets, not coins");
  const labels = Array.from({ length: 20 }, (_, i) => String(i + 1));
  const series = [[0.2, "Coins rarely move together"], [0.5, "Often move together"], [0.8, "Almost always move together"]].map(([rho, name]) => ({
    name,
    labels,
    values: labels.map((_, i) => { const n = i + 1; return Math.round((n / (1 + (n - 1) * rho)) * 100) / 100; }),
  }));
  s.addChart(pres.charts.LINE, series, {
    x: 0.4, y: 1.4, w: 5.7, h: 3.75,
    chartColors: [C.green, C.proof, C.gold],
    lineSize: 2.5, lineDataSymbol: "none",
    showTitle: true, title: "Independent bets vs. number of coins", titleColor: C.text, titleFontFace: BODY, titleFontSize: 12,
    showLegend: true, legendPos: "b", legendColor: C.muted, legendFontFace: BODY, legendFontSize: 9,
    catAxisLabelColor: C.muted, valAxisLabelColor: C.muted, catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
    catAxisLabelFrequency: 1,
    showCatAxisTitle: true, catAxisTitle: "Number of coins", catAxisTitleColor: C.muted, catAxisTitleFontSize: 10,
    showValAxisTitle: true, valAxisTitle: "Independent bets", valAxisTitleColor: C.muted, valAxisTitleFontSize: 10,
    valGridLine: { color: C.border, size: 0.5 }, catGridLine: { style: "none" },
    catAxisLineColor: C.border, valAxisLineColor: C.border,
    plotArea: { fill: { color: C.surface } }, chartArea: { fill: { color: C.surface }, roundedCorners: false },
  });
  card(s, 6.4, 1.4, 3.1, 1.55, C.surface2);
  s.addText("Last 30 days", { x: 6.6, y: 1.5, w: 2.7, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 2, margin: 0 });
  s.addText(V.liveBets, { x: 6.6, y: 1.8, w: 2.7, h: 0.6, fontFace: HEAD, fontSize: 30, bold: true, color: C.gold, margin: 0 });
  s.addText("independent bets from 5 coins, on average (replay on real OKX prices)", { x: 6.6, y: 2.4, w: 2.7, h: 0.5, fontFace: BODY, fontSize: 11, color: C.muted, margin: 0, valign: "top" });
  s.addText([
    { text: "Coins that move together count as one bet.", options: { bullet: true, breakLine: true } },
    { text: "Adding more of the same kind adds almost nothing.", options: { bullet: true, breakLine: true } },
    { text: "GRAIL spreads money by how coins move, not by how many there are.", options: { bullet: true } },
  ], { x: 6.4, y: 3.15, w: 3.1, h: 2.0, fontFace: BODY, fontSize: 13, color: C.text, paraSpaceAfter: 6, margin: 0, valign: "top" });
  s.addNotes(
    "This is Ray Dalio's 'Holy Grail' idea in plain words. The curve shows how many truly independent bets you get as you add coins. " +
    "When coins move together (gold line), the curve goes flat quickly: coin number ten adds almost nothing. " +
    "On the live dashboard there is a 'you are here' dot and a slider for how much coins move together. " +
    "Behind the scenes the engine uses N / (1 + (N-1) x average correlation), but say it simply."
  );
}

// ---------- 4 · What GRAIL is ----------
{
  const s = base("THE PRODUCT", "What GRAIL does, in four steps");
  const steps = [
    ["1", "Look", "Reads prices, price history and the account balance from OKX TR with the OKX Agent Trade Kit."],
    ["2", "Decide", "Fixed math picks buy, sell or hold for every coin. Same data in, same decision out."],
    ["3", "Seal", "Locks the decision on Avalanche before any order is placed."],
    ["4", "Show", "A dashboard where anyone can re-check every decision."],
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
    { text: "The AI can only say no. ", options: { bold: true, color: C.gold } },
    { text: "An AI double-checks each buy: it can make it smaller or cancel it, never bigger.", options: { color: C.text } },
  ], { x: 0.75, y: 4.4, w: 8.5, h: 0.7, fontFace: BODY, fontSize: 14, valign: "middle", margin: 0 });
  s.addNotes(
    "Four parts: look, decide, seal, show. Stress that the money decisions are fixed math, not an AI's mood. " +
    "The AI (a language model) is a safety check that can only shrink or cancel a buy; it can never add risk, and it never touches sells. " +
    "If the AI is unavailable or slow, the decision goes through unchanged and that is recorded."
  );
}

// ---------- 5 · Autonomy I ----------
{
  const s = base("AUTONOMY", "It runs itself — every " + V.cycleSeconds + " seconds");
  card(s, 0.5, 1.5, 3.3, 3.55, C.surface2);
  s.addText(V.cycleSeconds + " s", { x: 0.75, y: 1.65, w: 2.9, h: 0.95, fontFace: HEAD, fontSize: 48, bold: true, color: C.gold, margin: 0 });
  s.addText("one full cycle, no human click", { x: 0.75, y: 2.6, w: 2.9, h: 0.35, fontFace: BODY, fontSize: 13, color: C.muted, margin: 0 });
  s.addText(V.cyclesOnChain, { x: 0.75, y: 3.15, w: 2.9, h: 0.6, fontFace: HEAD, fontSize: 28, bold: true, color: C.text, margin: 0 });
  s.addText("cycles sealed on Avalanche so far", { x: 0.75, y: 3.75, w: 2.9, h: 0.35, fontFace: BODY, fontSize: 13, color: C.muted, margin: 0 });
  s.addText("You set the rules once. There is no \"approve\" button per trade.", { x: 0.75, y: 4.2, w: 2.9, h: 0.7, fontFace: BODY, fontSize: 12, italic: true, color: C.text, margin: 0, valign: "top" });

  const flow = [
    ["Read the market", "OKX", C.gold],
    ["Decide for each coin", "math", C.gold],
    ["AI double-check (can only cut)", "AI", C.gold],
    ["Seal the decision", "Avalanche", C.proof],
    ["Place the order", "OKX", C.gold],
    ["Open the envelope", "Avalanche", C.proof],
    ["Update the dashboard, repeat", "web", C.gold],
  ];
  flow.forEach((f, i) => {
    const y = 1.5 + i * 0.51;
    badge(s, 4.2, y, String(i + 1), f[2], 0.4);
    s.addText(f[0], { x: 4.8, y, w: 3.4, h: 0.4, fontFace: BODY, fontSize: 14, color: C.text, valign: "middle", margin: 0, bold: f[2] === C.proof });
    s.addText(f[1], { x: 8.2, y, w: 1.3, h: 0.4, fontFace: BODY, fontSize: 11, color: f[2] === C.proof ? C.proof : C.muted, align: "right", valign: "middle", margin: 0 });
  });
  s.addNotes(
    "This is the 35% slide: autonomy. The loop runs every " + V.cycleSeconds + " seconds with nobody clicking anything. " +
    "Point at steps 4 and 6: the decision is sealed on Avalanche BEFORE the order exists, so the agent is bound before the market answers. " +
    "Holding is a decision too, and it is sealed as well. The human's job is setting the rules (the config), not approving trades."
  );
}

// ---------- 6 · Autonomy II: limits ----------
{
  const s = base("AUTONOMY · LIMITS", "Tight permissions, hard limits");
  const stats = [[V.maxOrder, "most it can spend on one order"], [V.maxTotal, "most it can have in the market"], [V.killPct, "drop that stops all trading"]];
  stats.forEach((st, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.45, 2.85, 1.3, C.surface2);
    s.addText(st[0], { x: x + 0.2, y: 1.5, w: 2.45, h: 0.75, fontFace: HEAD, fontSize: 36, bold: true, color: C.gold, margin: 0 });
    s.addText(st[1], { x: x + 0.2, y: 2.25, w: 2.45, h: 0.4, fontFace: BODY, fontSize: 12, color: C.muted, margin: 0 });
  });
  s.addText("Current settings. The code checks them before every single order.", { x: 0.5, y: 2.82, w: 9, h: 0.3, fontFace: BODY, fontSize: 11, italic: true, color: C.dim, margin: 0 });

  card(s, 0.5, 3.25, 4.35, 1.4);
  s.addText("It can", { x: 0.7, y: 3.35, w: 4, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: C.green, margin: 0 });
  s.addText([
    { text: "✓  Buy and sell coins on OKX TR (spot only)", options: { breakLine: true } },
    { text: "✓  Trade only the 5 coins in its settings" },
  ], { x: 0.7, y: 3.75, w: 4.0, h: 0.8, fontFace: BODY, fontSize: 13, color: C.text, margin: 0, valign: "top", paraSpaceAfter: 4 });
  card(s, 5.1, 3.25, 4.35, 1.4);
  s.addText("It cannot", { x: 5.3, y: 3.35, w: 4, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: C.sell, margin: 0 });
  s.addText([
    { text: "✕  Withdraw or move money", options: { breakLine: true } },
    { text: "✕  Borrow or use leverage", options: { breakLine: true } },
    { text: "✕  Change account settings" },
  ], { x: 5.3, y: 3.75, w: 4.0, h: 0.85, fontFace: BODY, fontSize: 13, color: C.text, margin: 0, valign: "top", paraSpaceAfter: 2 });
  s.addText([
    { text: "Practice mode is on by default. ", options: { bold: true, color: C.warn } },
    { text: "Going live is a human decision: the first live order (" + V.liveOrder.what + ", " + V.liveOrder.when + ") needed an explicit switch.", options: { color: C.text } },
  ], { x: 0.5, y: 4.8, w: 9, h: 0.45, fontFace: BODY, fontSize: 13, margin: 0 });
  s.addNotes(
    "Answers the jury's 'what is it allowed to do' question. Narrow the permissions, cap the spending, keep the trail, keep a human in charge of going live. " +
    "The exchange key has no withdraw permission; there is no code anywhere for withdrawals, transfers, leverage or account changes. " +
    "Practice mode (dry run) is part of the sealed decision, so simulated and real trades can never be confused. Show the Settings screen."
  );
}

// ---------- 7 · Autonomy III: failures ----------
{
  const s = base("AUTONOMY · FAILURES", "When something breaks, it stops safely");
  const rows = [
    ["It can't seal the decision", "No trade this cycle."],
    ["Price data is missing or broken", "Holds that coin and writes down why."],
    ["It crashes halfway through", "On restart, it opens the waiting envelope first."],
    ["An order result is unclear", "Looks it up by ID. Never sends it twice."],
  ];
  s.addText("If…", { x: 0.75, y: 1.35, w: 3.5, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 2, margin: 0 });
  s.addText("GRAIL…", { x: 5.25, y: 1.35, w: 3.5, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 2, margin: 0 });
  rows.forEach((r, i) => {
    const y = 1.7 + i * 0.72;
    card(s, 0.5, y, 4.3, 0.6);
    s.addText(r[0], { x: 0.75, y, w: 3.9, h: 0.6, fontFace: BODY, fontSize: 14, bold: true, color: C.text, valign: "middle", margin: 0 });
    s.addText("→", { x: 4.8, y, w: 0.45, h: 0.6, fontFace: BODY, fontSize: 18, color: C.gold, align: "center", valign: "middle", margin: 0 });
    card(s, 5.25, y, 4.2, 0.6, C.surface2);
    s.addText(r[1], { x: 5.45, y, w: 3.9, h: 0.6, fontFace: BODY, fontSize: 14, color: C.text, valign: "middle", margin: 0 });
  });
  s.addText("One error never stops the agent: the cycle is skipped, the error is logged, and it tries again next cycle.",
    { x: 0.5, y: 4.7, w: 9, h: 0.45, fontFace: BODY, fontSize: 13, italic: true, color: C.muted, margin: 0 });
  s.addNotes(
    "Answers 'what does it do with unexpected input?'. Safe by default: if it cannot seal, it does not trade. " +
    "Before sealing, the secret part of the envelope is saved to disk, so a crash can never leave a decision hidden forever. " +
    "If the error log on the Settings screen has a real entry, show it."
  );
}

// ---------- 8 · Avalanche ----------
{
  const s = base("WHY AVALANCHE", "The sealed envelope");
  const steps = [
    ["1", "Seal", "Before the order, a fingerprint of the decision is written to Avalanche.", C.proof],
    ["2", "Trade", "The order goes to OKX TR (or is simulated in practice mode).", C.gold],
    ["3", "Open", "The full decision is published. Anyone can check it matches the seal.", C.proof],
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
  s.addText("No hiding bad calls", { x: 0.7, y: 3.5, w: 4, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: C.gold, margin: 0 });
  s.addText("Unopened envelopes are counted on chain. Anyone can see if the agent skipped one.", { x: 0.7, y: 3.85, w: 4, h: 0.7, fontFace: BODY, fontSize: 12, color: C.text, margin: 0, valign: "top" });
  card(s, 5.1, 3.4, 4.35, 1.2, C.surface2);
  s.addText("An ID card on chain", { x: 5.3, y: 3.5, w: 4, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: C.gold, margin: 0 });
  s.addText("GRAIL is registered as agent #" + V.agentId + " on Avalanche Fuji (ERC‑8004 standard). Only it can write to its record.", { x: 5.3, y: 3.85, w: 4, h: 0.7, fontFace: BODY, fontSize: 12, color: C.text, margin: 0, valign: "top" });
  s.addText("Record contract (Fuji): " + V.ledger, { x: 0.5, y: 4.75, w: 9, h: 0.28, fontFace: MONO, fontSize: 10, color: C.proof, margin: 0 });
  s.addText("First live order: " + V.liveOrder.what + " · OKX " + V.liveOrder.okx + " · sealed " + V.liveOrder.commit + " → opened " + V.liveOrder.reveal,
    { x: 0.5, y: 5.05, w: 9, h: 0.28, fontFace: MONO, fontSize: 10, color: C.muted, margin: 0 });
  s.addNotes(
    "This is why Avalanche is the core, not a bonus box. Other teams write results to the chain after the fact. " +
    "GRAIL writes its intent BEFORE the trade, like a sealed envelope. Technically: commit a hash of the decision plus a random salt, then reveal both. " +
    "Unopened envelopes stay visible, so the agent cannot show only its good calls. Open the contract on testnet.snowtrace.io if asked."
  );
}

// ---------- 9 · Live demo ----------
{
  const s = base("LIVE DEMO", "Don't trust us — check it yourself");
  const tiles = [
    ["Dashboard", "Independent bets and the live curve"],
    ["Record", "Envelopes sealed, opened, still closed"],
    ["Decisions", "One cycle, step by step"],
    ["Check it", "Your browser checks the seal again"],
    ["Limits", "Permissions and the error log"],
  ];
  tiles.forEach((t, i) => {
    const x = 0.5 + i * 1.82;
    const hot = i === 3;
    card(s, x, 1.45, 1.65, 1.6, hot ? C.surface2 : C.surface);
    badge(s, x + 0.15, 1.6, hot ? "✓" : String(i + 1), hot ? C.green : C.gold, 0.4);
    s.addText(t[0], { x: x + 0.15, y: 2.08, w: 1.4, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: hot ? C.green : C.text, margin: 0 });
    s.addText(t[1], { x: x + 0.15, y: 2.43, w: 1.4, h: 0.6, fontFace: BODY, fontSize: 11, color: C.muted, margin: 0, valign: "top" });
  });
  card(s, 0.5, 3.3, 8.95, 1.15, C.surface2);
  s.addText([
    { text: "The \"check it yourself\" moment: ", options: { bold: true, color: C.gold } },
    { text: "your browser rebuilds the fingerprint from the opened envelope and compares it with the seal on Avalanche. Same fingerprint = the decision was never changed.", options: { color: C.text } },
  ], { x: 0.75, y: 3.3, w: 8.5, h: 1.15, fontFace: BODY, fontSize: 14, valign: "middle", margin: 0 });
  s.addText([
    { text: "From a terminal: ", options: { color: C.muted } },
    { text: "cd chain && npm run verify:cycle:1", options: { color: C.proof, fontFace: MONO } },
    { text: "  →  MATCH", options: { color: C.green, bold: true } },
  ], { x: 0.5, y: 4.62, w: 9, h: 0.3, fontFace: BODY, fontSize: 12, margin: 0 });
  s.addText("Backup video: " + V.backupVideo, { x: 0.5, y: 4.98, w: 9, h: 0.3, fontFace: BODY, fontSize: 12, color: C.dim, margin: 0 });
  s.addNotes(
    "Switch to the live app. Order: Dashboard, On-chain Ledger, Decisions (follow one cycle: sealed, ordered, opened), press 'Verify yourself', then Settings. " +
    "Let a judge press 'Verify yourself' if they want. Line: 'Don't trust us - your browser just checked it.' " +
    "Before going on stage: tabs open, real data loaded (no MOCK DATA badge), practice/live badge visible. If anything fails, play the backup video."
  );
}

// ---------- 10 · Close ----------
{
  const s = base(null, null);
  s.addText("Backtests can lie.", { x: 0.5, y: 0.7, w: 9, h: 0.75, fontFace: HEAD, fontSize: 40, bold: true, color: C.text, margin: 0 });
  s.addText("Avalanche can't.", { x: 0.5, y: 1.4, w: 9, h: 0.75, fontFace: HEAD, fontSize: 40, bold: true, color: C.gold, margin: 0 });
  const stats = [[V.testsEngine, "decision-engine and AI-check tests"], [V.testsAgents, "OKX trading and loop tests"], [V.testsChain, "Avalanche contract tests"]];
  stats.forEach((st, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 2.5, 2.85, 1.1);
    s.addText(st[0], { x: x + 0.2, y: 2.55, w: 1.2, h: 0.6, fontFace: HEAD, fontSize: 30, bold: true, color: C.gold, margin: 0 });
    s.addText(st[1], { x: x + 0.2, y: 3.12, w: 2.5, h: 0.4, fontFace: BODY, fontSize: 11, color: C.muted, margin: 0 });
  });
  s.addText("Automated tests passing, " + V.testsAt + ". 30-day replay on real OKX prices: worst drop " + V.replay.ddGrail + " vs " + V.replay.ddHold +
    " for buy-and-hold (return " + V.replay.retGrail + " vs " + V.replay.retHold + "; no claim that it beats buy-and-hold).",
    { x: 0.5, y: 3.68, w: 9, h: 0.42, fontFace: BODY, fontSize: 10, italic: true, color: C.muted, margin: 0, valign: "top" });
  s.addText([
    { text: "Next: ", options: { bold: true, color: C.gold } },
    { text: "a second \"risk guard\" agent that reviews each decision on chain · a reputation built from opened envelopes · Avalanche mainnet", options: { color: C.text } },
  ], { x: 0.5, y: 4.25, w: 9, h: 0.6, fontFace: BODY, fontSize: 13, margin: 0, valign: "top" });
  s.addText(V.repo, { x: 0.5, y: 4.95, w: 9, h: 0.3, fontFace: MONO, fontSize: 11, color: C.proof, margin: 0 });
  s.addNotes(
    "Quality in one sentence: the decision is built the same way in Python, in the Avalanche contract and in your browser, and they all agree. " +
    "On risk: in a 30-day replay its worst drop was " + V.replay.ddGrail + " versus " + V.replay.ddHold + " for buy-and-hold; it earned less (" + V.replay.retGrail + " vs " + V.replay.retHold + "), and we say so. " +
    "Mention the next step only briefly. Then close with: 'Backtests can lie. Avalanche can't.' and stop talking."
  );
}

pres.writeFile({ fileName: OUT }).then((f) => console.log("wrote " + f));

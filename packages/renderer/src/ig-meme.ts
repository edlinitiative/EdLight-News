/**
 * @edlight-news/renderer – Meme slide HTML templates
 *
 * Litquidity-style meme layouts rendered as 1080×1080 HTML for Playwright.
 * Each template maps to a distinct visual layout:
 * - drake:           Two-panel reject/prefer
 * - expanding-brain: 4-tier escalation
 * - distracted:      Three-panel distracted boyfriend
 * - starter-pack:    2×2 grid of relatable items
 * - two-buttons:     Anxious choice between two
 * - tell-me:         Setup + punchline
 * - nobody:          "Nobody: …" format
 * - reaction:        Headline + emoji reaction
 * - comparison:      Side-by-side comparison
 */

import type { IGMemeSlide, IGMemePanel, IGMemeTemplate } from "@edlight-news/types";

const FONT_STACK = "'Inter', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Tone → accent color mapping ─────────────────────────────────────────────

const TONE_ACCENTS: Record<string, string> = {
  witty:     "#facc15",
  wholesome: "#34d399",
  ironic:    "#f472b6",
  hype:      "#fb923c",
};

const TONE_BG: Record<string, string> = {
  witty:     "#1a1a2e",
  wholesome: "#0f1f1a",
  ironic:    "#1f0a1a",
  hype:      "#1f1408",
};

// ── Shared CSS reset + base ──────────────────────────────────────────────────

function baseCSS(accent: string, bg: string): string {
  return `
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1080px;
  font-family: ${FONT_STACK};
  background: ${bg};
  color: #fff;
  overflow: hidden;
}
.accent { color: ${accent}; }
.topic {
  position: absolute; top: 48px; left: 72px; right: 72px;
  font-size: 20px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 3px; opacity: 0.5;
}
.brand {
  position: absolute; bottom: 40px; right: 72px;
  font-size: 16px; font-weight: 700; opacity: 0.25; letter-spacing: 2px;
}
.brand b { color: ${accent}; font-weight: 700; }
.emoji { font-size: 48px; }
`;
}

// ── Template renderers ──────────────────────────────────────────────────────

function renderDrake(meme: IGMemeSlide, accent: string, bg: string): string {
  const [reject, prefer] = meme.panels;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${baseCSS(accent, bg)}
.grid { display:grid; grid-template-rows:1fr 1fr; height:100%; }
.row {
  display:flex; align-items:center; padding:0 80px; gap:40px;
}
.top-row { background: rgba(255,50,50,0.08); border-bottom: 1px solid rgba(255,255,255,0.05); }
.bot-row { background: rgba(50,255,100,0.08); }
.icon { font-size:80px; flex-shrink:0; }
.txt { font-size:36px; font-weight:600; line-height:1.3; }
.reject .txt { opacity:0.5; text-decoration:line-through; }
.prefer .txt { color:${accent}; }
</style></head><body>
${meme.topicLine ? `<div class="topic">${esc(meme.topicLine)}</div>` : ""}
<div class="grid">
  <div class="row top-row reject">
    <span class="icon">${reject!.emoji ?? "🙅"}</span>
    <span class="txt">${esc(reject!.text)}</span>
  </div>
  <div class="row bot-row prefer">
    <span class="icon">${prefer!.emoji ?? "😎"}</span>
    <span class="txt">${esc(prefer!.text)}</span>
  </div>
</div>
<div class="brand">ED<b>LIGHT</b></div>
</body></html>`;
}

function renderExpandingBrain(meme: IGMemeSlide, accent: string, bg: string): string {
  const tiers = meme.panels;
  const sizes = ["28px", "32px", "38px", "44px"];
  const opacities = ["0.4", "0.6", "0.8", "1.0"];
  const brainEmojis = ["🧠", "🧠✨", "🧠💫", "🧠🌌"];

  const rows = tiers
    .map(
      (p, i) => `
    <div class="tier" style="opacity:${opacities[i]};">
      <span class="brain">${p.emoji ?? brainEmojis[i]}</span>
      <span class="txt" style="font-size:${sizes[i]};">${esc(p.text)}</span>
    </div>`,
    )
    .join("\n");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${baseCSS(accent, bg)}
.stack { display:flex; flex-direction:column; height:100%; padding:100px 72px 80px; justify-content:space-around; }
.tier { display:flex; align-items:center; gap:32px; padding:16px 24px; border-left:3px solid ${accent}; margin-left:0; }
.tier:nth-child(2) { margin-left:30px; }
.tier:nth-child(3) { margin-left:60px; }
.tier:nth-child(4) { margin-left:90px; }
.brain { font-size:48px; flex-shrink:0; }
.txt { font-weight:600; line-height:1.3; }
</style></head><body>
${meme.topicLine ? `<div class="topic">${esc(meme.topicLine)}</div>` : ""}
<div class="stack">${rows}</div>
<div class="brand">ED<b>LIGHT</b></div>
</body></html>`;
}

function renderNobody(meme: IGMemeSlide, accent: string, bg: string): string {
  const [nobody, reaction] = meme.panels;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${baseCSS(accent, bg)}
.wrap { height:100%; display:flex; flex-direction:column; justify-content:center; padding:0 80px; gap:48px; }
.line { font-size:32px; font-weight:500; opacity:0.35; }
.react { font-size:42px; font-weight:700; color:${accent}; line-height:1.3; }
.react-emoji { font-size:72px; display:block; margin-bottom:16px; }
</style></head><body>
${meme.topicLine ? `<div class="topic">${esc(meme.topicLine)}</div>` : ""}
<div class="wrap">
  <div class="line">${nobody!.emoji ?? ""} ${esc(nobody!.text)}</div>
  <div>
    <span class="react-emoji">${reaction!.emoji ?? "😂"}</span>
    <div class="react">${esc(reaction!.text)}</div>
  </div>
</div>
<div class="brand">ED<b>LIGHT</b></div>
</body></html>`;
}

function renderStarterPack(meme: IGMemeSlide, accent: string, bg: string): string {
  const items = meme.panels;
  const cells = items
    .map(
      (p) => `
    <div class="cell">
      <span class="item-emoji">${p.emoji ?? "📦"}</span>
      <span class="item-txt">${esc(p.text)}</span>
    </div>`,
    )
    .join("\n");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${baseCSS(accent, bg)}
.title-bar {
  text-align:center; padding:72px 80px 24px;
  font-size:36px; font-weight:700; color:${accent}; letter-spacing:-0.5px;
}
.grid {
  display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr;
  gap:24px; padding:24px 80px 80px; flex:1;
}
.cell {
  background:rgba(255,255,255,0.04); border-radius:20px;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:16px; padding:24px;
}
.item-emoji { font-size:56px; }
.item-txt { font-size:24px; font-weight:600; text-align:center; line-height:1.3; opacity:0.85; }
</style></head><body>
<div class="title-bar">${meme.topicLine ? esc(meme.topicLine) : "Starter Pack"}</div>
<div class="grid">${cells}</div>
<div class="brand">ED<b>LIGHT</b></div>
</body></html>`;
}

function renderTwoButtons(meme: IGMemeSlide, accent: string, bg: string): string {
  const [left, right] = meme.panels;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${baseCSS(accent, bg)}
.wrap { height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:48px; padding:100px 64px 80px; }
.sweat { font-size:96px; }
.buttons { display:flex; gap:32px; width:100%; }
.btn {
  flex:1; background:rgba(255,255,255,0.06); border:2px solid rgba(255,255,255,0.1);
  border-radius:20px; padding:48px 32px; text-align:center;
  display:flex; flex-direction:column; align-items:center; gap:16px;
  transition:border-color 0.2s;
}
.btn:hover { border-color:${accent}; }
.btn-emoji { font-size:56px; }
.btn-txt { font-size:28px; font-weight:600; line-height:1.3; }
</style></head><body>
${meme.topicLine ? `<div class="topic" style="text-align:center;">${esc(meme.topicLine)}</div>` : ""}
<div class="wrap">
  <div class="sweat">😰</div>
  <div class="buttons">
    <div class="btn">
      <span class="btn-emoji">${left!.emoji ?? "🅰️"}</span>
      <span class="btn-txt">${esc(left!.text)}</span>
    </div>
    <div class="btn">
      <span class="btn-emoji">${right!.emoji ?? "🅱️"}</span>
      <span class="btn-txt">${esc(right!.text)}</span>
    </div>
  </div>
</div>
<div class="brand">ED<b>LIGHT</b></div>
</body></html>`;
}

function renderTellMe(meme: IGMemeSlide, accent: string, bg: string): string {
  const [setup, punchline] = meme.panels;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${baseCSS(accent, bg)}
.wrap { height:100%; display:flex; flex-direction:column; justify-content:center; padding:0 80px; gap:64px; }
.setup { font-size:30px; font-weight:500; opacity:0.5; line-height:1.4; font-style:italic; }
.punch { font-size:44px; font-weight:700; color:${accent}; line-height:1.25; }
.punch-emoji { font-size:64px; display:block; margin-bottom:12px; }
</style></head><body>
${meme.topicLine ? `<div class="topic">${esc(meme.topicLine)}</div>` : ""}
<div class="wrap">
  <div class="setup">${setup!.emoji ?? "🤔"} ${esc(setup!.text)}</div>
  <div>
    <span class="punch-emoji">${punchline!.emoji ?? "💀"}</span>
    <div class="punch">${esc(punchline!.text)}</div>
  </div>
</div>
<div class="brand">ED<b>LIGHT</b></div>
</body></html>`;
}

function renderDistracted(meme: IGMemeSlide, accent: string, bg: string): string {
  const [focus, distraction, ignored] = meme.panels;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${baseCSS(accent, bg)}
.wrap { height:100%; display:flex; flex-direction:column; justify-content:center; padding:0 72px; gap:24px; }
.panel { display:flex; align-items:center; gap:28px; padding:28px 32px; border-radius:16px; }
.panel-emoji { font-size:56px; flex-shrink:0; }
.panel-txt { font-size:30px; font-weight:600; line-height:1.3; }
.focus { background:rgba(255,255,255,0.03); opacity:0.4; }
.focus .panel-txt { text-decoration:line-through; }
.distract { background:rgba(255,200,0,0.08); border:2px solid ${accent}; }
.distract .panel-txt { color:${accent}; }
.ignored { background:rgba(255,255,255,0.02); opacity:0.3; }
.label { font-size:14px; text-transform:uppercase; letter-spacing:2px; opacity:0.3; margin-bottom:4px; }
</style></head><body>
${meme.topicLine ? `<div class="topic">${esc(meme.topicLine)}</div>` : ""}
<div class="wrap">
  <div><div class="label">Ce que je devrais faire</div><div class="panel focus">
    <span class="panel-emoji">${focus!.emoji ?? "📚"}</span>
    <span class="panel-txt">${esc(focus!.text)}</span>
  </div></div>
  <div><div class="label">Ce que je fais</div><div class="panel distract">
    <span class="panel-emoji">${distraction!.emoji ?? "👀"}</span>
    <span class="panel-txt">${esc(distraction!.text)}</span>
  </div></div>
  <div><div class="label">Ce que j'ignore</div><div class="panel ignored">
    <span class="panel-emoji">${ignored!.emoji ?? "🫣"}</span>
    <span class="panel-txt">${esc(ignored!.text)}</span>
  </div></div>
</div>
<div class="brand">ED<b>LIGHT</b></div>
</body></html>`;
}

function renderComparison(meme: IGMemeSlide, accent: string, bg: string): string {
  const [left, right] = meme.panels;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${baseCSS(accent, bg)}
.cols { display:grid; grid-template-columns:1fr 1fr; height:100%; }
.col { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:100px 48px 80px; gap:24px; }
.col:first-child { border-right:1px solid rgba(255,255,255,0.06); }
.col-label { font-size:16px; text-transform:uppercase; letter-spacing:3px; opacity:0.35; }
.col-emoji { font-size:80px; }
.col-txt { font-size:28px; font-weight:600; text-align:center; line-height:1.3; }
.col:last-child .col-txt { color:${accent}; }
</style></head><body>
${meme.topicLine ? `<div class="topic" style="text-align:center;">${esc(meme.topicLine)}</div>` : ""}
<div class="cols">
  <div class="col">
    <div class="col-label">Attente</div>
    <span class="col-emoji">${left!.emoji ?? "🤞"}</span>
    <span class="col-txt">${esc(left!.text)}</span>
  </div>
  <div class="col">
    <div class="col-label">Réalité</div>
    <span class="col-emoji">${right!.emoji ?? "😅"}</span>
    <span class="col-txt">${esc(right!.text)}</span>
  </div>
</div>
<div class="brand">ED<b>LIGHT</b></div>
</body></html>`;
}

function renderReaction(meme: IGMemeSlide, accent: string, bg: string): string {
  const [headline, reaction] = meme.panels;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${baseCSS(accent, bg)}
.wrap { height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:100px 80px 80px; gap:56px; text-align:center; }
.headline { font-size:28px; font-weight:500; line-height:1.4; opacity:0.6; max-width:800px; }
.react-emoji { font-size:120px; }
.react-txt { font-size:38px; font-weight:700; color:${accent}; line-height:1.25; max-width:700px; }
</style></head><body>
${meme.topicLine ? `<div class="topic" style="text-align:center;">${esc(meme.topicLine)}</div>` : ""}
<div class="wrap">
  <div class="headline">${esc(headline!.text)}</div>
  <span class="react-emoji">${reaction!.emoji ?? "💀"}</span>
  <div class="react-txt">${esc(reaction!.text)}</div>
</div>
<div class="brand">ED<b>LIGHT</b></div>
</body></html>`;
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

const RENDERERS: Record<IGMemeTemplate, (meme: IGMemeSlide, accent: string, bg: string) => string> = {
  drake: renderDrake,
  "expanding-brain": renderExpandingBrain,
  nobody: renderNobody,
  "starter-pack": renderStarterPack,
  "two-buttons": renderTwoButtons,
  "tell-me": renderTellMe,
  distracted: renderDistracted,
  comparison: renderComparison,
  reaction: renderReaction,
};

/**
 * Build the HTML for a meme slide (1080×1080).
 * Returns a complete HTML document ready for Playwright screenshot.
 */
export function buildMemeSlideHTML(meme: IGMemeSlide): string {
  const accent = TONE_ACCENTS[meme.tone] ?? "#facc15";
  const bg = TONE_BG[meme.tone] ?? "#1a1a2e";
  const renderer = RENDERERS[meme.template];
  return renderer(meme, accent, bg);
}

// Netlify Edge Function (Deno). Generates the share image at /og.
// Renders a cream-and-serif "front page" with the live split, then rasterizes
// it to PNG (resvg-wasm) so it previews on Twitter/iMessage — not just Slack/Discord.
// Defensive by design: PNG is best-effort; on ANY error it falls back to the SVG,
// which is dependency-free and can never fail the request. ?fmt=svg forces SVG.
//
// Variants (by query):
//   /og                              → brand card (homepage default)
//   /og?c=<cat>&i=<item>             → item card  ("78% say Apple is gooey")
//   /og?v=daily&n=&a=&t=&b=          → ballot scorecard
//   /og?v=taste&g=&n=                → taste badge ("I'm 80% gooey")

const PROJECT = "prickles-or-goo";
const CREAM = "#FFF1E5", INK = "#1D1B19", SOFT = "#6B6259", GOOEY = "#0D7680", PRICKLY = "#990F3D", LINE = "#E6D7C9";
const FONT = "PT Serif";

function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fit(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function num(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }

// Shared chrome: cream page, claret rule, wordmark, footer.
function frame(inner, footer) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${CREAM}"/>
  <rect x="0" y="0" width="1200" height="8" fill="${PRICKLY}"/>
  <text x="100" y="118" font-family="${FONT}, Georgia, serif" font-size="26" letter-spacing="6" fill="${PRICKLY}" font-weight="bold">PRICKLES &amp; GOO</text>
  <line x1="100" y1="150" x2="1100" y2="150" stroke="${LINE}" stroke-width="2"/>
  ${inner}
  <text x="100" y="560" font-family="${FONT}, Georgia, serif" font-size="28" fill="${SOFT}" font-style="italic">${esc(footer)}</text>
</svg>`;
}
function splitBar(gp) {
    const gW = Math.round((gp / 100) * 1000);
    return `<g transform="translate(100,380)">
    <rect width="1000" height="34" rx="17" fill="${LINE}"/>
    <clipPath id="r"><rect width="1000" height="34" rx="17"/></clipPath>
    <g clip-path="url(#r)"><rect width="${gW}" height="34" fill="${GOOEY}"/><rect x="${gW}" width="${1000 - gW}" height="34" fill="${PRICKLY}"/></g>
  </g>
  <text x="100" y="470" font-family="${FONT}, Georgia, serif" font-size="24" fill="${GOOEY}" font-weight="bold">GOOEY</text>
  <text x="1100" y="470" text-anchor="end" font-family="${FONT}, Georgia, serif" font-size="24" fill="${PRICKLY}" font-weight="bold">PRICKLY</text>`;
}
// SVG text doesn't wrap, so shrink the headline to fit the 1000px column.
// `max` caps the size for short strings; long strings step down from there.
function autosize(text, max) {
    const len = String(text).length || 1;
    return Math.max(38, Math.min(max || 80, Math.floor(1000 / (len * 0.56))));
}
function headline(text, max) {
    return `<text x="100" y="300" font-family="${FONT}, Georgia, serif" font-size="${autosize(text, max)}" font-weight="bold" fill="${INK}">${esc(text)}</text>`;
}

function buildSvg(params) {
    const v = params.get("v");
    if (v === "taste") {
        const g = Math.max(0, Math.min(100, num(params.get("g"), 50)));
        const n = num(params.get("n"), 0);
        const arch = params.get("a");
        const foot = n ? `${n} vote${n === 1 ? "" : "s"} · what are you? · prickles-and-goo` : "what are you? · prickles-and-goo";
        const inner = arch
            ? headline(fit(arch, 30), 60) +
              `<text x="100" y="350" font-family="${FONT}, Georgia, serif" font-size="40" fill="${SOFT}">I'm ${g}% gooey.</text>` +
              splitBar(g)
            : headline(`I'm ${g}% ${g >= 50 ? "gooey" : "prickly"}.`) + splitBar(g);
        return frame(inner, foot);
    }
    if (v === "daily") {
        const n = num(params.get("n"), 0);
        const a = num(params.get("a"), 0), t = num(params.get("t"), 0);
        const b = params.get("b");
        const head = t ? `${a} of ${t} with the crowd` : "I cast my ballot";
        const inner = headline(head) +
            (b ? `<text x="100" y="380" font-family="${FONT}, Georgia, serif" font-size="34" fill="${SOFT}">Boldest call: ${esc(fit(b, 36))}</text>` : "");
        return frame(inner, `Ballot No. ${n || "—"} · play today's · prickles-and-goo`);
    }
    // item card (c/i) or brand default
    if (params.item && params.name != null) {
        const has = params.tot > 0;
        const me = params.get("me");
        if (has && params.get("hot") && (me === "gooey" || me === "prickly")) {     // contrarian "hot take" card
            const crowd = params.gp >= 50 ? "gooey" : "prickly";
            return frame(
                headline(`${params.gp}% say ${fit(params.name, 18)} is ${crowd}.`, 60) +
                `<text x="100" y="352" font-family="${FONT}, Georgia, serif" font-size="42" font-weight="bold" fill="${me === "gooey" ? GOOEY : PRICKLY}">I'm with the ${me === "gooey" ? "goo" : "prickles"}.</text>` +
                splitBar(params.gp),
                "against the grain · vote at prickles-and-goo"
            );
        }
        const head = has ? `${params.gp}% say ${fit(params.name, 20)} is gooey` : `Is ${fit(params.name, 22)} prickly or gooey?`;
        const foot = has ? `${params.tot} vote${params.tot === 1 ? "" : "s"} · vote at prickles-and-goo` : "be the first to judge · prickles-and-goo";
        return frame(headline(head) + splitBar(has ? params.gp : 50), foot);
    }
    // brand default (homepage)
    return frame(
        `<text x="100" y="280" font-family="${FONT}, Georgia, serif" font-size="78" font-weight="bold" fill="${INK}">Everything is either</text>
         <text x="100" y="370" font-family="${FONT}, Georgia, serif" font-size="78" font-weight="bold"><tspan fill="${PRICKLY}">prickly</tspan><tspan fill="${INK}"> or </tspan><tspan fill="${GOOEY}">gooey</tspan>.</text>`,
        "Vote on tech, money, billionaires — see where the crowd lands · prickles-and-goo"
    );
}

// ---- PNG rasterization (best-effort, cached across invocations) ----
// The PT Serif files in google/fonts are named PT_Serif-Web-*.ttf (not PTSerif-*).
const FONT_BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/";
const FONT_FILES = ["PT_Serif-Web-Bold.ttf", "PT_Serif-Web-Regular.ttf", "PT_Serif-Web-Italic.ttf"];
let _ready = null;
function ensurePng() {
    if (!_ready) {
        _ready = (async () => {
            const mod = await import("https://esm.sh/@resvg/resvg-wasm@2.6.2");
            try { await mod.initWasm(fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm")); }
            catch (e) { if (!/already/i.test(String(e && e.message))) throw e; }   // tolerate re-init across isolates
            const fonts = (await Promise.all(
                FONT_FILES.map((f) => fetch(FONT_BASE + f).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null))
            )).filter(Boolean).map((b) => new Uint8Array(b));
            if (!fonts.length) throw new Error("no fonts loaded");
            return { Resvg: mod.Resvg, fonts };
        })().catch((e) => { _ready = null; throw e; });   // failed init shouldn't poison later requests
    }
    return _ready;
}
async function toPng(svg) {
    const { Resvg, fonts } = await ensurePng();
    const r = new Resvg(svg, {
        font: { fontBuffers: fonts, defaultFontFamily: FONT, loadSystemFonts: false },
        fitTo: { mode: "width", value: 1200 },
    });
    return r.render().asPng();
}

export default async (request) => {
    const params = new URL(request.url).searchParams;

    // Resolve item data up front (item variant only) so failures still yield a card.
    params.item = false; params.name = null; params.gp = 50; params.tot = 0;
    try {
        const cat = params.get("c"), item = params.get("i");
        if (cat && item && !params.get("v")) {
            params.item = true;
            const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/categories/${encodeURIComponent(cat)}/items/${encodeURIComponent(item)}`;
            const doc = await fetch(docUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null);
            params.name = item;
            if (doc && doc.fields) {
                params.name = (doc.fields.name && doc.fields.name.stringValue) || item;
                const g = parseInt((doc.fields.gooey && doc.fields.gooey.integerValue) || "0", 10);
                const p = parseInt((doc.fields.prickly && doc.fields.prickly.integerValue) || "0", 10);
                params.tot = g + p; params.gp = params.tot ? Math.round((g / params.tot) * 100) : 0;
            }
        }
    } catch (_e) { /* fall through to whatever card we can build */ }

    const svg = buildSvg(params);

    if (params.get("fmt") !== "svg") {
        try {
            const png = await toPng(svg);
            return new Response(png, {
                headers: { "content-type": "image/png", "cache-control": "public, max-age=300" },
            });
        } catch (_e) { /* fall back to SVG below */ }
    }
    return new Response(svg, {
        headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300" },
    });
};

export const config = { path: "/og" };

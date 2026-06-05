// Netlify Edge Function (Deno). Generates the share image at /og?c=<cat>&i=<item>.
// Renders a cream-and-serif "front page" SVG with the live gooey/prickly split.
// NOTE: SVG unfurls on Slack/Discord and as a fallback; for full Twitter/iMessage
// PNG previews, render this through Satori + resvg (see README note) — kept as SVG
// here so the function is dependency-free and can never fail the request.

const PROJECT = "prickles-or-goo";
const CREAM = "#FFF1E5", INK = "#1D1B19", SOFT = "#6B6259", GOOEY = "#0D7680", PRICKLY = "#990F3D", LINE = "#E6D7C9";

function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fit(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function svg(name, gp, tot) {
    const has = tot > 0;
    const headline = has ? `${gp}% say ${fit(name, 20)} is gooey` : `Is ${fit(name, 22)} prickly or gooey?`;
    const gW = has ? Math.round((gp / 100) * 1000) : 500;
    const footer = has ? `${tot} vote${tot === 1 ? "" : "s"} · vote at prickles-and-goo` : "be the first to judge · prickles-and-goo";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${CREAM}"/>
  <rect x="0" y="0" width="1200" height="8" fill="${PRICKLY}"/>
  <text x="100" y="118" font-family="Georgia, serif" font-size="26" letter-spacing="6" fill="${PRICKLY}" font-weight="bold">PRICKLES &amp; GOO</text>
  <line x1="100" y1="150" x2="1100" y2="150" stroke="${LINE}" stroke-width="2"/>
  <text x="100" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="80" font-weight="bold" fill="${INK}">${esc(headline)}</text>
  <g transform="translate(100,380)">
    <rect width="1000" height="34" rx="17" fill="${LINE}"/>
    <clipPath id="r"><rect width="1000" height="34" rx="17"/></clipPath>
    <g clip-path="url(#r)">
      <rect width="${gW}" height="34" fill="${GOOEY}"/>
      <rect x="${gW}" width="${1000 - gW}" height="34" fill="${PRICKLY}"/>
    </g>
  </g>
  <text x="100" y="470" font-family="Georgia, serif" font-size="24" fill="${GOOEY}" font-weight="bold">GOOEY</text>
  <text x="1100" y="470" text-anchor="end" font-family="Georgia, serif" font-size="24" fill="${PRICKLY}" font-weight="bold">PRICKLY</text>
  <text x="100" y="560" font-family="Georgia, serif" font-size="28" fill="${SOFT}" font-style="italic">${esc(footer)}</text>
</svg>`;
}

export default async (request) => {
    let name = "Prickles & Goo", gp = 50, tot = 0;
    try {
        const url = new URL(request.url);
        const cat = url.searchParams.get("c"), item = url.searchParams.get("i");
        if (cat && item) {
            const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/categories/${encodeURIComponent(cat)}/items/${encodeURIComponent(item)}`;
            const doc = await fetch(docUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null);
            if (doc && doc.fields) {
                name = (doc.fields.name && doc.fields.name.stringValue) || item;
                const g = parseInt((doc.fields.gooey && doc.fields.gooey.integerValue) || "0", 10);
                const p = parseInt((doc.fields.prickly && doc.fields.prickly.integerValue) || "0", 10);
                tot = g + p; gp = tot ? Math.round((g / tot) * 100) : 0;
            }
        }
    } catch (_e) { /* fall through to defaults */ }
    return new Response(svg(name, gp, tot), {
        headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300" },
    });
};

export const config = { path: "/og" };

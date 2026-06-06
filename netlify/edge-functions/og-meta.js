// Netlify Edge Function (Deno). Rewrites <head> so a shared deep link unfurls
// with the right title/description/image for what was shared — an item verdict,
// a ballot scorecard, or a taste badge. Defensive: on ANY error it returns the
// original page untouched, so a meta failure can never break the site.
//
// Routes handled (see netlify.toml):
//   /i/<cat>/<item>  or  /?c=&i=      → item verdict
//   /ballot/<n>?a=&t=&b=              → ballot scorecard
//   /you?g=&n=                        → taste badge

const PROJECT = "prickles-or-goo";

function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function num(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }

// Decide which card this request is for, returning {title, desc, img} or null.
async function resolve(url, origin) {
    const q = url.searchParams;
    const seg = url.pathname.split("/").filter(Boolean);

    // ----- ballot scorecard -----
    if (seg[0] === "ballot") {
        const n = num(seg[1] || q.get("n"), 0);
        const a = num(q.get("a"), 0), t = num(q.get("t"), 0);
        const b = q.get("b");
        const title = t ? `I sided with the crowd on ${a}/${t} — Ballot No. ${n}` : `Prickles & Goo — Ballot No. ${n}`;
        const desc = b ? `Boldest call: ${b}. Play today's ballot and compare.` : `Play today's ballot and see where you land.`;
        const img = `${origin}/og?v=daily&n=${n}&a=${a}&t=${t}${b ? `&b=${encodeURIComponent(b)}` : ""}`;
        return { title, desc, img };
    }

    // ----- taste badge -----
    if (seg[0] === "you") {
        const g = Math.max(0, Math.min(100, num(q.get("g"), 50)));
        const n = num(q.get("n"), 0);
        const title = `I'm ${g}% gooey on Prickles & Goo`;
        const desc = n ? `${n} votes in. What are you — prickly or gooey?` : `What are you — prickly or gooey?`;
        const img = `${origin}/og?v=taste&g=${g}&n=${n}`;
        return { title, desc, img };
    }

    // ----- item verdict -----
    let cat = q.get("c"), item = q.get("i");
    if (seg[0] === "i") { cat = seg[1] || cat; item = seg[2] || item; }
    if (!cat || !item) return null;                        // home → default meta, untouched

    const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/categories/${encodeURIComponent(cat)}/items/${encodeURIComponent(item)}`;
    const doc = await fetch(docUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!doc || !doc.fields) return null;
    const f = doc.fields;
    const name = (f.name && f.name.stringValue) || item;
    const g = num((f.gooey && f.gooey.integerValue) || "0", 0);
    const p = num((f.prickly && f.prickly.integerValue) || "0", 0);
    const tot = g + p, gp = tot ? Math.round((g / tot) * 100) : 0;
    return {
        title: tot ? `${gp}% say ${name} is gooey` : `Is ${name} prickly or gooey?`,
        desc: tot ? `${tot} votes so far on Prickles & Goo. Cast yours.` : `No votes yet — be the first to judge ${name}.`,
        img: `${origin}/og?c=${encodeURIComponent(cat)}&i=${encodeURIComponent(item)}`,
    };
}

// Replace a tag if present, else inject before </head>.
function setMeta(html, re, tag) {
    return re.test(html) ? html.replace(re, tag) : html.replace("</head>", tag + "</head>");
}

export default async (request, context) => {
    const res = await context.next();
    try {
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("text/html")) return res;

        const url = new URL(request.url);
        const meta = await resolve(url, url.origin);
        if (!meta) return res;                              // default meta is fine

        let html = await res.text();
        html = setMeta(html, /<title>[^<]*<\/title>/, `<title>${esc(meta.title)} · Prickles &amp; Goo</title>`);
        html = setMeta(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(meta.title)}">`);
        html = setMeta(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(meta.desc)}">`);
        html = setMeta(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(meta.desc)}">`);
        html = setMeta(html, /<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="summary_large_image">`);
        html = setMeta(html, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(meta.img)}">`);
        html = setMeta(html, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(meta.img)}">`);

        const headers = new Headers(res.headers);
        headers.delete("content-length");
        return new Response(html, { status: res.status, headers });
    } catch (_e) {
        return res;                                        // never break the page
    }
};

export const config = { path: ["/", "/i/*", "/ballot/*", "/you"] };

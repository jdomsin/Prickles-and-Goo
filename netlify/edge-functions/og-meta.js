// Netlify Edge Function (Deno). Injects per-item OpenGraph meta into index.html
// so a shared link to a specific item unfurls with its live verdict.
// Defensive by design: on ANY error it returns the original page untouched.

const PROJECT = "prickles-or-goo";

function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async (request, context) => {
    const res = await context.next();
    try {
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("text/html")) return res;

        const url = new URL(request.url);
        let cat = url.searchParams.get("c");
        let item = url.searchParams.get("i");
        const seg = url.pathname.split("/").filter(Boolean);   // /i/<cat>/<item>
        if (seg[0] === "i") { cat = seg[1] || cat; item = seg[2] || item; }
        if (!cat || !item) return res;                         // home → default meta, untouched

        const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/categories/${encodeURIComponent(cat)}/items/${encodeURIComponent(item)}`;
        const doc = await fetch(docUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (!doc || !doc.fields) return res;

        const f = doc.fields;
        const name = (f.name && f.name.stringValue) || item;
        const g = parseInt((f.gooey && f.gooey.integerValue) || "0", 10);
        const p = parseInt((f.prickly && f.prickly.integerValue) || "0", 10);
        const tot = g + p;
        const gp = tot ? Math.round((g / tot) * 100) : 0;

        const title = tot ? `${gp}% say ${name} is gooey` : `Is ${name} prickly or gooey?`;
        const desc = tot ? `${tot} votes so far on Prickles & Goo. Cast yours.` : `No votes yet — be the first to judge ${name}.`;
        const img = `${url.origin}/og?c=${encodeURIComponent(cat)}&i=${encodeURIComponent(item)}`;

        let html = await res.text();
        html = html
            .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`)
            .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`)
            .replace(/<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="summary_large_image">`)
            .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} · Prickles &amp; Goo</title>`)
            .replace("</head>", `<meta property="og:image" content="${esc(img)}"><meta name="twitter:image" content="${esc(img)}"></head>`);

        const headers = new Headers(res.headers);
        headers.delete("content-length");
        return new Response(html, { status: res.status, headers });
    } catch (_e) {
        return res;                                            // never break the page
    }
};

export const config = { path: ["/", "/i/*"] };

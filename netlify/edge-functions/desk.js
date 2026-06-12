// The Morning Desk generator (Netlify Edge Function, Deno).
// POST /desk  → harvests live cultural signal (Polymarket markets + Hacker News
// headlines), hands it to Claude with the curator's watchlist, and returns ~24
// ranked candidate cards for today's ballot. The human picks 10 on /desk.html.
//
// Why this exists: prediction markets price OUTCOMES; Prickles & Goo prices FEEL.
// So we pull from the same surface the markets/news track, and ask Claude to find
// the nameable entities where the *feeling* is live — especially where it may
// diverge from the odds. Some entities are "trackers" (the watchlist) so the set
// has day-over-day continuity and texture can be charted over time.
//
// Secrets: ANTHROPIC_API_KEY must be set in the Netlify environment. Everything
// external is best-effort — any feed that fails is skipped, never fatal.

const MODEL = "claude-opus-4-8";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function env(key) {
    try { if (typeof Netlify !== "undefined" && Netlify.env) return Netlify.env.get(key); } catch (_) {}
    try { if (typeof Deno !== "undefined" && Deno.env) return Deno.env.get(key); } catch (_) {}
    return undefined;
}

// Fetch with a hard timeout so one slow feed can't hang the request.
async function getJSON(url, ms = 6000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        const r = await fetch(url, { signal: ctrl.signal, headers: { "accept": "application/json" } });
        if (!r.ok) return null;
        return await r.json();
    } catch (_) { return null; } finally { clearTimeout(t); }
}

// Polymarket: the markets moving most by 24h volume — the entities people are
// actively betting on. We only keep the human-readable question strings.
async function polymarket() {
    const data = await getJSON("https://gamma-api.polymarket.com/markets?closed=false&active=true&order=volume24hr&ascending=false&limit=30");
    if (!Array.isArray(data)) return [];
    return data.map(m => (m && (m.question || m.title || m.groupItemTitle)))
        .filter(s => typeof s === "string" && s.length > 4).slice(0, 24);
}

// Hacker News front page: tech/culture headlines, reliable pure-JSON API.
async function hackernews() {
    const ids = await getJSON("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (!Array.isArray(ids)) return [];
    const top = ids.slice(0, 18);
    const items = await Promise.all(top.map(id => getJSON("https://hacker-news.firebaseio.com/v0/item/" + id + ".json", 4000)));
    return items.filter(Boolean).map(i => i.title).filter(t => typeof t === "string").slice(0, 18);
}

const SYSTEM =
    "You are the morning editor for Prickles & Goo — a daily game where people judge whether a thing is " +
    "GOOEY (warm, soft, endearing) or PRICKLY (sharp, abrasive, cold). It measures FEELING, not facts or odds. " +
    "Prediction markets and the news cycle tell you what people think WILL happen; your job is to surface the " +
    "nameable cultural entities where how people FEEL is live and contested right now — people, companies, assets, " +
    "products, shows, memes, events, ideas. The best cards are recognizable, currently in the discourse, and " +
    "DIVISIVE (people split on the vibe). Boring consensus (a puppy is gooey) is dead weight. Prefer single nameable " +
    "subjects, not headlines. You output only what you are asked for.";

function buildPrompt(date, watchlist, signals, extra) {
    return [
        "Today is " + date + ". Build a candidate pool of ~24 entities for today's ballot.",
        "",
        "MY WATCHLIST (recurring trackers — for day-over-day continuity, include the ones that are LIVE today and mark them tracked:true):",
        watchlist.length ? watchlist.map(w => "- " + w).join("\n") : "(none yet)",
        "",
        "LIVE SIGNAL HARVESTED THIS MORNING (use as grounding for what's culturally hot — extract the nameable subject behind each, don't just echo the headline):",
        signals.length ? signals.map(s => "- " + s).join("\n") : "(no external signal available — rely on your own read of what's live)",
        extra ? "\nCURATOR NOTE: " + extra : "",
        "",
        "Aim for roughly 8 watchlist trackers that are live today + ~16 fresh topical picks. Rank the whole list best-first by a blend of (how live it is today) × (how divisive the feeling is) × (how recognizable it is).",
        "",
        "Return ONLY a JSON object, no prose, of the exact shape:",
        '{"candidates":[{"name":"","kind":"person|company|asset|product|show|meme|event|idea","why":"one short line on why the FEELING is live today","source":"watchlist|polymarket|news|topical","tracked":true,"divisiveness":1-5,"recognizability":1-5}]}'
    ].join("\n");
}

// Pull the JSON object out of the model's text, defensively.
function parseCandidates(text) {
    if (typeof text !== "string") return [];
    let s = text.trim();
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a === -1 || b === -1) return [];
    try {
        const obj = JSON.parse(s.slice(a, b + 1));
        return Array.isArray(obj.candidates) ? obj.candidates : [];
    } catch (_) { return []; }
}

export default async (request) => {
    if (request.method !== "POST") return new Response("POST only", { status: 405 });
    // Admin gate: this endpoint spends real Claude money, so a shared secret is required.
    // Set ADMIN_TOKEN in the Netlify env; /desk.html sends it as x-admin-token. If ADMIN_TOKEN
    // isn't configured, the endpoint stays closed (fail-safe) rather than open.
    const admin = env("ADMIN_TOKEN");
    if (!admin || request.headers.get("x-admin-token") !== admin) {
        return Response.json({ error: "Not authorized." }, { status: 401 });
    }
    const key = env("ANTHROPIC_API_KEY");
    if (!key) return Response.json({ error: "ANTHROPIC_API_KEY is not set in the Netlify environment." }, { status: 500 });

    let body = {};
    try { body = await request.json(); } catch (_) {}
    const watchlist = Array.isArray(body.watchlist) ? body.watchlist.filter(s => typeof s === "string").slice(0, 60) : [];
    const extra = typeof body.note === "string" ? body.note.slice(0, 400) : "";
    const date = new Date().toISOString().slice(0, 10);

    // Harvest the two grounding feeds in parallel; both are best-effort.
    const [pm, hn] = await Promise.all([polymarket(), hackernews()]);
    const signals = [...pm.map(s => "[market] " + s), ...hn.map(s => "[news] " + s)];

    const resp = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 4000,
            system: SYSTEM,
            messages: [{ role: "user", content: buildPrompt(date, watchlist, signals, extra) }]
        })
    });

    if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        return Response.json({ error: "Claude API error " + resp.status, detail: detail.slice(0, 500) }, { status: 502 });
    }
    const data = await resp.json();
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const candidates = parseCandidates(text);

    return Response.json({ date, signalCount: signals.length, candidates });
};

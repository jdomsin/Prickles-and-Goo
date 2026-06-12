#!/usr/bin/env node
// Prickles & Goo — admin CLI. Runs with a Firebase service account (full
// privileges, ignores security rules), so there's no browser, no sign-in, no
// rules-swap. Two jobs:
//
//   node admin.js seed
//       (re)write every category's items. Idempotent (merge) — never touches
//       vote counts. Run it any time you add/change categories in seed-data.json.
//
//   node admin.js ballot "OpenAI, Bitcoin, Sydney Sweeney, the airline meltdown"
//       publish today's daily ballot. Names go into the persistent `daily_pool`
//       category (so votes accrue day-over-day) and ballots/<today> points at
//       them, in order. A leading * on a name is allowed and ignored.
//
// Setup: see README.md (download serviceAccount.json into this folder).

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const KEY = path.join(__dirname, "serviceAccount.json");
if (!fs.existsSync(KEY)) {
    console.error("Missing serviceAccount.json in this folder — see admin/README.md.");
    process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const { categories, wikiOverrides } = JSON.parse(fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf8"));
// Same id scheme as the browser seeder — so we update existing items, never duplicate.
const slug = name => name.toLowerCase().replace(/\+/g, " plus").replace(/#/g, " sharp").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const wikiFor = name => wikiOverrides[name] || name;
const today = () => new Date().toISOString().slice(0, 10);

async function seed() {
    let total = 0;
    for (const cat of categories) {
        await db.collection("categories").doc(cat.id).set({ name: cat.label }, { merge: true });
        let n = 0;
        for (const name of cat.items) {
            const id = slug(name) || ("item-" + (++n));
            const payload = { name };
            if (cat.images) payload.wiki = wikiFor(name);
            await db.collection("categories").doc(cat.id).collection("items").doc(id).set(payload, { merge: true });
            total++;
        }
        console.log("✓ " + cat.label + " (" + cat.items.length + ")");
    }
    console.log("\nSeeded " + categories.length + " categories, " + total + " items.");
}

async function ballot(names) {
    const picks = names.map(s => s.replace(/^\s*\*\s*/, "").trim()).filter(Boolean);
    if (!picks.length) {
        console.error('No names. Usage: node admin.js ballot "OpenAI, Bitcoin, Sydney Sweeney"');
        process.exit(1);
    }
    const slugs = [];
    for (const name of picks) {
        const id = slug(name);
        if (!id) continue;
        // daily_pool items are merge-written so a recurring tracker keeps its votes.
        await db.collection("categories").doc("daily_pool").collection("items").doc(id).set({ name, wiki: name }, { merge: true });
        slugs.push(id);
    }
    await db.collection("ballots").doc(today()).set(
        { date: today(), slugs, title: "The Morning Desk", publishedAt: Date.now() }
    );
    console.log("Published ballot " + today() + " (" + slugs.length + "): " + picks.join(", "));
    console.log("Live on the Daily on next load.");
}

const [cmd, ...rest] = process.argv.slice(2);
(async () => {
    try {
        if (cmd === "seed") {
            await seed();
        } else if (cmd === "ballot") {
            const names = rest.length === 1 ? rest[0].split(/[,\n]/) : rest;   // one quoted list, or shell-split words
            await ballot(names);
        } else {
            console.log('Usage:\n  node admin.js seed\n  node admin.js ballot "OpenAI, Bitcoin, Sydney Sweeney"');
        }
        process.exit(0);
    } catch (e) {
        console.error("Error:", e && e.message ? e.message : e);
        process.exit(1);
    }
})();

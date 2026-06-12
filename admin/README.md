# Prickles & Goo — admin CLI

Seeds categories and publishes the daily ballot from your terminal. No browser,
no sign-in, no Firestore rule changes — the service account has full privileges
and bypasses security rules, so the public rules stay locked down.

## One-time setup (~2 min)

1. **Get a service-account key:** Firebase Console → ⚙️ **Project settings → Service accounts → Generate new private key**. A JSON file downloads.
2. **Save it here as** `admin/serviceAccount.json`. (It's git-ignored — never commit it.)
3. Install deps:
   ```sh
   cd admin
   npm install
   ```

## Use it

**Seed / re-seed everything** (idempotent — never touches vote counts):
```sh
node admin.js seed
```

**Publish today's daily ballot:**
```sh
node admin.js ballot "OpenAI, Bitcoin, Sydney Sweeney, the airline meltdown, pickleball"
```
A leading `*` on a name is fine and ignored. Names go into the `daily_pool`
category (votes accrue day-over-day) and `ballots/<today>` points at them in
order. It's live on the app's Daily on next load.

## Adding / changing categories

Edit `seed-data.json` (`{ categories: [{id, label, images, items:[…]}], wikiOverrides:{…} }`),
then run `node admin.js seed` again. `images:true` pulls Wikipedia art via the
`wiki` title (override the page name in `wikiOverrides` when it differs).

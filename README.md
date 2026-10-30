# Daily Outfit

A personal app that suggests outfits from your own closet, based on the weather and what you're doing that day.

## How it works

1. **Add your clothes.** Pick what it is (jeans, sweater, rain jacket…) and its colour. A photo is optional.
2. **Each morning, open the app.** It checks the forecast for the hours you'll be out and suggests 3 outfits for your plans (work, casual, gym…).
3. **Tell it what you think.**
   - **Wear this:** logs the outfit, so it won't repeat it too soon.
   - **♡:** you like it.
   - **✕:** tell it why (too warm, too dressy…) and it adjusts.
   - **Tap any item** to swap it for something else.
   - **Next day:** it asks whether the outfit felt too cold, just right or too warm.

Everything it learns is listed in Settings, under "What it has learned".

## Putting it on your phone

Open the app's web address on your phone, then:

- **iPhone (Safari):** Share button → **Add to Home Screen**
- **Android (Chrome):** menu → **Add to Home screen** or **Install app**

After that it opens like a normal app and works offline.

## Your data

Your clothes, photos and history are stored **only on your phone**, never on a server. To keep them safe, use **Settings → Download backup** now and then. **Restore backup** loads them on a new phone.

Weather comes from [Open-Meteo](https://open-meteo.com/) (free for personal use, no account needed). Only your approximate location is sent.

---

## For developers

```bash
npm install
npm run dev      # local dev server
npm test         # recommender tests
npm run build    # production build in dist/
```

- `src/engine/`: the recommender. Pure TypeScript, no UI, fully tested.
  - `taxonomy.ts`: clothing types, default warmth and dress level, occasions
  - `weather.ts`: forecast summary for the hours you're out; warmth needed per temperature
  - `recommend.ts`: builds valid outfits with rules (layers, rain, dress code), scores them, picks 3 that differ
  - `profile.ts`: learns from feedback by replaying the event history (undo = delete the event)
- `src/screens/`: Today, Closet, item form, Settings
- `src/db.ts`: on-device storage (IndexedDB via Dexie), backup and restore

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. Pages must be enabled in the repo settings, with the source set to "GitHub Actions".

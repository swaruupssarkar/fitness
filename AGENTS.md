# FitTrack — Codex Instructions

## Knowledge Graph

Before any code change, read `graphify-out/GRAPH_REPORT.md` for architectural context.
Use it to understand which modules are affected (god nodes, community membership) before touching files.

Key facts from graph:
- `getLogs` (Storage) is the most connected node (21 edges) — changes there blast wide
- `esc()` is global XSS guard wired through logger + app — do not scope it back inside an IIFE
- 16 communities detected: Dashboard, Plans, Auth, Logger UI, Charts, History, etc.

Graph files:
- `graphify-out/GRAPH_REPORT.md` — plain-language analysis
- `graphify-out/graph.html` — interactive viz (open in browser)
- `graphify-out/graph.json` — GraphRAG-ready JSON

## Stack

- Vanilla JS SPA — no bundler, no framework
- Firebase Auth (Google Sign-In, popup → redirect fallback)
- Firestore (per-user data isolation, security rules deployed)
- Chart.js 4.4.0 via CDN
- CSS custom properties, dark theme

## File Versions (bump on every save)

- `index.html` — CSP meta tag lives here; bump `?v=N` on all script/css refs
- `css/styles.css?v=71`
- `js/auth.js?v=45`
- `js/storage.js?v=43`
- `js/plans.js?v=43`
- `js/metrics.js?v=44`
- `js/logger.js?v=63`
- `js/charts.js?v=46`
- `js/notes.js?v=3`
- `js/app.js?v=63`

## Rules

- `esc()` must stay global (defined before App IIFE) — logger.js loads before app.js and calls it
- Never add `s.weight > 0` to the save filter in logger.js — breaks in-progress exercises
- CSP `connect-src` must include `wss://*.firebaseio.com` for Firestore realtime
- Do not add SRI hashes to CDN scripts unless you verify the exact hash — wrong hash silently kills the script

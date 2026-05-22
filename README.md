Mafia — LAN PWA

This repository is a starter skeleton for the LAN/PWA Mafia game.

Run development server:

```bash
npm install
npm run dev
```

This project uses Vite, React, TypeScript and Tailwind.

Next steps:
- implement networking (PeerJS wrapper provided in `src/services/peer/PeerService.ts`)
- implement game engine in `src/game`
- wire up PWA service worker and icons

Deployment to GitHub Pages
- This repository includes a GitHub Action that builds and publishes `dist/` to the `gh-pages` branch on each push to `main`.
- If the site shows a white screen after deployment, try clearing the Service Worker in browser DevTools (Application → Service Workers → Unregister) and reload.

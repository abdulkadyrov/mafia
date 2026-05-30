Mafia — LAN PWA

This repository is a starter skeleton for the LAN/PWA Mafia game.

Run development server:

```bash
npm install
npm run dev
```

Run LAN game server for phones on the same Wi-Fi or hotspot:

```bash
npm run lan
```

Open the printed `Network` URL on every phone, for example:

```text
http://192.168.1.20:4173/mafia/
```

If port `4173` is already busy:

```bash
PORT=4174 npm run lan
```

LAN checklist:

- Disable VPN, iCloud Private Relay, and traffic-filtering/ad-blocking apps on the host and phones.
- Keep all devices on the same Wi-Fi or on the same phone hotspot.
- On macOS, allow incoming connections for Node/Terminal in Firewall settings.
- Test the server from the phone by opening `http://HOST_IP:PORT/api/health`. It should return JSON with `"ok": true`.
- An Android phone can be the server through Termux: install Node.js, clone/copy the project, run `npm install`, then `npm run lan`, and open the printed `Network` URL on other devices.

This project uses Vite, React, TypeScript and Tailwind.

Next steps:

- implement networking (PeerJS wrapper provided in `src/services/peer/PeerService.ts`)
- implement game engine in `src/game`
- wire up PWA service worker and icons

Deployment to GitHub Pages

- This repository includes a GitHub Action that builds and publishes `dist/` to the `gh-pages` branch on each push to `main`.
- If the site shows a white screen after deployment, try clearing the Service Worker in browser DevTools (Application → Service Workers → Unregister) and reload.

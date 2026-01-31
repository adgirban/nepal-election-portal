**Nepal Election Portal**

A small web application for visualizing election data in Nepal, including candidates, party symbols, and district-level maps.

**Contents**
- **Overview:** Brief description and purpose.
- **Features:** What the app provides.
- **Architecture:** Frontend and server structure and important files.
- **Data & scripts:** Source data and helper scripts.
- **Setup & Run:** How to run locally and build for production.
- **Development Notes:** Useful implementation details.
- **Contributing & License:** How to help and the project's license/contact info.

**Overview**

This repository contains a React + TypeScript frontend and a minimal Node.js server for serving or proxying election-related data. The app visualizes candidate and party information on a map of Nepal, shows symbols, and supports a small live-vote hook used by the UI.

**Features**
- **District map** with interactive layers and candidate overlays.
- **Candidate list** and search (data-driven from JSON files).
- **Party symbols** loaded from static assets.
- **Live votes hook** for incremental updates (local/dev use).

**Architecture**

- **Frontend:** Vite + React + TypeScript app in `frontend/`.
	- Key entry: [frontend/src/main.tsx](frontend/src/main.tsx)
	- App root: [frontend/src/App.tsx](frontend/src/App.tsx)
	- Components: [frontend/src/components/MapView.tsx](frontend/src/components/MapView.tsx), [frontend/src/components/NavBar.tsx](frontend/src/components/NavBar.tsx)
	- Styles: [frontend/src/styles.css](frontend/src/styles.css) and [frontend/src/App.css](frontend/src/App.css)
	- Static assets: [frontend/public/nepal-districts.geojson](frontend/public/nepal-districts.geojson) and [frontend/public/election-symbols/](frontend/public/election-symbols/)

- **Server:** Minimal Node/ESM server in `server/`.
	- Main server script: [server/index.mjs](server/index.mjs)
	- Purpose: serve APIs or static content for development and act as a thin backend if needed.

**Data & Scripts**

- Application data lives under `frontend/src/data/`:
	- [frontend/src/data/candidates.json](frontend/src/data/candidates.json) — candidate data used by the UI.
	- [frontend/src/data/partySymbols.json](frontend/src/data/partySymbols.json) — mapping of party IDs to symbol filenames.
	- [frontend/src/data/electionInfo.json](frontend/src/data/electionInfo.json) — metadata about the election/districts.

- Utility scripts in the repo root `scripts/` help fetch and prepare data:
	- [scripts/fetchCandidates.mjs](scripts/fetchCandidates.mjs) — script to fetch candidate lists from remote sources.
	- [scripts/fetchPartySymbols.mjs](scripts/fetchPartySymbols.mjs) — script to download party symbol images into `frontend/public/election-symbols/`.

**Setup & Run (Development)**

Prerequisites:
- Node.js (recommended v16+ or newer).
- npm (or yarn).

1. Install dependencies for the frontend and server:

```bash
cd frontend
npm install

cd ../server
npm install
```

2. Run development servers (two terminals):

Frontend:
```bash
cd frontend
npm run dev
```

Server:
```bash
cd server
npm run dev
```

The frontend Vite server serves the UI (default: http://localhost:5173). The server script provides any backend endpoints (see [server/index.mjs](server/index.mjs)).

**Build for Production**

```bash
cd frontend
npm run build
```

The static build output will be in `frontend/dist/`. Serve it with any static host, or wire it into the `server/` code if you prefer a single deployable.

**Development Notes & Implementation Details**

- Map rendering: `MapView` loads the GeoJSON `frontend/public/nepal-districts.geojson` and overlays candidate-related layers.
- Normalization: There is a utility to normalize district names — see [frontend/src/utils/normalizeDistrictName.ts](frontend/src/utils/normalizeDistrictName.ts) (used when mapping data to the GeoJSON features).
- Live updates: The project contains a `useLiveVotes` hook at [frontend/src/hooks/useLiveVotes.ts](frontend/src/hooks/useLiveVotes.ts) that demonstrates how vote updates could be streamed or polled.

**Where to Look First (for contributors)**
- UI: [frontend/src/App.tsx](frontend/src/App.tsx) and [frontend/src/components/MapView.tsx](frontend/src/components/MapView.tsx)
- Data: [frontend/src/data/](frontend/src/data/)
- Server: [server/index.mjs](server/index.mjs)
- Scripts to refresh data: [scripts/](scripts/)

**Troubleshooting**
- If symbols or images do not appear, confirm that `frontend/public/election-symbols/` contains the expected files and that `partySymbols.json` references them correctly.
- If the map doesn't render, check the browser console for errors and ensure the GeoJSON file is reachable at `public/nepal-districts.geojson`.

**Contributing**

1. Fork the repo and create a branch for your feature or bugfix.
2. Make changes and verify locally (`npm run dev`).
3. Open a pull request describing your change and the reason.

**License & Contact**

This project does not include an explicit license file. If you want to add one, create a `LICENSE` at the repo root.

For questions or collaboration, open an issue or contact the repository owner.


# Rice Yield Simulator

Interactive simulator for Philippine rice yields with configurable weather, ENSO state, irrigation, and typhoon probability. The UI supports day-by-day runs, instant multi-cycle sweeps, and exports for analysis.

**Features**
- Configurable planting month, irrigation, ENSO state, typhoon probability, and cycle targets
- Day-by-day simulation with live weather and crop growth visuals
- Instant sweep mode for fast multi-cycle statistics
- Yield charts with distribution, confidence band, and running mean
- CSV export and printable report
- Farmer view with plain-language interpretation

**Tech Stack**
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui + Radix UI
- Zustand state management
- Recharts for data visualization

**Getting Started (Frontend)**
1. `npm install`
2. `npm run dev`

**Backend (Optional)**
The `backend/` directory contains a FastAPI service that mirrors the simulation engine. Run it if you want a server API.

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

**Scripts**
- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run build:dev` — development-mode build
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint
- `npm run test` — run tests once
- `npm run test:watch` — run tests in watch mode

**Project Structure**
- `src/components/` — UI components and tabs
- `src/lib/` — simulation logic and helpers
- `src/store/` — Zustand simulation store
- `backend/` — FastAPI server and Python simulation engine

**Simulation Notes**
- Stochastic elements: daily weather selection, typhoon severity, and yield noise.
- Deterministic elements: base yields, irrigation and ENSO adjustments.

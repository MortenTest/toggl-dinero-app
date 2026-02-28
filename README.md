## Toggl → Dinero Invoice Creator (MVP)

Minimal local tool to fetch tracked hours from Toggl Track and prepare draft invoices for Dinero.

### Prerequisites

- Node.js 20+
- A Toggl Track API token

### Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file (see `.env` template) and set:

```bash
TOGGL_API_TOKEN=your_token_here
TOGGL_WORKSPACE_ID=         # optional, usually resolved automatically
PORT=3000
```

3. Adjust `config.json` if needed (workspace is auto-populated on first Toggl call).

### Running the app

```bash
npm start
```

Then open `http://localhost:3000` in your browser.

### Phase 1

Phase 1 exposes:

- `/api/toggl/workspace`
- `/api/toggl/clients`
- `/api/toggl/summary`
- `/api/config` (GET/POST)

and a minimal single-page UI in `public/` that lets you:

- Connect to Toggl
- Choose a client and date range
- Load and view summarized hours per project


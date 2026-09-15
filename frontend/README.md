# SmartCorp AI — Frontend

The web client for **SmartCorp AI**, an enterprise AI intelligence platform: a permission-aware
RAG assistant, an agentic reasoning and routing layer, a human approval workflow, and the
governance surfaces that make all of it auditable.

Built with **React 19 · TypeScript · Vite · Tailwind CSS · React Router · Recharts · Lucide**.

```
React frontend  →  Django REST API  →  PostgreSQL + pgvector  →  retrieval + agents
```

The Django backend is not in this repository yet. The interface is written against its contract and
runs today on a mock adapter, so every screen is demonstrable before an endpoint exists.

---

## Quick start

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (`0.0.0.0:5173`, `/api` proxied to Django) |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest + Testing Library across the product |
| `npm run lint` | oxlint |

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Base URL for the Django API |
| `VITE_USE_MOCK_API` | `true` | Serve the bundled mock adapter instead of the API |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8000` | Where the dev server proxies `/api` |

Switching to the live backend is a configuration change, not a refactor:

```bash
VITE_USE_MOCK_API=false npm run dev
```

---

## Architecture

```
src/
├── app/            # route table and providers
├── routes/         # navigation map, guards, lazy page registry
├── layouts/        # application shell (sidebar, top bar, command palette)
├── pages/          # 22 route-level screens
├── components/
│   ├── ui/         # design system: buttons, cards, tables, overlays, states, inputs
│   ├── ai/         # citations, evidence panels, reasoning trace, provenance
│   ├── knowledge/  # knowledge base cards, document rows, processing pipeline
│   └── analytics/  # chart frames and the platform's chart set
├── hooks/          # data hooks (one per resource), permissions, async primitives
├── contexts/       # identity, organisation, capabilities, toasts
├── services/       # one module per Django app + the mock adapter
├── types/          # domain types shared with the API contract
└── utils/          # formatting helpers
```

**Transport boundary.** Components never touch `axios`. They call a service function, which calls
`request({ endpoint, method, path, params, body })`. In mock mode that resolves through the adapter
in `src/services/mocks/`; in live mode it hits Django. Failures normalise to a single `AppError`
(`status`, `code`, `message`, `fieldErrors`, `requestId`, `isNetworkError`) that every error state
renders.

**Data boundary.** Pages read through hooks (`useDecisions`, `useDocuments`, `useAnalytics`, …), so
loading, empty, error and refresh behaviour is identical everywhere. No component imports sample
data directly — that is the property that makes the API swap safe.

---

## Design rules the code enforces

- **One professional icon set** (Lucide), one restrained brand accent (indigo), semantic colours for
  state — always paired with a label or icon so meaning is never carried by colour alone.
- **AI visual language, not AI theatre.** No glowing brains, neon, glassmorphism or circuit
  backdrops. Confidence, evidence strength and source provenance are shown as quiet chips, meters
  and citations.
- **No chain-of-thought.** The assistant exposes statements, the retrieved evidence, the agent used,
  routing confidence and response metadata — never internal reasoning steps.
- **Metric honesty.** Analytics and evaluation values carry an `availability` field; when a figure
  has not been measured the UI says *not measured* rather than showing a placeholder number, and
  sample data is labelled as sample data.
- **Contextual processing states.** Retrieval shows *understanding → searching → evaluating
  evidence → preparing*; document ingestion shows *extracting → chunking → embedding → indexing*;
  evaluations show *running → evaluating retrieval → checking citations → calculating*.
- **Accessibility.** Skip link, visible focus rings, semantic headings and landmarks, keyboard-first
  command palette (`⌘K`), deliberate confirmation for consequential actions, and responsive
  reflow — sidebar becomes a drawer, tables become lists, the evidence panel becomes a bottom sheet.

---

## Demo flow

Sign in as any of the demonstration roles (the picker on the login screen fills the credentials).

1. **Overview** — organisation-wide intelligence: priority queue, AI activity, quality signals.
2. **Knowledge** — open *Support Operations*, inspect documents and their processing pipeline.
3. **AI Assistant** — ask about a customer-impacting issue; the answer arrives with evidence,
   citations, the agent used and routing confidence. Ask something the corpus cannot support and it
   returns *insufficient evidence* instead of guessing.
4. **Agents → Router** — see how a cross-functional question is routed, and the considered
   alternatives.
5. **Decision Centre** — review the recommendation raised from that issue: issue, evidence,
   analysis, recommendation and risk. Approve it with a note.
6. **Resulting task** — the approval generates a tracked task with an owner and due date.
7. **Evaluation** — check reliability: quality metrics against targets, recent runs, and the failure
   analysis behind a hallucination case.
8. **Audit Logs** — the approval is already recorded, readable first, with expandable technical detail.
9. **Switch role** from the account menu, then reload a restricted document: the API refuses it and
   the filtered knowledge disappears from the list — the interface reflects access, it does not
   grant it.

---

## Testing

```bash
npm test
```

Vitest renders the real application (routing, guards, services, mock adapter) and asserts the
behaviour the product promises: evidence accompanies answers, approvals require a note and are
recorded, restricted documents are refused for roles outside their access level, and every route
renders real content rather than a blank frame.

## Connecting the Django API

1. Implement the endpoints listed in `src/services/index.ts` (paths are declared per service).
2. Set `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL` to the API origin.
3. Remove `src/services/mocks/` when the last endpoint is live — nothing else references it.

**Access control is not implemented in this frontend.** Every permission check here decides what is
*shown*. The Django API, database row filtering and pre-ranking retrieval filters remain the
authority, and the interface says so wherever access is explained.

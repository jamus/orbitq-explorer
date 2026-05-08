# OrbitQ Explorer

A monorepo containing two frontend implementations — React and Vue 3 — for exploring and visualising space launch data. Built as a companion to the [OrbitQ](https://github.com/jmusreynolds/orbitq-site) mobile app, but with a distinct purpose — rather than tracking launches and sending notifications, this app is a data exploration tool aimed at questions the mobile app can't easily answer.

> "How does Saturn V actually compare to Falcon 9 at true scale? Pick two rockets and see them side by side at true scale, with thrust overlaid."

---

## Project tracking

[Linear project — OrbitQ Explorer](https://linear.app/jmus/project/orbitq-explorer-7bfb63020784)

---

## What makes this different from the mobile app

The OrbitQ mobile app consumes the OrbitQ backend's cached REST endpoints to show upcoming launches and send push notifications. This project takes a different approach:

- The backend is **extended to collect and persist richer reference data** from the Launch Library 2 API — rocket specs, agency histories, launch vehicle families — rather than just caching and proxying responses.
- A **GraphQL API layer** is added to the OrbitQ backend, sitting on top of the new persistent data. This allows flexible, ad-hoc queries that REST endpoints don't support well.
- The React frontend uses **Apollo Client** to query this GraphQL API and render an interactive, true-scale rocket comparison canvas.

---

## Architecture

```
Launch Library 2 API
  └── Data collection jobs (periodic, backend)
        └── PostgreSQL (existing DB, new tables)
              └── GraphQL API (Apollo Server on existing Express app)
                    ├── apps/react — React + Apollo Client
                    └── apps/vue  — Vue 3 + Apollo Composable
```

### Workspace structure

```
orbitq-explorer/
├── apps/
│   ├── react/          # @orbitq/react — React + Vite + Apollo Client
│   └── vue/            # @orbitq/vue   — Vue 3 + Vite + Apollo Composable
├── shared/
│   └── graphql/        # @orbitq/graphql — shared queries and TypeScript types
└── pnpm-workspace.yaml
```

---

## Tech Stack

### apps/react (`@orbitq/react`)
- **React 19** with TypeScript
- **Vite** — build tool and dev server
- **Apollo Client 4** — GraphQL client, query management and caching
- **React Router 7** — client-side routing
- **react-konva** — React bindings for Konva.js; renders the poster canvas (rockets, grid, annotations, overlays) to an HTML Canvas element via a Stage → Layer → Shape hierarchy
- **d3-scale / d3-shape** — D3's math modules (no DOM rendering); used for scale computation and path generation fed into Konva shapes

### apps/vue (`@orbitq/vue`)
- **Vue 3** with TypeScript
- **Vite** — build tool and dev server
- **@vue/apollo-composable** — Vue Composition API bindings for Apollo Client
- **Apollo Client 3** — GraphQL client
- **Vue Router 4** — client-side routing

### shared/graphql (`@orbitq/graphql`)
- Shared GraphQL query documents and TypeScript types consumed by both apps via the pnpm workspace protocol (`workspace:*`)

### Backend additions (to existing OrbitQ Express app)
- **Apollo Server** — GraphQL endpoint added to existing Express app
- New **PostgreSQL tables** for persisted reference data (agencies, launcher families, rocket configs)
- New **data collection services** for periodic LL2 data ingestion

---

## Feature: Rocket Comparison Canvas (v1)

The sole focus of v1 is a polished, two-slot comparison canvas — a "duel" between two launch vehicles. The aim is depth over breadth: one screen done well, rather than several shallow ones.

### Behaviour

- Two rockets are selected for comparison. The mechanism for selection is TBD and not a v1 focus — the canvas is the product.
- The canvas is **hard-capped at two rockets**. The canvas owns layout entirely; the user has no free positioning.
- Both rockets are rendered as **canvas silhouettes at true relative scale** (`length` × `diameter` from the `RocketConfig` GraphQL type), drawn as Konva shapes.
- Both rockets sit on a **shared baseline**. The first selected rocket is on the left, the second on the right.
- The canvas renders over a **fine grid**, giving a technical-poster aesthetic and spatial reference at all zoom levels.
- The canvas supports **pan and zoom** (scroll wheel, pinch-to-zoom, drag to pan). The default view fits both rockets. Double-click resets.
- A single additional dimension — **liftoff thrust (`toThrust`)** — is rendered as a below-baseline overlay anchored to each rocket, proportional to actual thrust.
- Annotation placement follows a **zone-based layout system**: each layer type has a fixed anchor zone relative to its rocket (outer-mid, outer-lower, below, etc.). Zones are compositional and hand-tuned for v1's two-rocket layout. The camera fits to the union of all active zones.

### GraphQL concepts demonstrated

- **Aliases** — fetching two rockets in a single query
- **Field selection** — only the v1-relevant fields requested
- **Nullable handling** — many `RocketConfig` fields are nullable in the schema; the FE handles them gracefully

---

## Out of v1 scope

The following were considered and explicitly deferred. Each can be added later without restructuring v1:

- **More than two rockets** on the canvas (the zone layout system is designed for two; a third would require a generalised packing algorithm and is explicitly deferred)
- **Additional canvas overlays** beyond thrust (e.g. payload halos, launch-mass indicators)
- **Chart panels** alongside the canvas — reliability stack, payload-by-orbit radar, cost-per-kg-to-LEO scatter, maiden-flight timeline
- **Typographical stat blocks** (oversized numbers, monospace accents) for performance / reliability / reusability
- **Reusability iconography**
- **Sharing tool** — both shareable URL state and Open Graph preview cards
- **SEO / SSR** — not a goal; word-of-mouth is the assumed growth path

---

## Backend

The backend work for this project is **done**. The `orbitq-site` repo serves a live GraphQL endpoint at `https://orbitq.app/graphql` against a populated Postgres database. In summary:

- DB tables: `config_agencies`, `config_launcher_families` (self-referential), `config_rockets`, and a `config_rocket_families` join table. LL2 ingestion populates them periodically.
- A nested GraphQL schema over those tables, exposing `Agency`, `LauncherFamily`, `LandingStats`, and `RocketConfig` types, with the queries `rocketConfig(id: Int!)` and `rocketConfigsByIds(ids: [Int!]!)`. The latter is what v1 uses for the two-rocket duel.

The current source of truth for the GraphQL schema is `src/graphql/schema.ts` in the `orbitq-site` repo. This README does not duplicate it — refer there for the canonical types.

---

## Deployment

This app is deployed as a **Railway Static Site service**, in the same Railway project as the OrbitQ backend. The two services deploy independently — pushing to `main` on this repo triggers a frontend build without touching the backend.

### Services in the Railway project

| Service | Repo | Domain | Visibility |
|---|---|---|---|
| `orbitq-site` | Backend API + GraphQL + marketing site | `orbitq.app` *(live)* | Private |
| `orbitq-explorer` | This repo (React frontend) | TBD subdomain on `orbitq.app` (`explorer` or `compare`) | Public |

### Build

Railway uses Nixpacks to detect and build a Vite project. Either a `nixpacks.toml` in the project root will configure the build, or Railway's **Static Site** service type can serve the `dist` folder directly via CDN with no server required (the preferred path).

### CORS

The OrbitQ backend's CORS allow-list includes the deployed FE origin and `http://localhost:5173` (Vite's default dev port).

---

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- The OrbitQ backend running locally (or pointed at the live API at `https://orbitq.app/graphql`)

### Install

```sh
pnpm install
```

### Run

```sh
pnpm dev:react   # starts apps/react on http://localhost:5173
pnpm dev:vue     # starts apps/vue on http://localhost:5174
```

### Build

```sh
pnpm build:react
pnpm build:vue
```

### Lint

```sh
pnpm lint   # runs oxlint across both apps and shared/graphql
```

### Environment variables

Each app reads `VITE_GRAPHQL_URL` from its own `.env.local` file.

| Variable | Description |
|---|---|
| `VITE_GRAPHQL_URL` | URL of the OrbitQ GraphQL endpoint |

In development, create `.env.local` inside `apps/react` and/or `apps/vue`:

```
VITE_GRAPHQL_URL=http://localhost:3000/graphql
```

In production, each app's build is configured to point at `https://orbitq.app/graphql`.

---

## Project Goals

This project is built as a public portfolio piece demonstrating:

- A **bespoke interactive canvas** — a zoomable, poster-aesthetic rocket comparison tool built on Konva.js and react-konva, with a hand-designed zone-based layout engine rather than an off-the-shelf charting approach
- **D3 for computation, Konva for rendering** — using d3-scale and d3-shape as pure math layers to drive canvas geometry, a pattern applicable to any custom canvas visualisation
- React application architecture with TypeScript
- GraphQL API design and consumption with Apollo Client
- Integration with a real, live backend (OrbitQ) that the author built and maintains
- Extending a production REST API with a GraphQL layer without disrupting existing consumers

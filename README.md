# OrbitQ Explorer

🚧 WIP 🚧

Built as a companion to the [OrbitQ](https://www.orbitq.app/) mobile app. An playground to experiment building a data exploration tool aimed at questions like...

> "How does Saturn V actually compare to Falcon 9 at true scale?"

Preview at: https://orbitq-explorer-production-vue.up.railway.app/

---

## Setup

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

| Variable           | Description                        |
| ------------------ | ---------------------------------- |
| `VITE_GRAPHQL_URL` | URL of the OrbitQ GraphQL endpoint |

In development, create `.env.local` inside `apps/react` and/or `apps/vue`:

```
VITE_GRAPHQL_URL=http://localhost:3000/graphql
```

In production, each app's build is configured to point at `https://orbitq.app/graphql`.

---

## Project Goals

... fun trying stuff

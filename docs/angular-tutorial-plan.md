# Angular Tutorial Plan

This plan walks a Vue-experienced developer through adding an Angular app beside the existing Vue and React apps. The goal is to follow the Vue implementation closely enough that concepts transfer cleanly, while still using Angular conventions where they make the app easier to maintain.

## Assumptions

- The new app will live at `apps/angular` and be named `@orbitq/angular`.
- The app should use Angular CLI workspace tooling inside the existing pnpm monorepo. Modern Angular still uses Vite/esbuild internally, but the tutorial should expose the Angular-standard `ng` workflow rather than hand-rolling a Vite app.
- The tutorial should target the latest stable Angular version available when the Angular app is implemented.
- The Angular app should use standalone components only unless a third-party package requires an NgModule bridge.
- The canvas chapters should evaluate `ng2-konva` first, because it provides declarative Angular bindings for Konva. Direct Konva integration remains the fallback if the wrapper blocks parity with the Vue canvas.
- Vue remains the product reference implementation. React is useful mostly as a second example of how apps sit in the pnpm workspace.
- The Angular tutorial should be implemented in small pull requests or merge commits, with each chapter leaving the app buildable.
- The first Angular version should aim for feature parity in stages, not a redesign.

## Confirmed Direction

- Use Angular CLI as the Angular app's build and generation layer, while keeping pnpm workspace scripts as the repo-level entry points.
- Use standalone components, `bootstrapApplication`, provider functions, and direct component imports.
- Use `ng2-konva` as the first canvas implementation path.

## Chapter 1: Create The Angular Workspace App

**Merge goal:** `pnpm dev:angular`, `pnpm build:angular`, and `pnpm typecheck` exist and the empty Angular app runs.

Start by showing how this repo is organised:

- Root workspace config: `pnpm-workspace.yaml`
- App packages: `apps/vue/package.json`, `apps/react/package.json`
- Shared packages: `shared/assets`, `shared/graphql`, `shared/styles`, `shared/canvas-machine`
- Root scripts: `dev:vue`, `dev:react`, `build:vue`, `build:react`, `lint`, `typecheck`

Then scaffold `apps/angular` with a minimal Angular CLI application. Keep the first commit boring:

- `apps/angular/package.json`
- `apps/angular/angular.json` or a root `angular.json` entry, depending on the final workspace shape
- `apps/angular/index.html`
- `apps/angular/src/main.ts`
- `apps/angular/src/app/app.config.ts`
- `apps/angular/src/app/app.component.ts`
- `apps/angular/src/app/app.routes.ts`
- `apps/angular/src/style.css`
- `apps/angular/tsconfig.json`

Vue comparison points:

- Vue creates the app with `createApp(App).use(router).mount("#root")`.
- Angular bootstraps with `bootstrapApplication(AppComponent, appConfig)`.
- Vue single-file components combine template, script, and style; Angular usually keeps component metadata in TypeScript and can use inline or separate templates.
- Vue and React expose Vite config directly; Angular CLI owns its build config through `angular.json` and builder targets.

Angular conventions to prefer:

- Use standalone components.
- Use `appConfig` providers rather than NgModules.
- Keep route definitions in `app.routes.ts`.
- Use Angular's file naming convention: `app-shell.component.ts`, `home-view.component.ts`, etc.

## Chapter 2: Wire The App Into The Monorepo

**Merge goal:** the Angular app participates in the same root commands as Vue and React.

Update the root scripts:

- `dev:angular`
- `build:angular`
- Add Angular to `typecheck`
- Add `apps/angular/src` to `format`
- Add `apps/angular/src` to `lint`

Explain workspace dependencies:

- Internal packages use `workspace:*`.
- Shared code should be imported from packages rather than copied.
- Keep Angular-specific code inside `apps/angular/src`.
- Angular build, serve, and generation settings live in `angular.json`; pnpm scripts should call into those commands.

Vue comparison points:

- `@orbitq/vue` imports shared GraphQL, assets, styles, and the canvas machine.
- Angular should do the same, instead of creating Angular-only duplicates.

Angular conventions to prefer:

- Keep app setup in Angular provider functions.
- Keep environment access at integration boundaries, especially Apollo setup.
- Use Angular CLI generators for routine components and services once the app shape is established.

## Chapter 3: Bring Across Global Styling And The App Shell

**Merge goal:** Angular displays the same OrbitQ visual shell as Vue: dark grid background, main content area, and footer attribution.

Use `apps/vue/src/style.css` and `apps/vue/src/components/AppShell.vue` as the source of truth.

Build:

- `app.component.ts` as the Angular equivalent of Vue's `App.vue`
- `app-shell.component.ts` as the Angular equivalent of `AppShell.vue`
- Import the shared theme from `@orbitq/styles`
- Confirm Tailwind classes and OrbitQ theme tokens work

Vue comparison points:

- Vue uses `<slot />`.
- Angular uses `<ng-content />`.
- Vue wraps route content with `AppShell` in `App.vue`.
- Angular can place `<router-outlet />` inside `app-shell`.

Angular conventions to prefer:

- Use `RouterOutlet` imported directly into the standalone root component.
- Keep shell layout as a presentational component.
- Avoid service state in the shell.

## Chapter 4: Add Routing And The Home View

**Merge goal:** Angular has a routed home view matching the Vue app's top-level structure.

Build:

- `home-view.component.ts`
- Route `/` to the home view
- Render a placeholder for `RocketSelector`
- Render a placeholder for `AppCanvas`

Vue comparison points:

- Vue router uses `createRouter` and a `routes` array.
- Angular uses `provideRouter(routes)`.
- Vue renders routes with `<RouterView />`.
- Angular renders routes with `<router-outlet />`.

Angular conventions to prefer:

- Keep routes as typed `Routes`.
- Use lazy loading later only if feature modules grow; do not add it on day one for a single route.

## Chapter 5: Configure Apollo For Angular

**Merge goal:** Angular can query rocket data from the same GraphQL endpoint as Vue.

Use `apps/vue/src/lib/apollo.ts` and `apps/react/src/lib/apollo.ts` as references.

Build:

- `graphql.provider.ts` or `apollo.provider.ts`
- Angular Apollo client configuration
- Use `VITE_GRAPHQL_URL` consistently with the existing apps
- A smoke-test query in `HomeViewComponent`

Vue comparison points:

- Vue provides `DefaultApolloClient`.
- React wraps the app with an Apollo provider.
- Angular should register Apollo through dependency injection.

Angular conventions to prefer:

- Configure providers at bootstrap.
- Keep Apollo setup outside components.
- Return observables from data services rather than exposing Apollo directly from components where possible.

## Chapter 6: Build The Rocket Data Service

**Merge goal:** Angular has a typed service that fetches rocket lists and selected rocket details.

Use these Vue files as source material:

- `apps/vue/src/components/RocketSelector.vue`
- `apps/vue/src/composables/useRocketData.ts`
- `shared/graphql/src/queries.ts`
- `shared/graphql/src/types.ts`

Build:

- `rocket-data.service.ts`
- `SlimRocket` type alias based on `RocketConfigsQuery`
- `rocketConfigs()` for the selector list
- `rocketConfigsByIds(ids)` for selected rocket detail
- Loading and error states

Vue comparison points:

- Vue composables return refs and computed values.
- Angular services should own shared data access.
- Angular components can consume service observables directly, or convert them to signals.

Angular conventions to prefer:

- Use signals for local UI state where they improve readability.
- Use RxJS for async GraphQL streams.
- Avoid putting Apollo query code directly into complex template components.

## Chapter 7: Rebuild The Rocket Selector

**Merge goal:** Angular can select rocket A and optionally rocket B, matching the Vue app's behavior.

Use `RocketSelector.vue` as the behavioral reference:

- Load all rocket configs
- Default rocket A to Starship V2, ID `527`
- Filter by full name
- Prevent selecting the same rocket on both sides
- Add and remove compare mode
- Show loading, error, and empty states

Build:

- `rocket-selector.component.ts`
- A small typed combobox or accessible listbox implementation
- Two-way data flow with Angular inputs and outputs, or model inputs if the chosen Angular version supports them cleanly

Vue comparison points:

- Vue uses `defineModel` for `rocketA` and `rocketB`.
- Angular should expose selected rockets through `@Input`/`@Output`, signals, or model inputs.
- Vue uses Headless UI. Angular should avoid forcing the same library if the Angular ecosystem has a better option.

Angular conventions to prefer:

- Keep filtering logic in the component or a small pure helper.
- Use Angular template control flow for loading/error/list states.
- Use accessible keyboard behavior if implementing a custom combobox.

## Chapter 8: Recreate Home View Data Flow

**Merge goal:** Angular home view connects selector state to selected rocket detail data.

Use `apps/vue/src/views/HomeView.vue` and `useRocketData.ts`.

Build:

- `rocketA` and `rocketB` selection state
- Derived selected IDs
- Detail query for selected IDs
- `rocketAData`, `rocketBData`
- `rocketAFetching`, `rocketBFetching`
- Pass the data into the canvas placeholder

Vue comparison points:

- Vue uses `ref` and `computed`.
- Angular can use `signal`, `computed`, and `effect` for local state.
- Vue's `useRocketData` composable maps selected rockets to detail records. Angular should express the same idea through a service plus component-level derived state.

Angular conventions to prefer:

- Keep the home view as orchestration.
- Keep selector and canvas components unaware of GraphQL.

## Chapter 9: Port The Node Grid State

**Merge goal:** Angular has node panel state equivalent to `useNodeGrid`.

Use `apps/vue/src/composables/useNodeGrid.ts`.

Build:

- `node-grid.service.ts` or a local class if the state is owned by the canvas
- `NodeTypeId`, `NodeOwner`, node registry, and `NODE_COLUMN_WIDTH`
- Enable, disable, show, hide functions
- Derived node lists for side A and side B
- Thrust visibility state

Vue comparison points:

- Vue uses `reactive` maps and `computed`.
- Angular can use signals for the enabled and visible maps.

Angular conventions to prefer:

- Prefer a service only if multiple components need the state.
- Keep registry constants as plain TypeScript.
- Keep derived state declarative with `computed`.

## Chapter 10: Integrate The Canvas Machine

**Merge goal:** Angular can create and drive the shared XState canvas machine.

Use:

- `apps/vue/src/composables/useCanvasMachine.ts`
- `shared/canvas-machine/src/index.ts`
- `docs/adr/0004-xstate-canvas-machine.md`

Build:

- `canvas-machine.service.ts` or canvas-owned integration
- Create the machine with Angular callbacks
- Expose `send` and `isAnimating`
- Verify `ROCKET_SELECTION_CHANGED` flows from selected rocket data

Vue comparison points:

- Vue uses `@xstate/vue`.
- Angular may not need a framework wrapper if the integration is small.

Angular conventions to prefer:

- Keep XState isolated behind a service or adapter.
- Do not mix state machine setup deeply into the template component.

## Chapter 11: Build The Static Canvas Layout

**Merge goal:** Angular renders the canvas area, side columns, panel placeholders, and rocket placeholders with real sizing behavior.

Use:

- `apps/vue/src/components/AppCanvas.vue`
- `apps/vue/src/components/CanvasPanel.vue`
- `apps/vue/src/components/NodeColumn.vue`
- `apps/vue/src/composables/useBoardSize.ts`

Build:

- `app-canvas.component.ts`
- `canvas-panel.component.ts`
- `node-column.component.ts`
- `board-size` helper using `ResizeObserver`
- Layout constants from Vue
- Derived column widths

Vue comparison points:

- Vue refs map naturally to Angular `viewChild` or template refs.
- Vue `watch` maps to Angular `effect` when using signals.

Angular conventions to prefer:

- Clean up observers with Angular lifecycle helpers.
- Keep layout calculations in TypeScript, not templates.

## Chapter 12: Render Rocket Silhouettes

**Merge goal:** Angular renders selected rockets at true relative scale.

Use:

- `apps/vue/src/components/RocketImage.vue`
- `apps/vue/src/components/HumanFigure.vue`
- `shared/assets`
- `shared/const/diagrams.ts`
- `CONTEXT.md` for domain language: Silhouette, Native Bounding Box, World Scale, Baseline

Build:

- `rocket-image.component.ts` using `ng2-konva` bindings first
- `human-figure.component.ts`
- Path scale factor calculations
- Baseline alignment

Vue comparison points:

- Vue currently uses `vue-konva`.
- Angular should start with `ng2-konva` to keep canvas rendering declarative and reactive.
- If `ng2-konva` cannot express a Vue canvas behavior cleanly, isolate direct Konva calls behind a small Angular component boundary.

Angular conventions to prefer:

- Keep any imperative canvas calls behind a component boundary.
- Do not store mutable Konva objects in template-facing state unless necessary.

## Chapter 13: Port Canvas Animation

**Merge goal:** Angular animates world scale, baseline, opacity, thrust, and stage separation like Vue.

Use:

- `apps/vue/src/composables/useCanvasAnimation.ts`
- `apps/vue/src/components/ThrustIndicator.vue`
- `apps/vue/src/components/ScaleMagnifier.vue`
- `apps/vue/src/components/DiagramContextMenu.vue`

Build:

- Animation helper or service
- Fade out and fade in flows
- Scale and baseline transitions
- Thrust overlay rendering
- Stage separation rendering

Vue comparison points:

- Vue's composable owns animation refs and exposes functions to the machine.
- Angular should expose the same dependency shape to `createCanvasMachine`.

Angular conventions to prefer:

- Keep animation side effects out of services unless the service is explicitly canvas-scoped.
- Use lifecycle cleanup for timers, animation frames, and Konva objects.

## Chapter 14: Port Node Cards And Detail Panels

**Merge goal:** Angular can show the same node cards as Vue.

Use:

- `apps/vue/src/components/NodeCards/CardContainer.vue`
- `apps/vue/src/components/NodeCards/NodeCard.vue`
- `apps/vue/src/components/NodeCards/BlankNode.vue`
- `apps/vue/src/components/NodeCards/EngineCard.vue`
- `apps/vue/src/components/NodeCards/StagesCard.vue`

Build:

- Shared card container
- Generic node card
- Blank state
- Engine configuration card
- Stages card

Vue comparison points:

- Vue uses slots for card composition.
- Angular uses content projection with `<ng-content />`.

Angular conventions to prefer:

- Use small presentational components.
- Keep card data inputs explicit.
- Avoid global state for card display details.

## Chapter 15: Add Tests As The Angular App Gains Behavior

**Merge goal:** the Angular app has focused tests for pure logic and high-risk state flows.

Start with tests that are closest to the existing Vue tests:

- Node grid state
- Board size calculation helper
- Rocket data mapping
- Canvas machine integration adapter

Use existing examples:

- `apps/vue/src/composables/useNodeGrid.test.ts`
- `shared/canvas-machine/src/index.test.ts`
- `shared/utils/parseSvgPaths.test.ts`

Vue comparison points:

- Vue composables are tested directly.
- Angular services and pure helpers should be tested directly.
- Component tests should be added where template behavior carries risk.

Angular conventions to prefer:

- Keep complex behavior in testable TypeScript.
- Avoid brittle canvas snapshot tests at first.
- Add one browser-level smoke test only after the app has meaningful UI.

## Chapter 16: Production Readiness And Deployment Parity

**Merge goal:** Angular can be built, previewed, linted, typechecked, and deployed like the existing apps.

Build:

- `apps/angular/nixpacks.toml` if deployment parity is needed
- Root README update
- Any Angular-specific environment documentation
- Confirm build output path
- Confirm preview command

Vue comparison points:

- Vue has `apps/vue/nixpacks.toml`.
- React has `apps/react/nixpacks.toml`.
- Angular should match the deployment shape unless Angular's build output requires a small adjustment.

Angular conventions to prefer:

- Keep deploy config minimal.
- Avoid introducing a second monorepo tool unless Angular truly needs it.

## Suggested Merge Sequence

1. **Scaffold:** Chapters 1-2
2. **Shell and routing:** Chapters 3-4
3. **GraphQL smoke test:** Chapter 5
4. **Selector and home data flow:** Chapters 6-8
5. **Node state and machine adapter:** Chapters 9-10
6. **Static canvas shell:** Chapter 11
7. **Rocket rendering:** Chapter 12
8. **Animation and overlays:** Chapter 13
9. **Node cards:** Chapter 14
10. **Tests and deployment:** Chapters 15-16

## Teaching Notes For A Vue Developer

The tutorial should repeatedly translate concepts rather than present Angular in isolation:

- Vue `ref` -> Angular `signal`
- Vue `computed` -> Angular `computed`
- Vue `watch` -> Angular `effect`, or RxJS subscription where the source is async
- Vue composable -> Angular service, helper function, or component-local state depending on ownership
- Vue `provide`/`inject` -> Angular dependency injection
- Vue slots -> Angular content projection
- Vue `v-model` -> Angular input/output pairs or model inputs
- Vue Router -> Angular Router providers and route arrays
- Vue Apollo composables -> Apollo Angular through dependency injection and observables

The important judgement call is ownership. Vue composables often feel lightweight enough to use anywhere; Angular services are more explicit and can accidentally become too global. Prefer component-local signals for state that belongs to one component, and services for shared data access, long-lived adapters, or state used across multiple child components.

# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

### `artifacts/web` (`@workspace/web`)

React + Vite frontend for the NetStream IPTV player. Dark cinematic theme designed for Apple TV / big-screen use via Safari/AirPlay. Architecture intentionally mirrors React Native patterns for future iOS/Android app extraction.

- Entry: `src/App.tsx` — wouter routes: `/` (Home), `/play/:id` (Player), `/guide` (TV Guide)
- Pages: `src/pages/Home.tsx` (channel grid), `src/pages/Player.tsx` (full-screen video), `src/pages/Guide.tsx` (TV Guide timeline)
- Components: `src/components/ChannelCard.tsx` (keyboard focus ring + EPG badge, touch-prefetch), `src/components/VideoPlayer.tsx` (hls.js forwardRef + x-webkit-airplay)
- Hooks: All business/device logic is extracted into hooks so it can be swapped for native equivalents later:
  - `use-favorites.ts`, `use-recently-watched.ts` — localStorage (→ AsyncStorage in RN)
  - `use-epg-batch.ts` — batch EPG queries
  - `use-wake-lock.ts` — Screen Wake Lock API (→ `expo-keep-awake` in RN)
  - `use-orientation-lock.ts` — `screen.orientation.lock()` on fullscreen (→ `expo-screen-orientation` in RN)
  - `use-overlay-controls.ts` — tap-to-toggle overlay with auto-hide timer (pure logic, no browser APIs; zero RN changes needed)
  - `use-portrait-mobile.ts` — detects portrait on mobile for rotate prompt (→ `useWindowDimensions` in RN)
  - `use-mobile.tsx` — breakpoint detection
- PWA: manifest at `public/manifest.json`, icons at `public/icon-192.png` + `public/icon-512.png`, apple-touch-icon in `index.html`
- Mobile: `viewport-fit=cover`, safe-area-inset CSS vars (`--sat/--sar/--sab/--sal`), `100dvh` fix, `overscroll-behavior: none`, `scrollbar-hide` utility, all touch targets ≥ 44px
- Uses `@workspace/api-client-react` generated hooks for API calls
- `@workspace/api-client-react` has no browser dependencies — can be used in React Native directly
- Depends on: hls.js, framer-motion, wouter, lucide-react, tailwindcss

## NetStream IPTV App

- **Data source**: 
  - Primary: iptv-org public API (`channels.json` + `streams.json`) — ~8,000 channels with streams from 200+ countries
  - Secondary backup URLs: Free-TV/IPTV GitHub M3U playlist (adds ~1,355 extra stream URLs)
  - Logos: fetched from iptv-org country + category M3U files (top 20 countries)
- **Channels**: ALL channels with public streams from iptv-org (~8,000 total). Special regions: `za-sport` (ZA + sports category), `uk` (UK + English). All other channels use ISO country code as region (e.g. `us`, `de`, `in`).
- **Sync**: `iptv-sync.ts` runs on startup, re-syncs every 6h, health-checks every 1h (channels with streams only). Batch upsert (200 rows/query) for fast sync.
- **API**: `GET /api/channels` supports `region`, `country`, `category`, `search`, `onlineOnly`, `limit` (default 300, max 2000), `offset` — returns `{ channels: [...], total: N }` for pagination.
- **DB schema**: `channelsTable` (id, name, logo, country, region, categories, streamUrl/s, quality, isOnline, lastChecked), `channelHealthTable`, `channelProgramsTable` (EPG — id, channelId→FK, title, description, start, end, category, episode, icon)
- **EPG**: `GET /api/epg/:channelId` (current + upcoming programs), `GET /api/epg/now/batch?ids=...` (batch current programs), `POST /api/epg/sync` (trigger XMLTV sync for a country). Sync logic in `src/lib/epg-sync.ts` using `fast-xml-parser`.
- **Player UX features**: Sleep Timer (15/30/60/90 min), Share button, Picture-in-Picture, Multi-audio/subtitle tracks, Stream Health overlay, TV Mode (press T; always-visible controls + Space=pause)
- **Home UX features**: Recently Watched strip (clock icon, max 10 via localStorage), Keyboard nav (arrows=navigate, Enter=play, /=search, Esc=clear, focus ring on cards), EPG "Now Playing" badge on channel cards, TV Guide button in header
- **Recently Watched tab pattern**: Every page that shows channel cards must include a "Recently Watched" tab as a page-level tab alongside the main content tab. Home uses All Channels / Favorites / Recently Watched tabs. Sports uses Live Sports / Recently Watched tabs. The recently-watched grid shows: logo thumbnail, channel name, country, relative timestamp ("5m ago", "2h ago"), per-card × remove button (hover), and a "Clear all" link. Empty state shows a clock icon with "Nothing watched yet" or page-specific copy. Shared hook: `use-recently-watched.ts` (localStorage, max 10, `RecentChannel` has `id, name, logo, quality, country, categories, watchedAt`). Sports page filters the shared recently-watched list to only show sports channels (by `categories` containing "sports" OR by name matching a sport pattern).
- **Important**: Orval config uses `useDates: true` — Zod schemas expect `Date` objects for date-time fields, not ISO strings. Drizzle returns `Date` objects for timestamp columns, so pass them directly to Zod without `.toISOString()` conversion.
- **Video playback**: All HLS streams go through a server-side proxy (`GET /api/proxy/playlist?url=`, `GET /api/proxy/segment?url=`) to bypass CORS restrictions on external IPTV servers. hls.js is used for Chrome/Firefox; native HLS for Safari/Apple TV (both use the proxy). VideoPlayer cycles through `streamUrls` fallback list (max 3 network retries per URL before trying next). Includes a "Try Again" button on error.
- **HLS Proxy routes**: `src/routes/proxy.ts` — fetches M3U8 from upstream, rewrites all relative segment/sub-playlist URLs to go through `/proxy/playlist` or `/proxy/segment`, pipes segment bytes with Range header support. Mounted in `src/routes/index.ts`. **Note:** A 302-redirect approach for segments was attempted but reverted — HLS.js enforces CORS on redirected segment URLs, and most IPTV CDNs do not serve CORS headers (they target native players). The full proxy is required.
- **Frontend view modes**: Large, Grid, Compact, List — selectable per-session. Count bar shows total + currently showing (pagination).
- **onConflictDoUpdate note**: use `sql\`excluded.column_name\`` with the ACTUAL PostgreSQL snake_case column name, NOT the JavaScript camelCase property name.

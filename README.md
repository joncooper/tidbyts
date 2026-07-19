# Tidbyts

Private Tidbyt dashboards backed by one Cloudflare Worker, D1 database, and a
small local prototype snapshot:

- **Landed PRs** — merged PRs in `dockett/mono-playground` over 24 hours, 7 days, and 30 days.
- **Token Use** — aggregate Codex and Claude token use over the same windows.
- **Bin Quest** — two-person household junk-bin progress, with a mobile web app for updates.
- **Codex Control Tower** — live and recent Codex activity plus batch-job exceptions.
- **Glint** — a tiny animated working companion that celebrates newly landed PRs.
- **Billable Week** — the real weekly total and active timer from the local Timecard app.
- **Exception Screen** — a dedicated all-clear/attention display for local disk and collector health.

The deployed phone app is [tidbyts.jon-cooper.workers.dev/bins/](https://tidbyts.jon-cooper.workers.dev/bins/).

## No Tidbyt subscription required

Tidbyt Plus/Teams is Tidbyt-hosted private-app execution. This project does not use it. Pixlet renders each Starlark app locally, then `pixlet push --installation-id` updates a normal installation in each device's rotation.

That means a local recurring task is responsible for collecting data, rendering the 64×32 images, and pushing them. Cloudflare only stores the small private dataset and serves the mobile UI/API.

## Data flow

```text
local Codex/Claude logs ─┐
authenticated gh CLI ───┼─> local collectors ─> Worker API ─> D1
                        │                         │
phones ─────────────────┘                         └─> Pixlet render ─> Tidbyt devices
```

Only timestamps, provider/model identifiers, aggregate token counts, and the three PR counts leave the Mac. Prompts, code, tool calls, transcript text, file paths, PR titles, and PR bodies are never uploaded.

## First physical push

1. In the Tidbyt phone app, open **Settings → General → Get API Key**. Copy the API token and note the device IDs. `pixlet login && pixlet devices` can also list IDs.
2. Fill the two empty values in `.env.local`:

   ```sh
   TIDBYT_DEVICE_IDS=device-one,device-two
   TIDBYT_API_TOKEN=your-api-token
   ```

3. Run:

   ```sh
   ./scripts/refresh.sh
   ```

The `landed-prs`, `token-use`, and `bin-quest` installation IDs will be added to every listed device. Re-running the script updates those installations rather than creating duplicates.

## Bin Quest on phones

Generate a one-time setup link locally:

```sh
./scripts/household-link.sh
```

Open or AirDrop that link to each phone. The secret is carried in the URL fragment, which browsers do not send to the server; the app stores it locally and immediately removes it from the address bar. Use the gear to set both names, then add and clear bins. The site can be added to the iPhone Home Screen and leaves a native iOS API path open if a TestFlight app becomes worthwhile later.

The 64×32 Tidbyt view shows up to eight bin icons per person. Cleared bins are bright; remaining bins are dim. The numeric fraction always shows the full total.

## Recurring refresh

The Codex automation **Refresh Tidbyt dashboards** runs every 15 minutes. Until Tidbyt credentials are filled in, it refreshes only the D1 data. Once they are present, it automatically runs the complete collector/render/push flow. Notifications are limited to failed runs.

Manual components:

```sh
./scripts/run-usage-collector.sh       # defaults to a 2-hour idempotent lookback
./scripts/run-pr-collector.sh          # uses the existing authenticated gh CLI
./scripts/render-apps.sh               # render live WebPs without pushing
./scripts/push-apps.sh                 # render and push all three apps
./scripts/run-prototype-collector.sh   # collect Codex, Timecard, disk, and health state
./scripts/render-prototypes.sh         # render the four local prototype WebPs
./scripts/push-prototypes.sh           # push only roles configured in .env.local
```

The four prototypes do not install a LaunchAgent. They run inside the same
15-minute Codex updater as the original dashboards. Assign one display per app
with `TIDBYT_CONTROL_TOWER_DEVICE_ID`, `TIDBYT_GLINT_DEVICE_ID`,
`TIDBYT_BILLABLE_WEEK_DEVICE_ID`, and `TIDBYT_EXCEPTION_DEVICE_ID`. Unassigned
roles render locally but are never pushed. Stock Tidbyt API credentials are
device-scoped, so each role also accepts a matching `*_API_TOKEN`; the shared
`TIDBYT_API_TOKEN` remains a fallback for the already configured device.

For a first token-history backfill, use `./scripts/run-usage-collector.sh --days=30`. D1 primary keys make repeated uploads safe.

## Development

Requirements are Node.js, Pixlet, Wrangler, and an authenticated `gh` CLI. Pixlet is installed on macOS with:

```sh
brew install tidbyt/tidbyt/pixlet
```

Useful commands:

```sh
npm install
npm run types
npm run typecheck
npm test
npm run cf:dry-run
npm run deploy
```

`npm test` runs inside Cloudflare's Worker runtime with an isolated local D1 database. Secrets live only in ignored `.dev.vars` and `.env.local` files or as encrypted Cloudflare Worker secrets.

## Cloudflare resources

- Worker: `tidbyts`
- URL: `https://tidbyts.jon-cooper.workers.dev`
- D1 database: `tidbyts`
- Region: eastern North America
- Required secrets: `READ_TOKEN`, `INGEST_TOKEN`, `HOUSEHOLD_TOKEN`

The Worker intentionally has no GitHub credential. PR counting happens locally through `gh`, because local rendering is required for the subscription-free Tidbyt path anyway.

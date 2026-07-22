### Four original displays. One new job.

[Tidbyt](https://tidbyt.com/) made these displays and still runs the platform
behind them. I already owned four original devices, cycling through weather,
sports, and the existing Tidbyt app library.

**TIDBYTS is my software project, not the hardware.** The name is a play on
“tidbits”: small pieces of useful information delivered through Tidbyt. For
Build Week, Codex learned Tidbyt’s Pixlet/Starlark app stack, built new 64×32
views, pushed them through the official device API, and stayed on as the local
automation that keeps the wall current.

### I wanted the answer from across the room

Codex can be working on several tasks while I’m focused somewhere else. One may
be running, another may be waiting for a decision, and a third may have quietly
failed. The information exists, but finding it means checking tasks, terminals,
GitHub, and system monitors.

I didn’t want another dashboard. I wanted one useful answer from across the
room: **does anything need me right now?**

Those four displays now have a second life as a quiet status wall for
AI-assisted development.

### Four tiny screens, one job at a time

Every view is designed for a real 64×32-pixel display. At that size, there is
nowhere to hide a weak hierarchy behind tabs or charts. Each screen has to
decide what matters and make it readable at a glance.

- **Control Tower** shows current Codex work, recent activity, background jobs,
  and anything waiting for me.
- **Exception Screen** stays calm while the system is healthy. A failed build,
  low disk space, stale data, a missing service, or a budget warning gets the
  whole screen.
- **Glint** turns working, waiting, and completion into a small animated
  character, so progress is visible without becoming another interruption.
- **Landed PRs, Token Use, Billable Week, and Bin Quest** make shipped work, AI
  usage, time, and even a household clean-out visible in the same restrained
  visual language.

The displays are intentionally quiet. Animation communicates state; it doesn’t
decorate the screen. Healthy systems recede. The one exception that needs
action becomes impossible to miss.

### Codex built it. Then Codex stayed on.

First, Codex helped me build TIDBYTS. During Build Week, I used Codex Desktop
with **GPT-5.6 (`gpt-5.6-sol`)** to connect the TypeScript collectors,
Cloudflare Worker and D1 database, Pixlet/Starlark apps, and the test suite. It
also helped test
awkward display states such as long labels, two-digit counts, healthy fallbacks,
and failures at the actual 64×32 resolution. The primary July 18 build session
is `019f76ab-6b0a-7d73-a7dd-7e3bc30bb31f`.

Then Codex took on its second job. In my normal setup, one continuing local
Codex automation runs every fifteen minutes on my Mac. It checks current work
and machine health, refreshes the local snapshots, renders the Pixlet views,
and pushes them to the displays. Because that task continues over time, I can
teach it a new check when my setup changes without making the screens any
busier.

That is the part I find most useful: the wall stays simple even as the monitor
behind it evolves.

### The private work stays on my Mac

Prompts, code, transcripts, tool calls, file paths, PR titles, and PR bodies stay
local. They are not copied into the Worker, D1 database, or Tidbyt payloads.

The optional shared path carries only the small facts that need to move between
devices: content-free usage records such as timestamps, provider/model
identifiers, and token counts; pull-request totals; and explicitly entered
household scores. Machine-local state goes directly from the local snapshot
into Pixlet.

Pixlet renders locally and pushes through the normal Tidbyt device API. The
project uses stock firmware and does not depend on Tidbyt Plus, Teams, or paid
private-app hosting.

### Judge it without owning a Tidbyt

The hardware-free demo uses the same checked-in Pixlet output as the physical
displays. It needs no account, API key, private metrics, or rebuild:

- **Live demo:** [tidbyts.jon-cooper.workers.dev/demo/](https://tidbyts.jon-cooper.workers.dev/demo/)
- **Demo film:** [I Gave Codex Four Tiny Screens](https://youtu.be/Xzd62OyThJ4)
- **Source and tests:** [github.com/joncooper/tidbyts](https://github.com/joncooper/tidbyts)

Reviewers can switch among Control Tower, Exception Screen, Glint, delivery and
usage signals, and the privacy architecture directly in the browser. The
repository also includes deterministic Worker/D1 tests and Pixlet render tests
for normal, active, alert, and maximum-width states.

For a local run: `npm ci`, `npm run dev`, then open
`http://localhost:8787/demo/`. Run `npm test` for the deterministic test suite.

### What I stopped checking

The useful part is what I stop doing: checking dashboards. Active work stays
visible without turning every change into a notification.

TIDBYTS is a passive information radiator with a living Codex operator behind
it. As my work changes, Codex can learn new checks and tailor what the wall
shows—without making each display busier. It is an ambient-observability pattern
for developers running several long-lived local agents: keep private context
local, export only state, and interrupt only when attention is useful.

Four original Tidbyt displays now answer the question I kept opening dashboards
to ask: does anything need me? Usually, I just look up.

*Tidbyt is the existing hardware and platform; TIDBYTS is this independent
Codex-powered software project.*

### Four original Tidbyt displays, one new job

[Tidbyt](https://tidbyt.com/) made these displays and still runs the platform
behind them. I already owned four original devices, cycling through weather,
sports, and the existing Tidbyt app library.

**Tidbyts is my software project, not the hardware.** The name is a play on
“tidbits”: small pieces of useful information delivered through Tidbyt. For
Build Week, I used Codex to learn Tidbyt’s Pixlet/Starlark app stack, build new
64×32 views, push them through the official device API, and stay on as the local
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

### Codex has two jobs here

First, Codex helped me build Tidbyts. During Build Week I used Codex Desktop
with **GPT-5.6 Sol** to connect the TypeScript collectors, Cloudflare Worker and
D1 database, Pixlet/Starlark apps, and the test suite. It also helped test
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

### The private work stays on this Mac

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

### Why four old screens matter

The point is not to put more data in the room. It is to protect focus. Tidbyts
lets active work remain visible without turning every change into a notification
or every question into a dashboard visit.

The same pattern can extend beyond my desk: let a local Codex automation watch
the changing systems a developer cares about, keep the private work local, and
give the room one clear signal only when attention is useful.

Four old displays are enough to make that idea tangible. When something needs
me, I just look up.

*Tidbyt is the existing hardware and platform; Tidbyts is this independent
Codex-powered software project.*

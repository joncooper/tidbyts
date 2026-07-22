# TIDBYTS Codex automation recipe

TIDBYTS uses one continuing Codex Desktop automation on the Mac that owns the
displays. It runs every fifteen minutes. Codex is not inside the Tidbyt: it is
the local operator that decides what to check, runs the refresh pipeline, and
leaves each 64×32 view with one clear job.

## Task brief

> From the TIDBYTS repository, refresh the wall with `./scripts/refresh.sh`.
> Keep prompts, code, transcripts, tool calls, file paths, PR titles, and PR
> bodies local. Send only the content-free fields documented in the README.
> Treat each refresh step independently: if one fails, continue safe later
> steps so Exception Screen can report the failure. Finish by checking the
> local refresh status and report whether anything needs attention.

The continuing task can learn another local check as the setup changes. That
changes the monitor behind the wall, not the amount of information on a
display.

## What one run does

| Step | Checked-in implementation | Result |
| --- | --- | --- |
| Collect model use | `scripts/run-usage-collector.sh` | Content-free token totals |
| Collect delivery | `scripts/run-pr-collector.sh` | Merged-PR counts, never titles or bodies |
| Render and push shared views | `scripts/push-apps.sh` | Pixlet output sent through Tidbyt's device API |
| Inspect local work and health | `scripts/run-prototype-collector.sh` | Ignored machine-local snapshots |
| Render and push local views | `scripts/push-prototypes.sh` | Control Tower, Exception Screen, and Glint |

[`scripts/refresh.sh`](../scripts/refresh.sh) records each step as `ok` or
`failed` and continues independent safe steps. Exception Screen reads that
ignored status file, so a broken collector becomes visible instead of silently
leaving stale pixels behind.

## Reproduce it

After the README setup, run:

```bash
./scripts/refresh.sh
```

The recurring Codex automation is the preferred operator because it can evolve
with the developer's setup. A conventional scheduler can run the same script;
the checked-in pipeline and privacy boundary do not depend on Codex Desktop.

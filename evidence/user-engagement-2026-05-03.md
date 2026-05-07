# CRANIS2 — Andi McBurnie's Physical Engagement Timeline

**Source:** Claude Code session transcripts in `~/.claude/projects/-home-mcburnia-cranis2/*.jsonl`.
**What is counted:** every **user-typed message** sent by Andi to Claude Code during a CRANIS2 session. Tool results, queue events, file snapshots, AI titling, etc. are excluded.
**Time zone:** all timestamps converted from UTC to **Europe/Paris** local time.

## Caveat — coverage

Claude Code only retains main-session transcripts at the project top level for sessions in the **15 April — 3 May 2026** window. Earlier sessions only stored subagent records, so they are not represented in this analysis. The numbers below are therefore a **~2.5-week snapshot**, not the full lifetime of CRANIS2.

## Summary

- **Total user-typed messages:** 258
- **First message:** 2026-04-15 07:13:03 CEST
- **Last message:** 2026-05-03 13:19:52 CEST
- **Span:** 19 calendar days
- **Active days:** 7 (37% of the span)
- **Average user messages per active day:** 36.9
- **Number of distinct working sessions** (≥30-min gap = new session): 21
- **Total physical engagement time** (sum of session durations): ≈ **18.6 hours**
- **Average session length:** 53 minutes across 21 sessions

"Physical engagement time" is the time elapsed from each session's first to last user message. It captures the active typing window but excludes time spent reading what Claude produced, testing in the browser, manually running `git push`, building Docker images, configuring services, or thinking. Real time at the keyboard is meaningfully higher than this lower bound.

## Gibbs day-job hours vs personal hours

Gibbs working hours: **Monday–Friday, 09:00–17:00 UK time** (= **10:00–18:00 Europe/Paris**).

| Bucket | User messages | Percentage |
|---|---|---|
| **During Gibbs working hours** | 73 | 28.3% |
| **Outside Gibbs working hours** | 185 | 71.7% |

### Personal-hours breakdown

| Time bucket | User messages | Percentage of all |
|---|---|---|
| Weekend (Sat or Sun, any time) | 104 | 40.3% |
| Weekday outside 09:00–17:00 UK | 81 | 31.4% |
| Early morning Paris 04:00–10:00 (claimed pattern) | 102 | 39.5% |

## Time-of-day distribution (Paris local time)

| Hour | Messages | Bar |
|---|---|---|
| 00:00–00:59 |   0 | `` |
| 01:00–01:59 |   0 | `` |
| 02:00–02:59 |   0 | `` |
| 03:00–03:59 |   0 | `` |
| 04:00–04:59 |   0 | ` ← claimed personal window` |
| 05:00–05:59 |   0 | ` ← claimed personal window` |
| 06:00–06:59 |  11 | `████████ ← claimed personal window` |
| 07:00–07:59 |  44 | `███████████████████████████████████ ← claimed personal window` |
| 08:00–08:59 |  21 | `████████████████ ← claimed personal window` |
| 09:00–09:59 |  26 | `████████████████████ ← claimed personal window` |
| 10:00–10:59 |  50 | `████████████████████████████████████████ ← Gibbs` |
| 11:00–11:59 |  12 | `█████████ ← Gibbs` |
| 12:00–12:59 |  42 | `█████████████████████████████████ ← Gibbs` |
| 13:00–13:59 |  19 | `███████████████ ← Gibbs` |
| 14:00–14:59 |  12 | `█████████ ← Gibbs` |
| 15:00–15:59 |   4 | `███ ← Gibbs` |
| 16:00–16:59 |  12 | `█████████ ← Gibbs` |
| 17:00–17:59 |   1 | ` ← Gibbs` |
| 18:00–18:59 |   4 | `███` |
| 19:00–19:59 |   0 | `` |
| 20:00–20:59 |   0 | `` |
| 21:00–21:59 |   0 | `` |
| 22:00–22:59 |   0 | `` |
| 23:00–23:59 |   0 | `` |

## Day-of-week distribution

| Day | Messages | Percentage |
|---|---|---|
| Mon | 0 | 0.0% |
| Tue | 67 | 26.0% |
| Wed | 26 | 10.1% |
| Thu | 52 | 20.2% |
| Fri | 9 | 3.5% |
| Sat (weekend) | 47 | 18.2% |
| Sun (weekend) | 57 | 22.1% |

## Daily engagement windows — every active day

| Date | Day | First msg | Last msg | Span | Messages | Sessions |
|---|---|---|---|---|---|---|
| 2026-05-03 | Sun | 07:31 | 13:19 | 5h48m | 57 | 3 |
| 2026-05-02 | Sat | 12:00 | 18:28 | 6h28m | 47 | 5 |
| 2026-05-01 | Fri | 08:04 | 10:14 | 2h10m | 9 | 2 |
| 2026-04-30 | Thu | 07:05 | 16:25 | 9h20m | 52 | 2 |
| 2026-04-29 | Wed | 07:36 | 07:47 | 0h11m | 2 | 1 |
| 2026-04-28 | Tue | 06:32 | 18:37 | 12h04m | 67 | 5 |
| 2026-04-15 | Wed | 07:13 | 13:49 | 6h36m | 24 | 3 |

## Per-session breakdown (chronological)

| # | Date | Day | Start (Paris) | End (Paris) | Duration | Messages |
|---|---|---|---|---|---|---|
| 1 | 2026-04-15 | Wed | 07:13 | 07:54 | 0h41m | 9 |
| 2 | 2026-04-15 | Wed | 09:42 | 10:46 | 1h04m | 13 |
| 3 | 2026-04-15 | Wed | 13:45 | 13:49 | 0h04m | 2 |
| 4 | 2026-04-28 | Tue | 06:32 | 08:52 | 2h19m | 23 |
| 5 | 2026-04-28 | Tue | 09:53 | 10:59 | 1h05m | 11 |
| 6 | 2026-04-28 | Tue | 12:27 | 13:01 | 0h34m | 20 |
| 7 | 2026-04-28 | Tue | 13:51 | 14:59 | 1h08m | 12 |
| 8 | 2026-04-28 | Tue | 18:37 | 18:37 | 0s | 1 |
| 9 | 2026-04-29 | Wed | 07:36 | 07:47 | 0h11m | 2 |
| 10 | 2026-04-30 | Thu | 07:05 | 10:15 | 3h10m | 46 |
| 11 | 2026-04-30 | Thu | 16:13 | 16:25 | 0h12m | 6 |
| 12 | 2026-05-01 | Fri | 08:04 | 08:20 | 0h15m | 6 |
| 13 | 2026-05-01 | Fri | 10:13 | 10:14 | 0h01m | 3 |
| 14 | 2026-05-02 | Sat | 12:00 | 14:05 | 2h05m | 32 |
| 15 | 2026-05-02 | Sat | 14:59 | 15:05 | 0h06m | 2 |
| 16 | 2026-05-02 | Sat | 15:50 | 16:26 | 0h35m | 9 |
| 17 | 2026-05-02 | Sat | 17:39 | 17:39 | 0s | 1 |
| 18 | 2026-05-02 | Sat | 18:15 | 18:28 | 0h13m | 3 |
| 19 | 2026-05-03 | Sun | 07:31 | 08:09 | 0h37m | 14 |
| 20 | 2026-05-03 | Sun | 08:41 | 09:01 | 0h20m | 2 |
| 21 | 2026-05-03 | Sun | 09:32 | 13:19 | 3h47m | 41 |

## Methodology

- One JSONL line in the session file = one event. Events have a normalised `timestamp` field (UTC ISO 8601).
- A "user-typed message" is filtered as: `type == "user"` AND `message.role == "user"` AND content contains a real text block (not just a tool-result block).
- A "session" here means a burst of user activity with no more than a 30-minute gap between consecutive user messages. New gap > 30 minutes starts a new session.
- DST transitions handled via Python `zoneinfo`.
- Times of day are based on Europe/Paris local time. Gibbs hours are checked in UK local time.

Generated: 2026-05-03 13:23:56 CEST

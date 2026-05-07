#!/usr/bin/env python3
"""
CRANIS2 — Andi McBurnie's actual physical engagement timeline.

Parses Claude Code session transcripts to find timestamps of every
**user-typed** message. Tool results, queue operations, file snapshots,
AI titling and similar non-user events are excluded — we want only
moments when Andi actively typed an instruction.

Sessions covered: April 15 — May 3, 2026 (the only window for which
transcripts are retained at the top level of the project directory).
"""
import json
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from collections import defaultdict, Counter
import glob

PARIS = ZoneInfo('Europe/Paris')
LONDON = ZoneInfo('Europe/London')

SESSION_DIR = os.path.expanduser('~/.claude/projects/-home-mcburnia-cranis2')

DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

def is_real_user_message(entry):
    """A real user-typed message vs a tool-result auto-injected as 'user'."""
    if entry.get('type') != 'user':
        return False
    msg = entry.get('message')
    if not isinstance(msg, dict):
        return False
    if msg.get('role') != 'user':
        return False
    content = msg.get('content')
    # Pure string content = user typed input
    if isinstance(content, str):
        return True
    # List content: only count if at least one text block (not pure tool_result)
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict):
                btype = block.get('type')
                if btype == 'text':
                    # Likely real user text
                    return True
                if btype == 'tool_result':
                    continue
        # No text blocks found, only tool results
        return False
    return False


# --- Gather all user messages across sessions -----------------------------
user_msgs = []
for path in sorted(glob.glob(os.path.join(SESSION_DIR, '*.jsonl'))):
    session_id = os.path.basename(path).replace('.jsonl', '')
    with open(path) as f:
        for line in f:
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not is_real_user_message(d):
                continue
            ts = d.get('timestamp')
            if not ts:
                continue
            try:
                # Claude Code timestamps are ISO with 'Z' suffix
                ts_utc = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            except ValueError:
                continue
            user_msgs.append({
                'ts_utc': ts_utc,
                'paris': ts_utc.astimezone(PARIS),
                'uk': ts_utc.astimezone(LONDON),
                'session': session_id,
            })

user_msgs.sort(key=lambda x: x['ts_utc'])
total = len(user_msgs)

if total == 0:
    print('No user messages found.')
    raise SystemExit(0)

# --- Categorise -----------------------------------------------------------
gibbs_hours = []
personal_hours = []
weekend = []
weekday_outside_gibbs = []
early_morning = []
for m in user_msgs:
    uk = m['uk']
    paris = m['paris']
    is_weekend = uk.weekday() >= 5
    is_weekday = not is_weekend
    is_uk_work = 9 <= uk.hour < 17
    if is_weekday and is_uk_work:
        gibbs_hours.append(m)
    else:
        personal_hours.append(m)
        if is_weekday:
            weekday_outside_gibbs.append(m)
    if is_weekend:
        weekend.append(m)
    if 4 <= paris.hour < 10:
        early_morning.append(m)

# --- Sessions: bursts of user messages with <= 30 min gap = one session ---
SESSION_GAP_MIN = 30  # minutes
sessions = []
cur_session = []
for m in user_msgs:
    if not cur_session:
        cur_session.append(m)
        continue
    gap = (m['ts_utc'] - cur_session[-1]['ts_utc']).total_seconds() / 60.0
    if gap <= SESSION_GAP_MIN:
        cur_session.append(m)
    else:
        sessions.append(cur_session)
        cur_session = [m]
if cur_session:
    sessions.append(cur_session)

# Session length stats
session_durations = []
for s in sessions:
    dur = (s[-1]['ts_utc'] - s[0]['ts_utc']).total_seconds()
    session_durations.append(dur)
total_session_seconds = sum(session_durations)
total_session_hours = total_session_seconds / 3600.0

# Hour-of-day (Paris)
hour_counts = Counter(m['paris'].hour for m in user_msgs)
# Day-of-week (Paris)
dow_counts = Counter(m['paris'].weekday() for m in user_msgs)
# Active days (Paris)
active_days = sorted({m['paris'].date() for m in user_msgs})
# Per-day windows
daily = defaultdict(list)
for m in user_msgs:
    daily[m['paris'].date()].append(m)

# --- Output ---------------------------------------------------------------
print('# CRANIS2 — Andi McBurnie\'s Physical Engagement Timeline')
print('')
print('**Source:** Claude Code session transcripts in '
      '`~/.claude/projects/-home-mcburnia-cranis2/*.jsonl`.')
print('**What is counted:** every **user-typed message** sent by Andi to '
      'Claude Code during a CRANIS2 session. Tool results, queue events, '
      'file snapshots, AI titling, etc. are excluded.')
print('**Time zone:** all timestamps converted from UTC to **Europe/Paris** local time.')
print('')
print('## Caveat — coverage')
print('')
print('Claude Code only retains main-session transcripts at the project '
      'top level for sessions in the **15 April — 3 May 2026** window. '
      'Earlier sessions only stored subagent records, so they are not '
      'represented in this analysis. The numbers below are therefore a '
      '**~2.5-week snapshot**, not the full lifetime of CRANIS2.')
print('')
print('## Summary')
print('')
print(f'- **Total user-typed messages:** {total}')
print(f'- **First message:** {user_msgs[0]["paris"].strftime("%Y-%m-%d %H:%M:%S %Z")}')
print(f'- **Last message:** {user_msgs[-1]["paris"].strftime("%Y-%m-%d %H:%M:%S %Z")}')
span_days = (user_msgs[-1]['paris'].date() - user_msgs[0]['paris'].date()).days + 1
print(f'- **Span:** {span_days} calendar days')
print(f'- **Active days:** {len(active_days)} '
      f'({len(active_days) / span_days * 100:.0f}% of the span)')
print(f'- **Average user messages per active day:** {total / len(active_days):.1f}')
print(f'- **Number of distinct working sessions** (≥30-min gap = new session): {len(sessions)}')
print(f'- **Total physical engagement time** (sum of session durations): '
      f'≈ **{total_session_hours:.1f} hours**')
print(f'- **Average session length:** '
      f'{total_session_seconds / len(sessions) / 60:.0f} minutes '
      f'across {len(sessions)} sessions')
print('')
print('"Physical engagement time" is the time elapsed from each session\'s '
      'first to last user message. It captures the active typing window '
      'but excludes time spent reading what Claude produced, testing in '
      'the browser, manually running `git push`, building Docker images, '
      'configuring services, or thinking. Real time at the keyboard is '
      'meaningfully higher than this lower bound.')
print('')
print('## Gibbs day-job hours vs personal hours')
print('')
print('Gibbs working hours: **Monday–Friday, 09:00–17:00 UK time** '
      '(= **10:00–18:00 Europe/Paris**).')
print('')
print('| Bucket | User messages | Percentage |')
print('|---|---|---|')
print(f'| **During Gibbs working hours** | {len(gibbs_hours)} | '
      f'{len(gibbs_hours) / total * 100:.1f}% |')
print(f'| **Outside Gibbs working hours** | {len(personal_hours)} | '
      f'{len(personal_hours) / total * 100:.1f}% |')
print('')
print('### Personal-hours breakdown')
print('')
print('| Time bucket | User messages | Percentage of all |')
print('|---|---|---|')
print(f'| Weekend (Sat or Sun, any time) | {len(weekend)} | '
      f'{len(weekend) / total * 100:.1f}% |')
print(f'| Weekday outside 09:00–17:00 UK | {len(weekday_outside_gibbs)} | '
      f'{len(weekday_outside_gibbs) / total * 100:.1f}% |')
print(f'| Early morning Paris 04:00–10:00 (claimed pattern) | '
      f'{len(early_morning)} | {len(early_morning) / total * 100:.1f}% |')
print('')
print('## Time-of-day distribution (Paris local time)')
print('')
print('| Hour | Messages | Bar |')
print('|---|---|---|')
maxbar = max(hour_counts.values()) if hour_counts else 1
for h in range(24):
    n = hour_counts.get(h, 0)
    bar_len = int(40 * n / maxbar) if maxbar else 0
    note = ''
    if 10 <= h < 18:
        note = ' ← Gibbs'
    elif 4 <= h < 10:
        note = ' ← claimed personal window'
    print(f'| {h:02d}:00–{h:02d}:59 | {n:>3} | `{"█" * bar_len}{note}` |')
print('')
print('## Day-of-week distribution')
print('')
print('| Day | Messages | Percentage |')
print('|---|---|---|')
for i, name in enumerate(DOW):
    n = dow_counts.get(i, 0)
    flag = ' (weekend)' if i >= 5 else ''
    print(f'| {name}{flag} | {n} | {n / total * 100:.1f}% |')
print('')
print('## Daily engagement windows — every active day')
print('')
print('| Date | Day | First msg | Last msg | Span | Messages | Sessions |')
print('|---|---|---|---|---|---|---|')
for d in sorted(daily.keys(), reverse=True):
    dm = daily[d]
    times = sorted(m['paris'] for m in dm)
    span = times[-1] - times[0]
    h, rem = divmod(int(span.total_seconds()), 3600)
    m_ = rem // 60
    span_str = f'{h}h{m_:02d}m' if h or m_ else '–'
    # Sessions intersecting this day
    day_sessions = sum(
        1 for s in sessions if s[0]['paris'].date() <= d <= s[-1]['paris'].date()
    )
    print(f'| {d} | {DOW[d.weekday()]} | {times[0].strftime("%H:%M")} '
          f'| {times[-1].strftime("%H:%M")} | {span_str} '
          f'| {len(dm)} | {day_sessions} |')
print('')
print('## Per-session breakdown (chronological)')
print('')
print('| # | Date | Day | Start (Paris) | End (Paris) | Duration | Messages |')
print('|---|---|---|---|---|---|---|')
for i, s in enumerate(sessions, 1):
    start = s[0]['paris']
    end = s[-1]['paris']
    dur = end - start
    h, rem = divmod(int(dur.total_seconds()), 3600)
    m_ = rem // 60
    sec = rem % 60
    if h or m_:
        dur_str = f'{h}h{m_:02d}m'
    else:
        dur_str = f'{sec}s'
    print(f'| {i} | {start.date()} | {DOW[start.weekday()]} '
          f'| {start.strftime("%H:%M")} | {end.strftime("%H:%M")} '
          f'| {dur_str} | {len(s)} |')
print('')
print('## Methodology')
print('')
print('- One JSONL line in the session file = one event. Events have a '
      'normalised `timestamp` field (UTC ISO 8601).')
print('- A "user-typed message" is filtered as: `type == "user"` AND '
      '`message.role == "user"` AND content contains a real text block '
      '(not just a tool-result block).')
print('- A "session" here means a burst of user activity with no more '
      'than a 30-minute gap between consecutive user messages. New gap > '
      '30 minutes starts a new session.')
print('- DST transitions handled via Python `zoneinfo`.')
print('- Times of day are based on Europe/Paris local time. Gibbs hours '
      'are checked in UK local time.')
print('')
print(f'Generated: {datetime.now(PARIS).strftime("%Y-%m-%d %H:%M:%S %Z")}')

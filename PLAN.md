# PLAN — Today OS MVP

## Scope (strict MVP)
- Add a Today view (single screen) with:
  - Top 3 priorities + up to 2 optional tasks (hard caps)
  - Today-only time blocks with buffers
  - Start Next → Focus Mode (hide non‑essential UI)
- Quick Add → Inbox with auto‑triage (task vs event), duration estimation, slot suggestion
- Time‑blindness helpers: countdown to next transition + Auto‑replan button
- Executive scaffolding: optional “First 30 seconds” micro‑step + tag batching
- Data model + local persistence + unit tests

## Files to create
- `today-os.js` — pure logic (triage, durations, buffers, replan, caps)
- `tests/today-os.test.js` — unit tests (node)

## Files to update
- `index.html` — add Today view, Quick Add, Focus Mode, Inbox
- `styles.css` — low‑stimulus layout, focus mode styles
- `app.js` — wire Today view to logic + persistence
- `README.md` — Today OS usage + how to run tests

## Data shapes (localStorage)
- Task: { id, title, duration, tags[], microStep?, status, priority?, createdAt, suggestedStart? }
- EventBlock: { id, title, date, start, duration, tags[], protected }
- BufferBlock: { id, start, duration, kind: 'buffer' } (derived)
- Preferences: { bufferMinutes, visualDensity, reminderStyle, protectedBlocks[] }

## Algorithm notes
- Triage: time in text → EventBlock; else Task
- Duration: task 25m default; study/essay/homework → 50m; email/message/call → 10–15m
- Buffers: insert 5–10m between blocks
- Auto‑replan: shift remaining blocks after “now”; preserve protected blocks; overflow → Inbox (deferred)

## Tests
- Unit tests for: duration estimation, triage, buffer insertion, auto‑replan, hard caps

# Calmynt

Calmynt is a cozy, low-stimulation Today OS calendar with streaks, a Pomodoro timer, and a weekly block scheduler. Built to be simple, calm, and inclusive for different focus styles.

## Features
- Weekly calendar view for study blocks
- Drag blocks to reschedule in the week view
- Pomodoro timer with focus/break presets + custom durations
- Streak tracking based on completed blocks
- Done confirmation with undo
- Image support per block (up to 5MB, stretched to fit)
- Today OS view (priorities, inbox, quick add, auto-replan)
- Simple mode (hide advanced controls)
- Power mode (shows advanced controls)
- LocalStorage persistence
- Import/export JSON

## Getting started
Open `index.html` in a browser. No build tools required.

## Today OS (MVP)
- **Top priorities**: cap of 3 must-do + 2 optional tasks.
- **Quick Add**: type a task or event (“2pm” becomes an event).
- **Auto-replan**: one click shifts remaining blocks and defers overflow into Inbox.
- **Focus Mode**: Start Next hides non-essential UI.

### Constraints
- No recurring events, multi-calendar sync, or notifications.
- Protected blocks are preserved during replanning.

### Measurable UX outcomes
- Capture to inbox in under 5 seconds.
- Today list never exceeds 5 items.
- Auto-replan completes in a single click.

## Inclusive-by-design choices
- Low-stimulation palette and pixel-friendly typography
- Simple mode (enabled by default) to reduce choices and cognitive load
- Confirmation before destructive actions

## Data
All data is stored locally in the browser (LocalStorage). Export JSON to back up or move data.

## Privacy
See `PRIVACY.md` for the GDPR‑aligned privacy policy.

## Fonts
This project ships with `DejaVu Sans Mono` (see `fonts/DejaVuSansMono-LICENSE.txt`).

## Tests
Run unit tests (requires Node.js):

```
node tests/today-os.test.js
```

## License
MIT — Copyright © 2026 Vittoria Lanzo.

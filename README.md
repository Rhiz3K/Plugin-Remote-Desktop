# Evidence for Rhiz3K/Plugin-Remote-Desktop PR #1

Screenshots and logs only; no plugin code. Generated on 2026-11-11.

- `harness/`: a minimal browser harness. It bundles the PR's `guacamole-pointer.ts`, `guacamole-scroll.ts` and `guacamole-soft-keyboard.ts` with the real `guacamole-common-js` Touchscreen/Touchpad emulators, plus a capture-phase two-finger handler that mirrors `GuacamoleDisplay.tsx`. `run.py` drives it with Playwright (Chrome, 390x760 mobile viewport, DPR 3, touch) through CDP `Input.dispatchTouchEvent`. The "remote" log lists the pointer and key events that would be sent to guacd.
- `screenshots/base-*`: before, at `8f42e6f`. `screenshots/branch-*`: after, at `d5a9ac9`.
- `summary.json`: the counts per scenario. `verify-round3.log`: the repo checks and mutation runs.

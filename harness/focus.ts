// Mirrors the focus handling of GuacamoleDisplay.tsx with the real Guacamole
// Touchscreen emulator and the PR's pointer gate. MODE "before" = d5a9ac9
// (sendMouseState always focuses the display); "after" = round 4 (skip while
// the soft-keyboard textarea is focused; real presses focus in capture phase).
import { bindPointerInput, createTouchGestureGate } from "./branch/guacamole-pointer.ts";
declare const LABEL: string;
declare const MODE: string;
document.getElementById("label")!.textContent = LABEL;
const out = document.getElementById("log")!;
const show = (s: string) => { out.textContent = s + "\n" + out.textContent; };
const display = document.getElementById("display")!;
display.tabIndex = 0;
const ta = document.getElementById("kbd") as HTMLTextAreaElement;
const events: any[] = []; (window as any).focusLog = events;
const t0 = performance.now();
const note = (what: string) => {
  const a = document.activeElement === ta ? "keyboard textarea" : document.activeElement === display ? "display" : String(document.activeElement?.tagName);
  events.push({ t: Math.round(performance.now() - t0), what, active: a });
  show(`+${Math.round(performance.now() - t0)} ms ${what} -> focus: ${a}`);
};
const sendMouseState = (s: any) => {
  if (MODE === "after") { if (document.activeElement !== ta) display.focus({ preventScroll: true }); }
  else display.focus({ preventScroll: true });
  if (s.left || events.length) note(`mouse ${s.left ? "press" : "release"} sent`);
};
if (MODE === "after") {
  const f = () => display.focus({ preventScroll: true });
  display.addEventListener("mousedown", f, true);
  display.addEventListener("touchstart", f, { capture: true, passive: true });
}
bindPointerInput(display, "touchscreen", sendMouseState, createTouchGestureGate());
(window as any).openSoftKeyboard = () => { ta.focus({ preventScroll: true }); note("toolbar: Show keyboard"); };

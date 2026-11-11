// Minimal browser harness: real Guacamole.Mouse.Touchscreen + the plugin's
// pointer gate and soft-keyboard tracker, with a capture-phase two-finger
// handler that mirrors GuacamoleDisplay.tsx (claim, stopPropagation, end).
import { bindPointerInput, createTouchGestureGate } from "SRC/guacamole-pointer.ts";
import { createPressedKeyTracker, specialKeysymFromKeyboardEvent } from "SRC/guacamole-soft-keyboard.ts";

declare const LABEL: string;
const log: any[] = [];
(window as any).remoteLog = log;
const out = document.getElementById("log")!;
const show = (s: string) => { out.textContent = s + "\n" + out.textContent; };
document.getElementById("label")!.textContent = LABEL;

const container = document.getElementById("container")!;
const display = document.getElementById("display")!;
const gate = createTouchGestureGate();
let lastButtons = "";
bindPointerInput(display, "touchscreen", (s) => {
  const b = (s.left ? "L" : "") + (s.middle ? "M" : "") + (s.right ? "R" : "");
  log.push({ t: performance.now(), kind: "mouse", x: Math.round(s.x), y: Math.round(s.y), left: s.left, right: s.right, middle: s.middle });
  if (b !== lastButtons) show(`mouse ${b ? "DOWN " + b : "up"} @${Math.round(s.x)},${Math.round(s.y)}`);
  else if (b) show(`mouse DRAG ${b} @${Math.round(s.x)},${Math.round(s.y)}`);
  lastButtons = b;
}, gate);

let claimed = false;
let lastMid: { x: number; y: number } | null = null;
const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
container.addEventListener("touchstart", (e) => {
  if (e.touches.length >= 2) { e.preventDefault(); e.stopPropagation(); claimed = true; lastMid = mid(e.touches); gate.beginMultiTouch(); show("gesture claimed"); return; }
  if (claimed) { e.preventDefault(); e.stopPropagation(); }
}, { capture: true, passive: false });
container.addEventListener("touchmove", (e) => {
  if (e.touches.length < 2) { if (claimed) { e.preventDefault(); e.stopPropagation(); } return; }
  e.preventDefault(); e.stopPropagation();
  if (!claimed) { claimed = true; gate.beginMultiTouch(); }
  const m = mid(e.touches);
  if (lastMid) { container.scrollLeft -= m.x - lastMid.x; container.scrollTop -= m.y - lastMid.y; }
  lastMid = m;
}, { capture: true, passive: false });
const onEnd = (e: TouchEvent) => {
  if (!claimed) return;
  if (e.touches.length > 0) { e.preventDefault(); e.stopPropagation(); lastMid = e.touches.length >= 2 ? mid(e.touches) : null; return; }
  e.preventDefault(); claimed = false; lastMid = null; gate.allTouchesEnded(); show("gesture ended");
};
container.addEventListener("touchend", onEnd, { capture: true, passive: false });
container.addEventListener("touchcancel", onEnd, { capture: true, passive: false });

const ta = document.getElementById("kbd") as HTMLTextAreaElement;
const keys = createPressedKeyTracker((pressed, keysym) => {
  log.push({ t: performance.now(), kind: "key", pressed, keysym });
  show(`key ${pressed ? "down" : "up"} 0x${keysym.toString(16)}`);
});
ta.addEventListener("keydown", (e) => { const k = specialKeysymFromKeyboardEvent(e); if (k == null) return; e.preventDefault(); keys.press(k); });
ta.addEventListener("keyup", (e) => { const k = specialKeysymFromKeyboardEvent(e); if (k == null) return; e.preventDefault(); keys.release(k); });

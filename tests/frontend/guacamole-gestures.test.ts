import { describe, expect, it } from "vitest";
import {
  TWO_FINGER_GESTURE_THRESHOLD_PX,
  beginTwoFingerGesture,
  classifyTwoFingerGesture,
  displayOffsetInContainer,
  measureTwoFingerTouches,
  scrollForTwoFingerGesture,
  touchDistance,
  touchMidpoint,
  updateTwoFingerGesture,
} from "../../src/frontend/guacamole-gestures.js";

type GestureStart = Parameters<typeof beginTwoFingerGesture>[0];

const start = (overrides: Partial<GestureStart> = {}) =>
  beginTwoFingerGesture({
    distance: 100,
    midpoint: { x: 100, y: 100 },
    zoom: 1,
    scrollLeft: 200,
    scrollTop: 200,
    ...overrides,
  });

describe("guacamole two-finger gestures", () => {
  it("measures distance and midpoint", () => {
    expect(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(touchMidpoint({ x: 10, y: 20 }, { x: 30, y: 60 })).toEqual({
      x: 20,
      y: 40,
    });
  });

  it("measures touches in container-viewport coordinates", () => {
    const measured = measureTwoFingerTouches(
      { clientX: 110, clientY: 220 },
      { clientX: 140, clientY: 260 },
      { left: 100, top: 200 },
    );
    expect(measured.distance).toBe(50);
    expect(measured.midpoint).toEqual({ x: 25, y: 40 });
  });

  it("keeps small jitter undecided", () => {
    const origin = { distance: 100, midpoint: { x: 50, y: 50 } };
    expect(TWO_FINGER_GESTURE_THRESHOLD_PX).toBe(8);
    expect(
      classifyTwoFingerGesture("undecided", origin, {
        distance: 104,
        midpoint: { x: 53, y: 52 },
      }),
    ).toBe("undecided");
  });

  it("classifies a moving center with a stable spread as a pan", () => {
    const origin = { distance: 100, midpoint: { x: 50, y: 50 } };
    expect(
      classifyTwoFingerGesture("undecided", origin, {
        distance: 103,
        midpoint: { x: 70, y: 55 },
      }),
    ).toBe("pan");
  });

  it("classifies a spread change of at least the threshold as a pinch", () => {
    const origin = { distance: 100, midpoint: { x: 50, y: 50 } };
    expect(
      classifyTwoFingerGesture("undecided", origin, {
        distance: 108,
        midpoint: { x: 50, y: 50 },
      }),
    ).toBe("pinch");
    expect(
      classifyTwoFingerGesture("undecided", origin, {
        distance: 92,
        midpoint: { x: 50, y: 50 },
      }),
    ).toBe("pinch");
  });

  it("pans without zooming and lets content follow the fingers", () => {
    const update = updateTwoFingerGesture(
      start({ midpoint: { x: 50, y: 50 }, scrollLeft: 100, scrollTop: 100 }),
      { distance: 100, midpoint: { x: 70, y: 50 } },
    );
    expect(update.state.mode).toBe("pan");
    expect(update.zoom).toBeNull();
    expect(update.scrollLeft).toBe(80);
    expect(update.scrollTop).toBe(100);
  });

  it("zooms by the spread ratio, clamped to the zoom bounds", () => {
    expect(
      updateTwoFingerGesture(start({ zoom: 1.5 }), {
        distance: 150,
        midpoint: { x: 100, y: 100 },
      }).zoom,
    ).toBe(2.25);
    expect(
      updateTwoFingerGesture(start({ zoom: 2 }), {
        distance: 400,
        midpoint: { x: 100, y: 100 },
      }).zoom,
    ).toBe(4);
    expect(
      updateTwoFingerGesture(start({ zoom: 1 }), {
        distance: 20,
        midpoint: { x: 100, y: 100 },
      }).zoom,
    ).toBe(0.5);
  });

  it("zooms around a fixed gesture center", () => {
    const update = updateTwoFingerGesture(start(), {
      distance: 200,
      midpoint: { x: 100, y: 100 },
    });
    expect(update.state.mode).toBe("pinch");
    expect(update.zoom).toBe(2);
    // Content at 200 + 100 = 300 doubles to 600 and stays under x = 100.
    expect(update.scrollLeft).toBe(500);
    expect(update.scrollTop).toBe(500);
  });

  it("pans during a pinch by following the moving center", () => {
    const update = updateTwoFingerGesture(start(), {
      distance: 200,
      midpoint: { x: 130, y: 90 },
    });
    expect(update.zoom).toBe(2);
    expect(update.scrollLeft).toBe(300 * 2 - 130);
    expect(update.scrollTop).toBe(300 * 2 - 90);
  });

  it("scales scroll by the clamped zoom, not the raw spread", () => {
    const update = updateTwoFingerGesture(start({ zoom: 2 }), {
      distance: 400,
      midpoint: { x: 100, y: 100 },
    });
    expect(update.zoom).toBe(4);
    expect(update.scrollLeft).toBe(300 * 2 - 100);
  });

  it("upgrades a pan to a pinch but never downgrades a pinch", () => {
    const panned = updateTwoFingerGesture(start(), {
      distance: 100,
      midpoint: { x: 130, y: 100 },
    });
    expect(panned.state.mode).toBe("pan");

    const pinched = updateTwoFingerGesture(panned.state, {
      distance: 120,
      midpoint: { x: 130, y: 100 },
    });
    expect(pinched.state.mode).toBe("pinch");
    expect(pinched.zoom).toBe(1.2);

    const still = updateTwoFingerGesture(pinched.state, {
      distance: 100,
      midpoint: { x: 160, y: 100 },
    });
    expect(still.state.mode).toBe("pinch");
    expect(still.zoom).toBe(1);
    expect(still.scrollLeft).toBe(300 - 160);
  });

  it("keeps a pan once decided even if the center drifts back", () => {
    const panned = updateTwoFingerGesture(start(), {
      distance: 100,
      midpoint: { x: 130, y: 100 },
    });
    const back = updateTwoFingerGesture(panned.state, {
      distance: 100,
      midpoint: { x: 102, y: 100 },
    });
    expect(back.state.mode).toBe("pan");
    expect(back.scrollLeft).toBe(198);
  });

  it("does not produce NaN or Infinity from a zero start distance or zoom", () => {
    const fromZeroDistance = updateTwoFingerGesture(start({ distance: 0 }), {
      distance: 50,
      midpoint: { x: 110, y: 100 },
    });
    expect(fromZeroDistance.state.mode).toBe("pinch");
    expect(fromZeroDistance.zoom).toBe(1);
    expect(fromZeroDistance.scrollLeft).toBe(190);
    expect(Number.isFinite(fromZeroDistance.scrollTop)).toBe(true);

    const fromZeroZoom = updateTwoFingerGesture(start({ zoom: 0 }), {
      distance: 200,
      midpoint: { x: 100, y: 100 },
    });
    expect(fromZeroZoom.zoom).toBe(0.5);
    expect(Number.isFinite(fromZeroZoom.scrollLeft)).toBe(true);
    expect(Number.isFinite(fromZeroZoom.scrollTop)).toBe(true);
  });

  it("measures the display offset in scroll-content coordinates", () => {
    // A 1000x600 display centered vertically in a 1000x1000 container.
    expect(
      displayOffsetInContainer({
        containerRect: { left: 10, top: 20 },
        displayRect: { left: 10, top: 220 },
        scrollLeft: 0,
        scrollTop: 0,
      }),
    ).toEqual({ x: 0, y: 200 });
    // A scrolled display that starts at the scroll origin.
    expect(
      displayOffsetInContainer({
        containerRect: { left: 10, top: 20 },
        displayRect: { left: -90, top: -280 },
        scrollLeft: 100,
        scrollTop: 300,
      }),
    ).toEqual({ x: 0, y: 0 });
  });

  it("defaults the start offset to the scroll origin", () => {
    expect(start().startOffset).toEqual({ x: 0, y: 0 });
    expect(start({ offset: { x: 30, y: 40 } }).startOffset).toEqual({
      x: 30,
      y: 40,
    });
  });

  it("zooms around the fingers when a centered display becomes scrollable", () => {
    // 1000x600 display centered in a 1000x1000 container, pinched 1 -> 2
    // around a stationary center at y = 500. Content y = 300 doubles to 600
    // and the zoomed display starts at the scroll origin.
    const gesture = start({
      distance: 100,
      midpoint: { x: 500, y: 500 },
      scrollLeft: 0,
      scrollTop: 0,
      offset: { x: 0, y: 200 },
    });
    const current = { distance: 200, midpoint: { x: 500, y: 500 } };
    const update = updateTwoFingerGesture(gesture, current);
    expect(update.zoom).toBe(2);
    expect(
      scrollForTwoFingerGesture(gesture, current, update.zoom, { x: 0, y: 0 }),
    ).toEqual({ scrollLeft: 500, scrollTop: 100 });
  });

  it("handles a horizontally centered display the same way", () => {
    const gesture = start({
      distance: 100,
      midpoint: { x: 500, y: 500 },
      scrollLeft: 0,
      scrollTop: 0,
      offset: { x: 200, y: 0 },
    });
    const current = { distance: 200, midpoint: { x: 500, y: 500 } };
    const update = updateTwoFingerGesture(gesture, current, { x: 0, y: 0 });
    expect(update.zoom).toBe(2);
    expect(update.scrollLeft).toBe(100);
    expect(update.scrollTop).toBe(500);
  });

  it("keeps a still-centered axis centered while zooming", () => {
    // Zooming 1 -> 1.2 leaves a 600-tall display (now 720) centered in a
    // 1000-tall container: offset 200 -> 140, so no vertical scroll is needed.
    const gesture = start({
      distance: 100,
      midpoint: { x: 500, y: 500 },
      scrollLeft: 0,
      scrollTop: 0,
      offset: { x: 0, y: 200 },
    });
    const current = { distance: 120, midpoint: { x: 500, y: 500 } };
    const update = updateTwoFingerGesture(gesture, current);
    expect(update.zoom).toBe(1.2);
    const scroll = scrollForTwoFingerGesture(gesture, current, update.zoom, {
      x: 0,
      y: 140,
    });
    expect(scroll.scrollTop).toBeCloseTo(0);
  });

  it("cancels an unchanged offset so a pan still follows the fingers", () => {
    // Horizontally centered, vertically scrollable display.
    const offset = { x: 150, y: 0 };
    const update = updateTwoFingerGesture(
      start({
        midpoint: { x: 500, y: 300 },
        scrollLeft: 0,
        scrollTop: 100,
        offset,
      }),
      { distance: 100, midpoint: { x: 500, y: 280 } },
      offset,
    );
    expect(update.state.mode).toBe("pan");
    expect(update.zoom).toBeNull();
    expect(update.scrollLeft).toBe(0);
    expect(update.scrollTop).toBe(120);
  });
});

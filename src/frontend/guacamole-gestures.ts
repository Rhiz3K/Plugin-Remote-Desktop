import { clampGuacamoleZoom } from "./guacamole-zoom.ts";

// How far the finger spread or the gesture center must move from the start
// before a two-finger gesture counts as a pinch or a pan.
export const TWO_FINGER_GESTURE_THRESHOLD_PX = 8;

export interface GesturePoint {
  x: number;
  y: number;
}

export type TwoFingerGestureMode = "undecided" | "pan" | "pinch";

export interface TwoFingerMeasurement {
  distance: number;
  // In container-viewport coordinates (client position minus the container's
  // bounding rect), so it lines up with scrollLeft/scrollTop.
  midpoint: GesturePoint;
}

export interface TwoFingerGestureStart extends TwoFingerMeasurement {
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
  // The display's top-left in the container's scroll-content coordinates (see
  // displayOffsetInContainer). Non-zero while a display smaller than the
  // container is centered in it. Defaults to the scroll origin.
  offset?: GesturePoint;
}

export interface TwoFingerGestureState {
  mode: TwoFingerGestureMode;
  startDistance: number;
  startMidpoint: GesturePoint;
  startZoom: number;
  startScrollLeft: number;
  startScrollTop: number;
  startOffset: GesturePoint;
}

export interface TwoFingerScroll {
  scrollLeft: number;
  scrollTop: number;
}

export interface TwoFingerGestureUpdate extends TwoFingerScroll {
  state: TwoFingerGestureState;
  // The zoom to apply, or null when the gesture is not a pinch.
  zoom: number | null;
}

interface ClientPoint {
  clientX: number;
  clientY: number;
}

interface ViewportOrigin {
  left: number;
  top: number;
}

export interface DisplayOffsetInput {
  containerRect: ViewportOrigin;
  displayRect: ViewportOrigin;
  scrollLeft: number;
  scrollTop: number;
}

const ORIGIN: GesturePoint = { x: 0, y: 0 };

// The display's top-left in the scroll container's content coordinates, i.e.
// the same space as scrollLeft/scrollTop plus a container-viewport point.
export function displayOffsetInContainer({
  containerRect,
  displayRect,
  scrollLeft,
  scrollTop,
}: DisplayOffsetInput): GesturePoint {
  return {
    x: displayRect.left - containerRect.left + scrollLeft,
    y: displayRect.top - containerRect.top + scrollTop,
  };
}

export function touchDistance(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function touchMidpoint(a: GesturePoint, b: GesturePoint): GesturePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function clientToViewportPoint(
  point: ClientPoint,
  origin: ViewportOrigin,
): GesturePoint {
  return { x: point.clientX - origin.left, y: point.clientY - origin.top };
}

export function measureTwoFingerTouches(
  first: ClientPoint,
  second: ClientPoint,
  origin: ViewportOrigin,
): TwoFingerMeasurement {
  const a = clientToViewportPoint(first, origin);
  const b = clientToViewportPoint(second, origin);
  return { distance: touchDistance(a, b), midpoint: touchMidpoint(a, b) };
}

export function classifyTwoFingerGesture(
  previous: TwoFingerGestureMode,
  start: TwoFingerMeasurement,
  current: TwoFingerMeasurement,
): TwoFingerGestureMode {
  if (previous === "pinch") return "pinch";
  if (
    Math.abs(current.distance - start.distance) >=
    TWO_FINGER_GESTURE_THRESHOLD_PX
  ) {
    return "pinch";
  }
  if (previous === "pan") return "pan";
  const moved = Math.hypot(
    current.midpoint.x - start.midpoint.x,
    current.midpoint.y - start.midpoint.y,
  );
  return moved >= TWO_FINGER_GESTURE_THRESHOLD_PX ? "pan" : "undecided";
}

export function beginTwoFingerGesture(
  start: TwoFingerGestureStart,
): TwoFingerGestureState {
  return {
    mode: "undecided",
    startDistance: start.distance,
    startMidpoint: { x: start.midpoint.x, y: start.midpoint.y },
    startZoom: start.zoom,
    startScrollLeft: start.scrollLeft,
    startScrollTop: start.scrollTop,
    startOffset: { x: start.offset?.x ?? 0, y: start.offset?.y ?? 0 },
  };
}

// The scroll position that keeps the content that was under the starting
// gesture center under the current center: pans with the fingers and zooms
// around them. `zoom` is the value returned by updateTwoFingerGesture (null
// for no zoom change). `currentOffset` must be measured after that zoom has
// been applied, because resizing can change whether the display is centered.
export function scrollForTwoFingerGesture(
  state: TwoFingerGestureState,
  current: TwoFingerMeasurement,
  zoom: number | null,
  currentOffset: GesturePoint = ORIGIN,
): TwoFingerScroll {
  const ratio =
    zoom !== null && state.startZoom > 0 ? zoom / state.startZoom : 1;
  // Content point under the starting center, relative to the display origin.
  const contentX =
    state.startScrollLeft + state.startMidpoint.x - state.startOffset.x;
  const contentY =
    state.startScrollTop + state.startMidpoint.y - state.startOffset.y;
  return {
    scrollLeft: contentX * ratio + currentOffset.x - current.midpoint.x,
    scrollTop: contentY * ratio + currentOffset.y - current.midpoint.y,
  };
}

// Classifies the gesture and computes the zoom. The returned scroll uses
// `currentOffset` as given; when applying a zoom changes the display layout,
// call scrollForTwoFingerGesture again with the post-zoom offset.
export function updateTwoFingerGesture(
  state: TwoFingerGestureState,
  current: TwoFingerMeasurement,
  currentOffset: GesturePoint = ORIGIN,
): TwoFingerGestureUpdate {
  const mode = classifyTwoFingerGesture(
    state.mode,
    { distance: state.startDistance, midpoint: state.startMidpoint },
    current,
  );

  let zoom: number | null = null;
  if (mode === "pinch") {
    const scale =
      state.startDistance > 0 ? current.distance / state.startDistance : 1;
    zoom = clampGuacamoleZoom(state.startZoom * scale);
  }

  return {
    state: mode === state.mode ? state : { ...state, mode },
    zoom,
    ...scrollForTwoFingerGesture(state, current, zoom, currentOffset),
  };
}

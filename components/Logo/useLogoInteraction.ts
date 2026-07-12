import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseLogoInteractionParams {
  containerRef: RefObject<HTMLDivElement | null>;
  hue: number;
  onHueChange: (hue: number) => void;
}

export interface UseLogoInteractionResult {
  isActive: boolean;
  /** 用户是否进行过改色操作（首次改色后永久为 true） */
  hasPicked: boolean;
  /** Picker 中心在 Logo 容器内的 left（px） */
  pickerLeft: number;
  /** Picker 中心在 Logo 容器内的 top（px） */
  pickerTop: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVATION_RADIUS = 120;
const TAP_RADIUS = 120; // mobile tap-to-activate range
const DEBOUNCE_MS = 200;

/** ColorWheel 中心在 Logo 容器内的坐标 */
const WHEEL_CX = 60 + 55;
const WHEEL_CY = 80 + 55;
const WHEEL_RADIUS = 55;

// Apple detection
const isAppleTL = (function () {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Mac/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent))
  );
})();

// Throttle getBoundingClientRect: Apple devices refresh every 3 mousemove events
const RECT_INTERVAL = isAppleTL ? 3 : 1;

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function calcPickerPos(hue: number): { left: number; top: number } {
  const rad = (hue * Math.PI) / 180;
  return {
    left: WHEEL_CX + WHEEL_RADIUS * Math.sin(rad),
    top: WHEEL_CY - WHEEL_RADIUS * Math.cos(rad),
  };
}

function calcHueFromPoint(
  mx: number, my: number,
  wheelPageCx: number, wheelPageCy: number
): number {
  const dx = mx - wheelPageCx;
  const dy = my - wheelPageCy;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  return Math.round(deg % 360);
}

// ---------------------------------------------------------------------------
// Hook — event-driven (no RAF!)
// ---------------------------------------------------------------------------

export function useLogoInteraction({
  containerRef,
  hue,
  onHueChange,
}: UseLogoInteractionParams): UseLogoInteractionResult {
  const [isActive, setIsActive] = useState(false);
  const [hasPicked, setHasPicked] = useState(false);

  // ---- Refs ----
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hueRef = useRef(hue);
  const onHueChangeRef = useRef(onHueChange);
  const stateRef = useRef({
    isActive: false,
    pendingActive: null as boolean | null,
  });
  const moveCountRef = useRef(0);
  const cachedRectRef = useRef<DOMRect | null>(null);

  useEffect(() => { hueRef.current = hue; }, [hue]);
  useEffect(() => { onHueChangeRef.current = onHueChange; }, [onHueChange]);
  useEffect(() => { stateRef.current.isActive = isActive; }, [isActive]);

  // ---- Event-driven: mousemove handler replaces RAF ----
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;

      // Throttle getBoundingClientRect
      moveCountRef.current++;
      if (moveCountRef.current % RECT_INTERVAL === 0 || !cachedRectRef.current) {
        cachedRectRef.current = el.getBoundingClientRect();
      }
      const rect = cachedRectRef.current!;
      const logoCx = rect.left + rect.width / 2;
      const logoCy = rect.top + rect.height / 2;

      // ---- Distance detection ----
      const dxLogo = e.clientX - logoCx;
      const dyLogo = e.clientY - logoCy;
      const distance = Math.sqrt(dxLogo * dxLogo + dyLogo * dyLogo);
      const shouldBeActive = distance < ACTIVATION_RADIUS;
      const current = stateRef.current;

      // 200ms debounce for activation state changes
      if (current.pendingActive !== shouldBeActive) {
        current.pendingActive = shouldBeActive;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        if (shouldBeActive !== current.isActive) {
          timerRef.current = setTimeout(() => {
            stateRef.current.isActive = shouldBeActive;
            stateRef.current.pendingActive = null;
            timerRef.current = null;
            setIsActive(shouldBeActive);
          }, DEBOUNCE_MS);
        } else {
          current.pendingActive = null;
        }
      }

      // ---- Active: mouse hover → hue tracking ----
      if (current.isActive) {
        const wheelPageCx = rect.left + WHEEL_CX;
        const wheelPageCy = rect.top + WHEEL_CY;
        const newHue = calcHueFromPoint(e.clientX, e.clientY, wheelPageCx, wheelPageCy);

        // Dead zone 2°: filter micro-tremors
        let diff = newHue - hueRef.current;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        if (Math.abs(diff) > 2) {
          const adjusted = hueRef.current + diff;
          onHueChangeRef.current(adjusted);
          setHasPicked(true);
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      stateRef.current.pendingActive = null;
    };
  }, [containerRef]);

  // ════════════════════════════════════════════════════════════
  //  MOBILE: touch-hold near center → activate, drag → pick
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    var trackingId: number | null = null;
    var activeDragMove: ((e: TouchEvent) => void) | null = null;
    var activeDragEnd: ((e: TouchEvent) => void) | null = null;

    function cleanup() {
      if (activeDragMove) { document.removeEventListener("touchmove", activeDragMove); activeDragMove = null; }
      if (activeDragEnd)   { document.removeEventListener("touchend", activeDragEnd); activeDragEnd = null; }
      document.removeEventListener("touchcancel", handleCancel);
      trackingId = null;
      stateRef.current.isActive = false;
      setIsActive(false);
      (window as any).__logoInteracting = false;
    }

    function getRect(el: HTMLElement): DOMRect {
      if (!cachedRectRef.current) cachedRectRef.current = el.getBoundingClientRect();
      return cachedRectRef.current;
    }

    function isInRange(clientX: number, clientY: number, rect: DOMRect): boolean {
      var logoCx = rect.left + rect.width / 2;
      var logoCy = rect.top + rect.height / 2;
      var dx = clientX - logoCx;
      var dy = clientY - logoCy;
      return Math.sqrt(dx * dx + dy * dy) < ACTIVATION_RADIUS;
    }

    function trackFromTouch(touch: Touch, rect: DOMRect) {
      var wheelPageCx = rect.left + WHEEL_CX;
      var wheelPageCy = rect.top + WHEEL_CY;
      var newHue = calcHueFromPoint(touch.clientX, touch.clientY, wheelPageCx, wheelPageCy);
      var diff = newHue - hueRef.current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      if (Math.abs(diff) > 2) {
        hueRef.current = hueRef.current + diff;
        onHueChangeRef.current(hueRef.current);
        setHasPicked(true);
      }
    }

    function handleCancel(e: TouchEvent) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === trackingId) { cleanup(); return; }
      }
    }

    function stopTracking() {
      if (activeDragMove) { document.removeEventListener("touchmove", activeDragMove); activeDragMove = null; }
      if (activeDragEnd)   { document.removeEventListener("touchend", activeDragEnd); activeDragEnd = null; }
      document.removeEventListener("touchcancel", handleCancel);
      trackingId = null;
      (window as any).__logoInteracting = false;
    }

    var handleTouchStart = function(e: TouchEvent) {
      var el = containerRef.current;
      if (!el) return;
      // Ignore if already tracking a different finger, or if it's a second touch
      if (trackingId !== null && e.touches.length > 1) return;

      var touch = e.changedTouches[0];
      if (!touch) return;
      var rect = getRect(el);
      var inRange = isInRange(touch.clientX, touch.clientY, rect);

      if (!inRange) {
        // Tap outside → deactivate picker
        stateRef.current.isActive = false;
        setIsActive(false);
        return;
      }

      // Toggle: if already active and user taps again, deactivate
      if (stateRef.current.isActive && trackingId === null) {
        stateRef.current.isActive = false;
        setIsActive(false);
        return;
      }

      // Activate picker
      trackingId = touch.identifier;
      stateRef.current.isActive = true;
      setIsActive(true);
      (window as any).__logoInteracting = true;
      trackFromTouch(touch, rect);

      // Attach drag handlers
      activeDragMove = function(e2: TouchEvent) {
        var t: Touch | null = null;
        for (var i = 0; i < e2.changedTouches.length; i++) {
          if (e2.changedTouches[i].identifier === trackingId) { t = e2.changedTouches[i]; break; }
        }
        if (!t) return;
        e2.preventDefault();
        var r = getRect(el!);
        trackFromTouch(t, r);
      };
      activeDragEnd = function(e2: TouchEvent) {
        for (var i = 0; i < e2.changedTouches.length; i++) {
          if (e2.changedTouches[i].identifier === trackingId) { stopTracking(); return; }
        }
      };
      document.addEventListener("touchmove", activeDragMove, { passive: false });
      document.addEventListener("touchend", activeDragEnd, { passive: true });
      document.addEventListener("touchcancel", handleCancel, { passive: true });
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      cleanup();
    };
  }, [containerRef]);

  // ---- Picker 位置 ----
  const pos = calcPickerPos(hue);

  return {
    isActive,
    hasPicked,
    pickerLeft: pos.left,
    pickerTop: pos.top,
  };
}

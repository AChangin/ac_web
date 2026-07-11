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
  hasPicked: boolean;
  pickerLeft: number;
  pickerTop: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVATION_RADIUS = 180;
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

// Touch device detection (mobile only — iOS + Android)
const isTouchDevice = (function () {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
})();

// Throttle getBoundingClientRect on Apple
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
// Hook — mouse-driven (desktop) + touch-driven (mobile)
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
  const touchIdRef = useRef<number | null>(null);
  const touchJustEndedRef = useRef(0); // suppress synthetic mouse events after touch

  useEffect(() => { hueRef.current = hue; }, [hue]);
  useEffect(() => { onHueChangeRef.current = onHueChange; }, [onHueChange]);
  useEffect(() => { stateRef.current.isActive = isActive; }, [isActive]);

  // ---- Shared: process pointer position for hue tracking ----
  function trackHue(clientX: number, clientY: number, rect: DOMRect) {
    const wheelPageCx = rect.left + WHEEL_CX;
    const wheelPageCy = rect.top + WHEEL_CY;
    const newHue = calcHueFromPoint(clientX, clientY, wheelPageCx, wheelPageCy);

    let diff = newHue - hueRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (Math.abs(diff) > 2) {
      const adjusted = hueRef.current + diff;
      onHueChangeRef.current(adjusted);
      setHasPicked(true);
    }
  }

  // ---- Shared: get (possibly cached) container rect ----
  function getRect(el: HTMLElement): DOMRect {
    moveCountRef.current++;
    if (moveCountRef.current % RECT_INTERVAL === 0 || !cachedRectRef.current) {
      cachedRectRef.current = el.getBoundingClientRect();
    }
    return cachedRectRef.current!;
  }

  // ---- Shared: check if pointer is within activation radius ----
  function isInRange(clientX: number, clientY: number, rect: DOMRect): boolean {
    const logoCx = rect.left + rect.width / 2;
    const logoCy = rect.top + rect.height / 2;
    const dxLogo = clientX - logoCx;
    const dyLogo = clientY - logoCy;
    return Math.sqrt(dxLogo * dxLogo + dyLogo * dyLogo) < ACTIVATION_RADIUS;
  }

  // ════════════════════════════════════════════════════════════
  //  DESKTOP: mousemove → proximity activation (200ms debounce)
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Suppress synthetic mouse events after touch (iOS fires these ~300ms later)
      if (isTouchDevice && performance.now() - touchJustEndedRef.current < 500) return;

      const el = containerRef.current;
      if (!el) return;

      const rect = getRect(el);
      const shouldBeActive = isInRange(e.clientX, e.clientY, rect);
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

      // Active: mouse hover → real-time hue tracking
      if (current.isActive) {
        trackHue(e.clientX, e.clientY, rect);
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
  //  MOBILE: touch-hold → activate, drag → change, release → done
  //  (touchmove/touchend only active during drag — don't block scroll)
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isTouchDevice) return;

    var activeTouchMove: ((e: TouchEvent) => void) | null = null;
    var activeTouchEnd: ((e: TouchEvent) => void) | null = null;

    function cleanupDrag() {
      if (activeTouchMove) { document.removeEventListener("touchmove", activeTouchMove); activeTouchMove = null; }
      if (activeTouchEnd)   { document.removeEventListener("touchend", activeTouchEnd);   activeTouchEnd = null; }
      document.removeEventListener("touchcancel", handleTouchCancel);
      touchIdRef.current = null;
      stateRef.current.isActive = false;
      setIsActive(false);
      touchJustEndedRef.current = performance.now();
    }

    function handleTouchCancel(e: TouchEvent) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) { cleanupDrag(); return; }
      }
    }

    var handleTouchStart = function(e: TouchEvent) {
      var el = containerRef.current;
      if (!el) return;

      var touch = e.changedTouches[0];
      if (!touch) return;

      var rect = getRect(el);
      if (!isInRange(touch.clientX, touch.clientY, rect)) return;

      // Immediately activate — touch is intentional
      touchIdRef.current = touch.identifier;
      stateRef.current.isActive = true;
      setIsActive(true);
      trackHue(touch.clientX, touch.clientY, rect);

      // ── Attach drag listeners (only while tracking) ──
      activeTouchMove = function(e2: TouchEvent) {
        var t: Touch | null = null;
        for (var i = 0; i < e2.changedTouches.length; i++) {
          if (e2.changedTouches[i].identifier === touchIdRef.current) { t = e2.changedTouches[i]; break; }
        }
        if (!t) return;
        e2.preventDefault(); // block scroll only during active color dragging
        var r = getRect(el!);
        trackHue(t.clientX, t.clientY, r);
      };
      activeTouchEnd = function(e2: TouchEvent) {
        for (var i = 0; i < e2.changedTouches.length; i++) {
          if (e2.changedTouches[i].identifier === touchIdRef.current) { cleanupDrag(); return; }
        }
      };
      document.addEventListener("touchmove", activeTouchMove, { passive: false });
      document.addEventListener("touchend", activeTouchEnd, { passive: true });
      document.addEventListener("touchcancel", handleTouchCancel, { passive: true });
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      cleanupDrag();
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

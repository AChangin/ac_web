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
  useEffect(() => {
    stateRef.current.isActive = isActive;
    (window as any).__logoInteracting = isActive;
  }, [isActive]);

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

  // ---- Picker 位置 ----
  const pos = calcPickerPos(hue);

  return {
    isActive,
    hasPicked,
    pickerLeft: pos.left,
    pickerTop: pos.top,
  };
}

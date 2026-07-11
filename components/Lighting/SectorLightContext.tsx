import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useHue } from "../../hooks/useHueSystem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LightState {
  originX: number;
  originY: number;
  angle: number;
  span: number;
  maxDistance: number;
  hue: number;
  hasPicked: boolean;
}

type IntensityCallback = (intensity: number) => void;

interface RegisteredElement {
  el: HTMLElement;
  callback: IntensityCallback;
}

/** Callback for SectorLight to receive per-frame updates without React renders */
type LightConeUpdater = (data: {
  opacity: number;
  rotate: number;
  offsetX: number;
  offsetY: number;
  ambientOpacity: number;
  hue: number;
}) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPAN = 45;
const MAX_DISTANCE = 1600;
const FADE_DISTANCE_VW = 80;
const PARALLAX_FACTOR = 0.95;

// Apple detection (runs once at module load)
const isAppleTL = (function () {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Mac/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent))
  );
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcScrollVisibility(): number {
  const el = document.getElementById("scroll-container");
  if (!el) return 0;
  const vw = window.innerWidth / 100;
  const scrollX = el.getBoundingClientRect().left;
  const section1Center = scrollX + 150 * vw;
  const vpCenter = window.innerWidth / 2;
  const dist = Math.abs(section1Center - vpCenter) / vw;
  return Math.max(0, Math.min(1, 1 - dist / FADE_DISTANCE_VW));
}

function getLogoCenter(): { x: number; y: number } {
  const el = document.getElementById("logo-mount");
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function gaussianWeight(value: number, sigma: number): number {
  return Math.exp(-(value * value) / (2 * sigma * sigma));
}

function plateauWeight(
  normalized: number,
  plateau: number,
  sigma: number
): number {
  if (normalized <= plateau) return 1;
  return gaussianWeight((normalized - plateau) / (1 - plateau), sigma);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SectorLightContextValue {
  register: (el: HTMLElement, cb: IntensityCallback) => () => void;
  registerLightCone: (updater: LightConeUpdater) => () => void;
  getState: () => LightState;
}

const Ctx = createContext<SectorLightContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider — owns the SINGLE shared RAF loop
// ---------------------------------------------------------------------------

export function SectorLightProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hue, hasPicked } = useHue();
  const registryRef = useRef<RegisteredElement[]>([]);
  const coneUpdatersRef = useRef<LightConeUpdater[]>([]);
  const stateRef = useRef<LightState>({
    originX: window.innerWidth / 2,
    originY: window.innerHeight / 2,
    angle: hue,
    span: SPAN,
    maxDistance: MAX_DISTANCE,
    hue,
    hasPicked: false,
  });
  const rafRef = useRef(0);

  // Keep refs in sync without restarting the RAF
  const hueRef = useRef(hue);
  const hasPickedRef = useRef(hasPicked);
  useEffect(() => { hueRef.current = hue; }, [hue]);
  useEffect(() => { hasPickedRef.current = hasPicked; }, [hasPicked]);

  // ---- Single shared RAF loop (created ONCE, never restarted) ----
  useEffect(() => {
    const tick = () => {
      const currentHue = hueRef.current;
      const currentHasPicked = hasPickedRef.current;

      // ── Read DOM ONCE ──
      const logo = getLogoCenter();
      const scrollVis = calcScrollVisibility();
      const globalVis = currentHasPicked ? scrollVis : 0;

      const s = stateRef.current;
      s.originX = logo.x;
      s.originY = logo.y;
      s.angle = currentHue;
      s.hue = currentHue;
      s.hasPicked = currentHasPicked;

      const vpCx = window.innerWidth / 2;
      const vpCy = window.innerHeight / 2;
      const offsetX = (logo.x - vpCx) * PARALLAX_FACTOR;
      const offsetY = (logo.y - vpCy) * PARALLAX_FACTOR;
      const ambientOpacity = globalVis * 0.25;

      // ── Update SectorLight cone elements directly (no React render) ──
      for (const updater of coneUpdatersRef.current) {
        updater({
          opacity: globalVis,
          rotate: currentHue - SPAN,
          offsetX,
          offsetY,
          ambientOpacity: isAppleTL ? 0 : ambientOpacity,
          hue: currentHue,
        });
      }

      // ── Update LightReceivers ──
      if (globalVis < 0.001) {
        for (const entry of registryRef.current) {
          entry.callback(0);
        }
      } else {
        for (const entry of registryRef.current) {
          const rect = entry.el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;

          const dx = cx - s.originX;
          const dy = cy - s.originY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const distWeight =
            dist < s.maxDistance
              ? plateauWeight(dist / s.maxDistance, 0.4, 0.5)
              : 0;

          const elemAngle =
            ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
          let angleDiff = Math.abs(elemAngle - s.angle);
          if (angleDiff > 180) angleDiff = 360 - angleDiff;

          const angleWeight =
            angleDiff < s.span * 1.6
              ? plateauWeight(angleDiff / s.span, 0.4, 0.5)
              : 0;

          entry.callback(distWeight * angleWeight * globalVis);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // NEVER restart — reads latest values from refs

  // ---- Register / unregister LightReceivers ----
  const register = useCallback(
    (el: HTMLElement, cb: IntensityCallback): (() => void) => {
      const entry: RegisteredElement = { el, callback: cb };
      registryRef.current.push(entry);
      return () => {
        registryRef.current = registryRef.current.filter((e) => e !== entry);
      };
    },
    []
  );

  // ---- Register / unregister SectorLight cone updaters ----
  const registerLightCone = useCallback(
    (updater: LightConeUpdater): (() => void) => {
      coneUpdatersRef.current.push(updater);
      return () => {
        coneUpdatersRef.current = coneUpdatersRef.current.filter(
          (u) => u !== updater
        );
      };
    },
    []
  );

  const getState = useCallback(() => stateRef.current, []);

  return React.createElement(
    Ctx.Provider,
    { value: { register, registerLightCone, getState } },
    children
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSectorLight() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useSectorLight must be inside SectorLightProvider");
  return ctx;
}

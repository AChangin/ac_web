import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useHue } from "../../hooks/useHueSystem";
import { useSectorLight } from "./SectorLightContext";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPAN = 45;
const SATURATION = 55;
const LIGHTNESS = 25;

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

function buildSectorGradient(targetHue: number): string {
  // Many stops with smooth alpha ramp → soft edges without CSS blur
  const STEPS = 20;
  const stops: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS; // 0..1 across the sector span
    const angle = -SPAN + t * SPAN * 2;
    const colorHue = ((targetHue + angle) % 360 + 360) % 360;
    // Bell-shaped alpha: peak at center, smooth falloff to edges
    const distFromCenter = Math.abs(t - 0.5) * 2; // 0=center, 1=edge
    const alpha = 0.75 * Math.exp(-distFromCenter * distFromCenter * 3.5) + 0.05;
    stops.push(
      `hsla(${colorHue}, ${SATURATION}%, ${LIGHTNESS}%, ${alpha.toFixed(3)}) ${t * SPAN * 2}deg`
    );
  }
  return `conic-gradient(from ${-SPAN}deg, transparent 0deg, ${stops.join(", ")}, transparent ${SPAN * 2}deg)`;
}

// ---------------------------------------------------------------------------
// Component (no per-frame React renders — uses shared RAF via context)
// ---------------------------------------------------------------------------

export function SectorLight() {
  const { hue, hasPicked } = useHue();
  const { registerLightCone } = useSectorLight();

  // Refs for direct DOM writes (no React state at 60fps)
  const ambientRef = useRef<HTMLDivElement>(null);
  const coneWrapperRef = useRef<HTMLDivElement>(null);
  const coneRef = useRef<HTMLDivElement>(null);
  const blackBgRef = useRef<HTMLDivElement>(null);
  const animRotateRef = useRef(hue - SPAN);

  // Keep latest hue in ref (avoids re-registering the RAF callback on every change)
  const hueRef = useRef(hue);
  useEffect(() => { hueRef.current = hue; }, [hue]);

  // Register with the shared RAF loop — registered ONCE
  useEffect(() => {
    var prevHue = -1;
    var prevAmbient = -1;
    var prevOpacity = -1;
    var prevRotateStr = "";
    var prevWrapperTransform = "";
    var frameSkip = 0;
    // Throttle DOM writes on Apple: only every Nth frame for rotation
    var ROTATE_INTERVAL = isAppleTL ? 2 : 1;

    const unreg = registerLightCone(
      ({ opacity, rotate, offsetX, offsetY, ambientOpacity }) => {
        const currentHue = hueRef.current;
        const wrapperTransform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;

        // ── Ambient glow (skipped on Apple) ──
        if (ambientRef.current) {
          const ambOp = isAppleTL ? 0 : ambientOpacity;
          if (ambOp !== prevAmbient) {
            prevAmbient = ambOp;
            ambientRef.current.style.opacity = String(ambOp);
          }
          if (wrapperTransform !== prevWrapperTransform) {
            ambientRef.current.style.transform = wrapperTransform;
          }
          if (currentHue !== prevHue) {
            ambientRef.current.style.background = `radial-gradient(circle, hsla(${currentHue}, ${SATURATION}%, 5%, 0.6) 0%, transparent 70%)`;
          }
        }

        // ── Light cone ──
        if (coneRef.current) {
          // Only write opacity when it changed
          if (opacity !== prevOpacity) {
            prevOpacity = opacity;
            coneRef.current.style.opacity = String(opacity);
          }

          // Throttle rotation DOM writes (lerp runs every frame, write less often)
          const target = rotate;
          let diff = target - animRotateRef.current;
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;
          animRotateRef.current += diff * 0.25;

          frameSkip++;
          if (frameSkip >= ROTATE_INTERVAL) {
            frameSkip = 0;
            const rotateStr = `rotate(${animRotateRef.current.toFixed(1)}deg)`;
            if (rotateStr !== prevRotateStr) {
              prevRotateStr = rotateStr;
              coneRef.current.style.transform = rotateStr;
            }
          }

          if (currentHue !== prevHue) {
            coneRef.current.style.background = buildSectorGradient(currentHue);
          }
        }

        // ── Wrapper translate ──
        if (coneWrapperRef.current && wrapperTransform !== prevWrapperTransform) {
          prevWrapperTransform = wrapperTransform;
          coneWrapperRef.current.style.transform = wrapperTransform;
        }

        prevHue = currentHue;
      }
    );
    return () => unreg();
  }, []);

  const ambientBlur = isAppleTL ? "10px" : "40px";

  const content = (
    <>
      {/* ── 纯黑底 ── */}
      <div
        ref={blackBgRef}
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ══════ Layer 2: Ambient Glow (hidden on Apple devices) ══════ */}
      <motion.div
        ref={ambientRef}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          width: "200vw",
          height: "200vw",
          borderRadius: "50%",
          filter: `blur(${ambientBlur})`,
          pointerEvents: "none",
          zIndex: 1,
          opacity: 0,
        }}
      />

      {/* ══════ Layer 1: Light Cone ══════ */}
      <div
        ref={coneWrapperRef}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          pointerEvents: "none",
          zIndex: 1,
          transform: "translateZ(0)",  // GPU layer promotion
        }}
      >
        <div
          ref={coneRef}
          style={{
            width: "200vmax",
            height: "200vmax",
            borderRadius: "50%",
            opacity: 0,
            transform: "translateZ(0)",  // GPU layer
          }}
        />
      </div>
    </>
  );

  return createPortal(content, document.body);
}

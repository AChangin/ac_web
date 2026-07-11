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
  const steps = 14;
  const stops: string[] = ["transparent 0deg"];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const localAngle = -SPAN + t * SPAN * 2;
    const colorHue = ((targetHue + localAngle) % 360 + 360) % 360;
    const alpha =
      i === 0 || i === steps
        ? 0.2
        : i <= 2 || i >= steps - 2
          ? 0.55
          : 0.8;
    stops.push(
      `hsla(${colorHue}, ${SATURATION}%, ${LIGHTNESS}%, ${alpha}) ${t * SPAN * 2}deg`
    );
  }
  stops.push(`transparent ${SPAN * 2}deg`);
  return `conic-gradient(${stops.join(", ")})`;
}

// ---------------------------------------------------------------------------
// Component (no per-frame React renders — uses shared RAF via context)
// ---------------------------------------------------------------------------

export function SectorLight() {
  const { hue, hasPicked } = useHue();
  const { registerLightCone } = useSectorLight();

  // Refs for direct DOM writes (no React state at 60fps)
  const ambientRef = useRef<HTMLDivElement>(null);
  const coneWrapperRef = useRef<HTMLDivElement>(null);  // outer: translate (parallax)
  const coneRef = useRef<HTMLDivElement>(null);          // inner: rotate + gradient
  const blackBgRef = useRef<HTMLDivElement>(null);
  const animRotateRef = useRef(hue - SPAN);

  // Keep animRotateRef in sync (shortest rotation path)
  useEffect(() => {
    const target = hue - SPAN;
    let diff = target - animRotateRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    animRotateRef.current += diff;
  }, [hue]);

  // Register with the shared RAF loop
  useEffect(() => {
    var prevHue = hue;
    var prevAmbient = -1; // force first write

    const unreg = registerLightCone(
      ({ opacity, rotate, offsetX, offsetY, ambientOpacity }) => {
        // Write directly to DOM elements — zero React overhead
        const transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;

        // Black background always visible — avoids jarring white→black flash

        // Ambient glow (skipped on Apple)
        if (ambientRef.current) {
          const ambOp = isAppleTL ? 0 : ambientOpacity;
          if (ambOp !== prevAmbient) {
            prevAmbient = ambOp;
            ambientRef.current.style.opacity = String(ambOp);
          }
          ambientRef.current.style.transform = transform;
          // Only regenerate radial-gradient when hue changes
          if (hue !== prevHue) {
            ambientRef.current.style.background = `radial-gradient(circle, hsla(${hue}, ${SATURATION}%, 5%, 0.6) 0%, transparent 70%)`;
          }
        }

        // Light cone
        if (coneRef.current) {
          coneRef.current.style.opacity = String(opacity);
          // Smoothly interpolate rotation toward target
          const target = rotate;
          let diff = target - animRotateRef.current;
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;
          animRotateRef.current += diff * 0.25; // lerp, no GSAP needed
          coneRef.current.style.transform = `rotate(${animRotateRef.current}deg)`;
          // Only regenerate conic-gradient when hue changes (heavy on Safari)
          if (hue !== prevHue) {
            coneRef.current.style.background = buildSectorGradient(hue);
          }
        }
        // Outer wrapper: translate for parallax positioning
        if (coneWrapperRef.current) {
          coneWrapperRef.current.style.transform = transform;
        }

        prevHue = hue;
      }
    );
    return () => unreg();
  }, [hue, registerLightCone]);

  const coneBlur = isAppleTL ? "2px" : "6px";
  const ambientBlur = isAppleTL ? "20px" : "40px";

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
        }}
      >
        <div
          ref={coneRef}
          style={{
            width: "300vmax",
            height: "300vmax",
            borderRadius: "50%",
            filter: `blur(${coneBlur})`,
            opacity: 0,
          }}
        />
      </div>
    </>
  );

  return createPortal(content, document.body);
}

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useHue } from "../../hooks/useHueSystem";
import { useSectorLight } from "./SectorLightContext";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROTATION_OFFSET = 15; // ← 改这里！顺时针偏移度数（正值=顺时针）
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

const SPAN = isAppleTL ? 65 : 45; // 扇形半角（°），Apple 端更大

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Original sharp gradient (Windows/Chrome) — paired with CSS blur(6px) */
function buildSectorGradientSharp(targetHue: number): string {
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

/** Soft gradient (Apple/Safari) — built-in alpha falloff, no CSS blur needed */
function buildSectorGradientSoft(targetHue: number): string {
  const STEPS = 20;
  const stops: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const angle = -SPAN + t * SPAN * 2;
    const colorHue = ((targetHue + angle) % 360 + 360) % 360;
    const distFromCenter = Math.abs(t - 0.5) * 2;
    const alpha = 0.75 * Math.exp(-distFromCenter * distFromCenter * 3.5) + 0.05;
    stops.push(
      `hsla(${colorHue}, ${SATURATION}%, ${LIGHTNESS}%, ${alpha.toFixed(3)}) ${t * SPAN * 2}deg`
    );
  }
  return `conic-gradient(transparent 0deg, ${stops.join(", ")}, transparent ${SPAN * 2}deg)`;
}

// Canvas-based cone for Apple: renders at 384×384, GPU upscales (~70x fewer pixels)
var CANVAS_SIZE = 768;
// Draw sector centered at targetHue; CSS rotation NOT applied on Apple
function drawConeCanvas(ctx: CanvasRenderingContext2D, targetHue: number) {
  var cx = CANVAS_SIZE / 2, cy = CANVAS_SIZE / 2, r = CANVAS_SIZE / 2;
  var spanRad = SPAN * Math.PI / 180;
  var centerAngle = targetHue * Math.PI / 180;
  var startAngle = centerAngle - spanRad;
  var endAngle = centerAngle + spanRad;

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Subtle offscreen blur softens wedge edges before GPU upscale
  ctx.filter = "blur(0.8px)";

  var wedges = 64;
  for (var i = 0; i < wedges; i++) {
    var t = i / (wedges - 1);
    var a = startAngle + (endAngle - startAngle) * t;
    var aNext = startAngle + (endAngle - startAngle) * (t + 1 / (wedges - 1));
    var localHue = ((targetHue + (t - 0.5) * SPAN * 2) % 360 + 360) % 360;
    var distFromCenter = Math.abs(t - 0.5) * 2;
    var alpha = 0.75 * Math.exp(-distFromCenter * distFromCenter * 3.5) + 0.05;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a - Math.PI / 2, aNext - Math.PI / 2, false);
    ctx.closePath();
    ctx.fillStyle = "hsla(" + localHue + ", " + SATURATION + "%, " + LIGHTNESS + "%, " + alpha.toFixed(3) + ")";
    ctx.fill();
  }
  ctx.filter = "none";
}

// Pick gradient + cone style based on platform
var buildSectorGradient = isAppleTL ? buildSectorGradientSoft : buildSectorGradientSharp;
var CONE_SIZE = isAppleTL ? "180vmax" : "300vmax";
var CONE_FILTER = isAppleTL ? "none" : "blur(6px)";
var USE_CANVAS = isAppleTL;

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
  const coneCanvasRef = useRef<HTMLCanvasElement>(null);  // Apple: low-res canvas
  const blackBgRef = useRef<HTMLDivElement>(null);
  const animRotateRef = useRef(hue - SPAN + ROTATION_OFFSET);
  const displayHueRef = useRef(hue); // lerped hue for canvas (Apple)
  // Offscreen canvas for Apple cone rendering
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  // Keep latest hue in ref (avoids re-registering the RAF callback on every change)
  const hueRef = useRef(hue);
  useEffect(() => { hueRef.current = hue; }, [hue]);

  // Init offscreen canvas for Apple cone rendering
  useEffect(() => {
    if (!USE_CANVAS) return;
    var c = document.createElement("canvas");
    c.width = CANVAS_SIZE;
    c.height = CANVAS_SIZE;
    offscreenRef.current = c;
    // Draw initial frame
    drawConeCanvas(c.getContext("2d")!, hue);
    if (coneCanvasRef.current) {
      var vc = coneCanvasRef.current.getContext("2d")!;
      vc.drawImage(c, 0, 0);
    }
  }, []);

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

          // CSS rotation: only on non-canvas (canvas draws at correct angle)
          if (!USE_CANVAS) {
            const target = rotate + ROTATION_OFFSET;
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
          }

          if (currentHue !== prevHue || USE_CANVAS) {
            if (USE_CANVAS && offscreenRef.current && coneCanvasRef.current) {
              // Lerp display hue toward target (includes oscillation) for smooth transition
              var dh = displayHueRef.current;
              var diffH = currentHue - dh;
              if (diffH > 180) diffH -= 360;
              if (diffH < -180) diffH += 360;
              displayHueRef.current = dh + diffH * 0.25;
              drawConeCanvas(offscreenRef.current.getContext("2d")!, displayHueRef.current);
              // Copy offscreen → visible canvas
              var vc = coneCanvasRef.current.getContext("2d")!;
              vc.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
              vc.drawImage(offscreenRef.current, 0, 0);
            } else if (!USE_CANVAS && currentHue !== prevHue) {
              coneRef.current.style.background = buildSectorGradient(currentHue);
            }
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
        }}
      >
        <div
          ref={coneRef}
          style={{
            width: CONE_SIZE,
            height: CONE_SIZE,
            borderRadius: "50%",
            filter: CONE_FILTER,
            opacity: 0,
            overflow: "hidden",
            willChange: "opacity",
          }}
        >
          {USE_CANVAS && (
            <canvas
              ref={coneCanvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                imageRendering: "auto",
              }}
            />
          )}
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}

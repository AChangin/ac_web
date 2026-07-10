import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useHue } from "../../hooks/useHueSystem";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPAN = 45;
const SATURATION = 55;
const LIGHTNESS = 25;
const AMBIENT_LIGHTNESS = 5;
const AMBIENT_OPACITY = 0.25;
const PARALLAX_FACTOR = 0.95;
const FADE_DISTANCE_VW = 80;

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

function buildSectorGradient(targetHue: number): string {
  const steps = 14;
  const stops: string[] = ["transparent 0deg"];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const localAngle = -SPAN + t * SPAN * 2;
    const colorHue = ((targetHue + localAngle) % 360 + 360) % 360;
    const alpha = i === 0 || i === steps ? 0.2 : i <= 2 || i >= steps - 2 ? 0.55 : 0.8;
    stops.push(`hsla(${colorHue}, ${SATURATION}%, ${LIGHTNESS}%, ${alpha}) ${t * SPAN * 2}deg`);
  }
  stops.push(`transparent ${SPAN * 2}deg`);
  return `conic-gradient(${stops.join(", ")})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SectorLight（三层照明）
 *
 * Layer 1 — Light Cone：主体光束，定义照明区域
 * Layer 2 — Ambient Glow：同色环境光，极弱，让页面不死黑
 * Layer 3 — Contact Light：由 LightReceiver 在元素上实现
 */
export function SectorLight() {
  const { hue, hasPicked } = useHue();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scrollVis, setScrollVis] = useState(0);
  const [animRotate, setAnimRotate] = useState(hue - SPAN);

  // hue 变化时，计算最短旋转路径（跨越 0/360 不走长路）
  useEffect(() => {
    setAnimRotate((prev) => {
      const target = hue - SPAN;
      let diff = target - prev;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return prev + diff;
    });
  }, [hue]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = getLogoCenter();
      const vpCx = window.innerWidth / 2;
      const vpCy = window.innerHeight / 2;
      setOffset({
        x: (c.x - vpCx) * PARALLAX_FACTOR,
        y: (c.y - vpCy) * PARALLAX_FACTOR,
      });
      setScrollVis(calcScrollVisibility());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const opacity = hasPicked ? scrollVis : 0;
  const transform = `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`;

  const content = (
    <>
      {/* ── 纯黑底 ── */}
      <div
        style={{
          position: "fixed", inset: 0, background: "#000",
          pointerEvents: "none", zIndex: 0,
        }}
      />

      {/* ══════ Layer 2: Ambient Glow ══════ */}
      <motion.div
        animate={{ opacity: opacity * AMBIENT_OPACITY }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform,
          width: "200vw", height: "200vw", borderRadius: "50%",
          background: `radial-gradient(circle, hsla(${hue}, ${SATURATION}%, ${AMBIENT_LIGHTNESS}%, 0.6) 0%, transparent 70%)`,
          filter: "blur(40px)",
          pointerEvents: "none", zIndex: 1,
        }}
      />

      {/* ══════ Layer 1: Light Cone（z-1，低于 section z-2） ══════ */}
      <div
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform, pointerEvents: "none", zIndex: 1,
        }}
      >
        <motion.div
          animate={{ opacity, rotate: animRotate }}
          transition={{
            opacity: { duration: 0.4, ease: "easeOut" },
            rotate: { duration: 0.5, ease: [0.33, 1, 0.68, 1] },
          }}
          style={{
            width: "300vmax", height: "300vmax", borderRadius: "50%",
            background: buildSectorGradient(hue),
            filter: "blur(6px)",
          }}
        />
      </div>
    </>
  );

  return createPortal(content, document.body);
}

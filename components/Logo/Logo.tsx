import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import type { LogoProps } from "./types";
import { useLogoInteraction } from "./useLogoInteraction";
import { ColorWheel } from "./ColorWheel";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTAINER_SIZE = 180;
const DOT_SIZE = 24;

/** 动画配置 power3.out */
const TRANSITION = {
  duration: 0.45,
  ease: [0.2, 1, 0.3, 1] as const,
};

/** 当前选中色 */
function hueColor(h: number) {
  return `hsl(${h}, 100%, 50%)`;
}

// ---------------------------------------------------------------------------
// Inline SVG paths
// ---------------------------------------------------------------------------

const A_PATH =
  "M205.297,2094.97l302.889,-859.724c164.66,84.375 347.278,128.573 532.854,128.573c185.617,-0 368.274,-44.217 532.962,-128.629l33.65,95.511c-195.93,41.175 -358.245,174.131 -439.813,351.738c-42.111,3.591 -84.415,5.396 -126.799,5.396c-105.461,0 -210.43,-11.177 -313.169,-33.226l-155.143,440.361l-367.431,0Zm364.684,-1035.12l340.928,-967.695c19.97,-56.683 73.296,-92.155 130.195,-92.15c56.899,-0.005 110.225,35.467 130.195,92.15l340.908,967.637c-144.432,78.725 -306.416,120.068 -471.167,120.068c-164.71,0 -326.654,-41.322 -471.059,-120.01Z";

const A_TIP_PATH =
  "M569.981,1059.85l340.928,-967.695c19.97,-56.683 73.296,-92.155 130.195,-92.15c56.899,-0.005 110.225,35.467 130.195,92.15l340.908,967.637c-144.432,78.725 -306.416,120.068 -471.167,120.068c-164.71,0 -326.654,-41.322 -471.059,-120.01Z";

const C_PATH =
  "M1736.78,1404.81c297.062,-0 538.239,241.177 538.239,538.239c-0,297.062 -241.177,538.239 -538.239,538.239c-297.062,-0 -538.239,-241.177 -538.239,-538.239c-0,-297.062 241.177,-538.239 538.239,-538.239Zm149.833,660.836c-35.522,43.35 -89.47,71.031 -149.833,71.031c-106.867,0 -193.628,-86.762 -193.628,-193.628c-0,-106.867 86.761,-193.628 193.628,-193.628c60.363,-0 114.311,27.681 149.814,71.046c11.554,14.135 31.651,17.812 47.462,8.684c1.684,-0.972 3.386,-1.954 5.075,-2.957c9.43,-5.445 16.004,-14.746 17.988,-25.452c1.985,-10.707 -0.818,-21.746 -7.67,-30.209c-50.234,-61.833 -126.871,-101.37 -212.669,-101.37c-151.162,0 -273.886,122.724 -273.886,273.886c0,151.161 122.724,273.885 273.886,273.885c85.798,0 162.435,-39.537 212.688,-101.354c6.857,-8.469 9.661,-19.515 7.675,-30.228c-1.986,-10.714 -8.564,-20.021 -18,-25.469c-1.701,-0.982 -3.403,-1.964 -5.1,-2.915c-15.8,-9.122 -35.883,-5.448 -47.43,8.678Z";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Logo({ hue, onHueChange }: LogoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isActive, hasPicked, pickerLeft, pickerTop } = useLogoInteraction({
    containerRef,
    hue,
    onHueChange,
  });

  const activeColor = hasPicked ? hueColor(hue) : "#fff";

  // Phase 2 bridge：进入 Color Mode 时触发全局 hasPicked
  useEffect(() => {
    if (isActive) onHueChange(hue);
  }, [isActive, hue, onHueChange]);

  return (
    <div
      ref={containerRef}
      className="logo-root"
      style={{
        position: "relative",
        width: CONTAINER_SIZE,
        height: CONTAINER_SIZE,
        cursor: "default",
        filter: "drop-shadow(0 0 32px rgba(0,0,0,0.90)) drop-shadow(0 0 80px rgba(0,0,0,0.8))",
      }}
    >
      {/* ════ C：居中，淡出 + 缩小，色彩继承 hue ════ */}
      <motion.div
        className="logo-letter-c"
        animate={{
          opacity: isActive ? 0 : 1,
          scale: isActive ? 0.3 : 1,
        }}
        transition={TRANSITION}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          color: activeColor,
          transition: "color 0.3s ease",
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 2481 2481"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block" }}
        >
          <path d={C_PATH} />
        </svg>
      </motion.div>

      {/* ════ Dot：色盘边缘小圆点 ════ */}
      <motion.div
        className="picker-dot"
        animate={{
          opacity: isActive ? 1 : 0,
          scale: isActive ? 1 : 0,
          left: pickerLeft - DOT_SIZE / 2,
          top: pickerTop - DOT_SIZE / 2,
        }}
        transition={TRANSITION}
        style={{
          position: "absolute",
          width: DOT_SIZE,
          height: DOT_SIZE,
          zIndex: 10,
          borderRadius: "50%",
          background: hueColor(hue),
          border: "2.5px solid #fff",
          boxShadow: "0 1px 6px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.1)",
          pointerEvents: "none",
        }}
      />

      {/* ════ A：完整笔尖，白色光晕，层级在下，选色后 75% 不透明 ════ */}
      <motion.div
        className="logo-letter-a"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          color: "#fff",
          opacity: hasPicked ? 0.85 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        <svg
          width="80%"
          height="80%"
          viewBox="0 0 2481 2481"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block", filter: "drop-shadow(0 0 6px rgba(255,255,255,0.25))" }}
        >
          <path d={A_PATH} />
        </svg>
      </motion.div>

      {/* ════ A_TIP：笔尖尖端，色彩继承 hue，始终在 A 之上 ════ */}
      <motion.div
        className="logo-letter-a-tip"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          color: activeColor,
          transition: "color 0.3s ease",
        }}
      >
        <svg
          width="80%"
          height="80%"
          viewBox="0 0 2481 2481"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block" }}
        >
          <path d={A_TIP_PATH} />
        </svg>
      </motion.div>

      {/* ---- ColorWheel ---- */}
      <ColorWheel visible={isActive} />
    </div>
  );
}

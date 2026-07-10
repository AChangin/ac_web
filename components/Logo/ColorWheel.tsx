import React from "react";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ColorWheelProps {
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 色盘直径 */
const SIZE = 110;

/** 动画配置：power3.out ≈ 强 ease-out */
const TRANSITION = {
  duration: 0.45,
  ease: [0.2, 1, 0.3, 1] as const,
};

/**
 * 色盘外阴影（drop-shadow 不受容器边界裁切）
 * 在这里手动调：
 * - 第 1 个值: X 偏移
 * - 第 2 个值: Y 偏移
 * - 第 3 个值: 模糊半径
 * - 第 4 个值: 颜色（rgba 最后一位 = 不透明度）
 */
const WHEEL_SHADOW =
  "drop-shadow(0 0 28px rgba(0,0,0,0.65)) drop-shadow(0 0 60px rgba(0,0,0,0.35))";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 生成 HSL 色相环的 conic-gradient 字符串
 * 每 60° 一个关键色，形成完整色相环
 */
function buildConicGradient(): string {
  const stops = [
    "hsl(0, 100%, 50%)",    // 红
    "hsl(60, 100%, 50%)",   // 黄
    "hsl(120, 100%, 50%)",  // 绿
    "hsl(180, 100%, 50%)",  // 青
    "hsl(240, 100%, 50%)",  // 蓝
    "hsl(300, 100%, 50%)",  // 品红
    "hsl(360, 100%, 50%)",  // 红（闭合）
  ];
  return `conic-gradient(${stops.join(", ")})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ColorWheel
 *
 * SVG + conic-gradient 实现的圆形色盘。
 * - 110px，实心圆形，与 C 位置重叠
 * - 进入动画：scale 0→1 / opacity 0→1
 * - 退出动画反向
 */
export function ColorWheel({ visible }: ColorWheelProps) {
  return (
    <motion.div
      className="color-wheel-wrapper"
      aria-hidden={!visible}
      initial={false}
      animate={{
        scale: visible ? 1 : 0,
        opacity: visible ? 1 : 0,
      }}
      transition={TRANSITION}
      style={{
        position: "absolute",
        // 居中于 180px Logo 容器：(180 - 110) / 2 = 35px
        left: 60,
        top: 80,
        width: SIZE,
        height: SIZE,
        zIndex: 3,
        filter: WHEEL_SHADOW,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* ---- SVG 骨架 ---- */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        {/* foreignObject 嵌入 HTML conic-gradient 实心圆形色盘 */}
        <foreignObject x="0" y="0" width={SIZE} height={SIZE}>
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: buildConicGradient(),
            } as React.CSSProperties}
          />
        </foreignObject>
      </svg>
    </motion.div>
  );
}

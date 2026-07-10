import React from "react";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PickerProps {
  /** 当前色相 0–360 */
  hue: number;
  /** 是否正在拖拽 */
  isDragging: boolean;
  /** Picker 中心在 Logo 容器内的 left（px） */
  left: number;
  /** Picker 中心在 Logo 容器内的 top（px） */
  top: number;
  /** 是否可见 */
  visible: boolean;
  /** mousedown 处理器 */
  onMouseDown: (e: React.MouseEvent) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Picker 小圆点直径 */
const DOT_SIZE = 18;

/** 动画配置 */
const TRANSITION = {
  duration: 0.45,
  ease: [0.2, 1, 0.3, 1] as const,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Picker
 *
 * 小圆形拖拽手柄，贴在 ColorWheel 边缘。
 * - 白色圆点 + 阴影，在任何色相上都清晰可见
 * - visible 控制 opacity / scale 出入
 * - 位置由 hue 决定（父组件计算 left/top）
 */
export function Picker({ isDragging, left, top, visible, onMouseDown }: PickerProps) {
  return (
    <motion.div
      className="picker-handle"
      animate={{
        left: left - DOT_SIZE / 2,
        top: top - DOT_SIZE / 2,
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.5,
      }}
      transition={TRANSITION}
      style={{
        position: "absolute",
        width: DOT_SIZE,
        height: DOT_SIZE,
        zIndex: 10,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        pointerEvents: visible ? "auto" : "none",
      }}
      onMouseDown={visible ? onMouseDown : undefined}
    >
      {/* 白色圆点 + 细边框 + 阴影 */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "#fff",
          border: "2px solid rgba(0,0,0,0.25)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.8)",
        }}
      />
    </motion.div>
  );
}

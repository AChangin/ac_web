import React from "react";
import { useLightIntensity } from "./useLightIntensity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LightReceiverProps {
  children: React.ReactNode;
  /** 是否接受照明（false = 始终暗态） */
  active?: boolean;
  /** 额外 className */
  className?: string;
  /** 额外 style */
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LightReceiver
 *
 * 包裹任何元素，使其自动响应 SectorLight 照明。
 *
 * CSS Variables 输出：
 *   --li     光照强度 0–1
 *   --lb     亮度
 *   --lc     对比度
 *   --ls     饱和度
 *   --lblur  模糊
 *   --lglow  光晕半径
 *
 * 子元素在 CSS 中使用这些变量即可自动响应光照：
 *
 *   filter: brightness(var(--lb)) contrast(var(--lc))
 *           saturate(var(--ls)) blur(var(--lblur))
 *           drop-shadow(0 0 var(--lglow) hsl(var(--hue), 60%, 50%));
 */
export function LightReceiver({
  children,
  active = true,
  className,
  style,
}: LightReceiverProps) {
  const ref = useLightIntensity(active);

  return React.createElement(
    "div",
    {
      ref,
      className,
      style: {
        opacity: "var(--lo, 0)",
        // CSS Variables 驱动 filter → 零重渲染、GPU 加速
        filter:
          "brightness(var(--lb, 0.15)) " +
          "contrast(var(--lc, 0.8)) " +
          "saturate(var(--ls, 0.4)) " +
          "blur(var(--lblur, 4px)) " +
          "drop-shadow(0 0 var(--lglow, 0px) hsla(var(--hue, 0), 60%, 45%, calc(var(--li, 0) * 0.3)))",
        transition: "none",
        ...style,
      } as React.CSSProperties,
    },
    children
  );
}

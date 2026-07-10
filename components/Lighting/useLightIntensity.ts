import { useEffect, useRef } from "react";
import { useSectorLight } from "./SectorLightContext";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useLightIntensity
 *
 * 注册一个 DOM 元素到全局光照系统。
 * 每帧自动计算该元素的光照强度 (0–1) 并写入 CSS Variables：
 *
 *   --li     光照强度 0–1（主变量）
 *   --lb     亮度映射   0.35 → 1.2
 *   --lc     对比度映射 0.9 → 1.05
 *   --ls     饱和度映射 0.6 → 1
 *   --lblur  模糊映射   2px → 0
 *   --lglow  drop-shadow 映射
 *
 * @param active 是否需要照明（false 则强度始终为 0）
 */
export function useLightIntensity(active: boolean = true) {
  const ref = useRef<HTMLDivElement>(null);
  const { register } = useSectorLight();
  const prevRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    // 默认暗态：完全不可见
    el.style.setProperty("--li", "0");
    el.style.setProperty("--lo", "0");
    el.style.setProperty("--lb", "0.15");
    el.style.setProperty("--lc", "0.8");
    el.style.setProperty("--ls", "0.4");
    el.style.setProperty("--lblur", "4px");
    el.style.setProperty("--lglow", "0px");

    const unregister = register(el, (intensity: number) => {
      const smooth = prevRef.current + (intensity - prevRef.current) * 0.15;
      prevRef.current = smooth;

      const i = smooth;

      el.style.setProperty("--li", i.toFixed(3));
      el.style.setProperty("--lo", i.toFixed(3));                       // opacity 0 → 1
      el.style.setProperty("--lb", (0.15 + i * 1.1).toFixed(3));
      el.style.setProperty("--lc", (0.8 + i * 0.25).toFixed(3));
      el.style.setProperty("--ls", (0.4 + i * 0.6).toFixed(3));
      el.style.setProperty("--lblur", ((1 - i) * 4).toFixed(2) + "px");
      el.style.setProperty("--lglow", (i * 10).toFixed(1) + "px");
    });

    return () => {
      unregister();
      prevRef.current *= 0.92;
    };
  }, [active, register]);

  return ref;
}

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

    // Cache last-written values — skip redundant setProperty (Safari style invalidation)
    var last: Record<string, string> = {
      li: "0", lo: "0", lb: "0.15", lc: "0.8", ls: "0.4", lblur: "4px", lglow: "0px",
    };

    const unregister = register(el, (intensity: number) => {
      const smooth = prevRef.current + (intensity - prevRef.current) * 0.15;
      prevRef.current = smooth;
      const i = smooth;

      var v: string;
      v = i.toFixed(3);         if (v !== last.li)    { last.li = v;    el.style.setProperty("--li", v); }
      v = i.toFixed(3);         if (v !== last.lo)    { last.lo = v;    el.style.setProperty("--lo", v); }
      v = (0.15 + i * 1.1).toFixed(3); if (v !== last.lb) { last.lb = v; el.style.setProperty("--lb", v); }
      v = (0.8 + i * 0.25).toFixed(3); if (v !== last.lc) { last.lc = v; el.style.setProperty("--lc", v); }
      v = (0.4 + i * 0.6).toFixed(3);  if (v !== last.ls) { last.ls = v; el.style.setProperty("--ls", v); }
      var blurVal = (1 - i) * 4;
      v = blurVal < 0.06 ? "0px" : blurVal.toFixed(2) + "px"; if (v !== last.lblur) { last.lblur = v; el.style.setProperty("--lblur", v); }
      v = (i * 10).toFixed(1) + "px";      if (v !== last.lglow) { last.lglow = v; el.style.setProperty("--lglow", v); }
    });

    return () => {
      unregister();
      prevRef.current *= 0.92;
    };
  }, [active, register]);

  return ref;
}

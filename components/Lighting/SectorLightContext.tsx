import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  useState,
} from "react";
import { useHue } from "../../hooks/useHueSystem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LightState {
  /** 光源在 viewport 中的 X */
  originX: number;
  /** 光源在 viewport 中的 Y */
  originY: number;
  /** 光束角度（= hue，0 = 顶部，顺时针） */
  angle: number;
  /** 光束半角跨度（°） */
  span: number;
  /** 光束最大照射距离（px） */
  maxDistance: number;
  /** 当前 hue */
  hue: number;
  /** 是否已选色 */
  hasPicked: boolean;
}

/** 每个注册元素的回调：接收 0-1 的强度值，直接写 DOM */
type IntensityCallback = (intensity: number) => void;

interface RegisteredElement {
  el: HTMLElement;
  callback: IntensityCallback;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPAN = 45;
const MAX_DISTANCE = 1600;
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

/** 高斯衰减 */
function gaussianWeight(value: number, sigma: number): number {
  return Math.exp(-(value * value) / (2 * sigma * sigma));
}

/** 平顶衰减：中心 plateau 比例内全亮，外缘高斯衰减 */
function plateauWeight(normalized: number, plateau: number, sigma: number): number {
  if (normalized <= plateau) return 1;
  return gaussianWeight((normalized - plateau) / (1 - plateau), sigma);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SectorLightContextValue {
  /** 注册元素到 RAF 循环，返回取消注册函数 */
  register: (el: HTMLElement, cb: IntensityCallback) => () => void;
  /** 当前光源状态（只读快照，不触发重渲染） */
  getState: () => LightState;
}

const Ctx = createContext<SectorLightContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SectorLightProvider({ children }: { children: React.ReactNode }) {
  const { hue, hasPicked } = useHue();
  const registryRef = useRef<RegisteredElement[]>([]);
  const stateRef = useRef<LightState>({
    originX: window.innerWidth / 2,
    originY: window.innerHeight / 2,
    angle: hue,
    span: SPAN,
    maxDistance: MAX_DISTANCE,
    hue,
    hasPicked: false,
  });
  const rafRef = useRef(0);

  // 全局 RAF 循环
  useEffect(() => {
    const tick = () => {
      const logo = getLogoCenter();
      const s = stateRef.current;
      s.originX = logo.x;
      s.originY = logo.y;
      s.angle = hue;
      s.hue = hue;
      s.hasPicked = hasPicked;

      // 计算滚动可见度（与 SectorLight 视觉同步）
      const scrollVis = calcScrollVisibility();
      const globalVis = hasPicked ? scrollVis : 0;

      // 遍历所有注册元素
      for (const entry of registryRef.current) {
        if (globalVis < 0.001) {
          entry.callback(0);
          continue;
        }

        const rect = entry.el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const dx = cx - s.originX;
        const dy = cy - s.originY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const distWeight =
          dist < s.maxDistance
            ? plateauWeight(dist / s.maxDistance, 0.4, 0.5)
            : 0;

        const elemAngle =
          ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
        let angleDiff = Math.abs(elemAngle - s.angle);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;

        const angleWeight =
          angleDiff < s.span * 1.6
            ? plateauWeight(angleDiff / s.span, 0.4, 0.5)
            : 0;

        entry.callback(distWeight * angleWeight * globalVis);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hue, hasPicked]);

  // 注册 / 注销
  const register = useCallback(
    (el: HTMLElement, cb: IntensityCallback): (() => void) => {
      const entry: RegisteredElement = { el, callback: cb };
      registryRef.current.push(entry);
      return () => {
        registryRef.current = registryRef.current.filter((e) => e !== entry);
      };
    },
    []
  );

  const getState = useCallback(() => stateRef.current, []);

  return React.createElement(
    Ctx.Provider,
    { value: { register, getState } },
    children
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSectorLight() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSectorLight must be inside SectorLightProvider");
  return ctx;
}

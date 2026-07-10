import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HueContextValue {
  hue: number;
  hasPicked: boolean;
  setHue: (h: number) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const HueContext = createContext<HueContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * HueProvider
 *
 * 全局 Hue + hasPicked 状态。
 * - setHue() 首次调用时自动标记 hasPicked = true
 * - CSS Variable --hue 自动同步 :root
 */
export function HueProvider({ children }: { children: React.ReactNode }) {
  const [hue, setHueRaw] = useState(60);
  const [hasPicked, setHasPicked] = useState(false);

  const setHue = useCallback((h: number) => {
    const clamped = ((h % 360) + 360) % 360;
    setHueRaw(clamped);
    setHasPicked(true);
  }, []);

  // 同步 CSS Variable 到 :root
  useEffect(() => {
    document.documentElement.style.setProperty("--hue", String(hue));
  }, [hue]);

  return React.createElement(
    HueContext.Provider,
    { value: { hue, hasPicked, setHue } },
    children
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHue(): HueContextValue {
  const ctx = useContext(HueContext);
  if (!ctx) {
    throw new Error("useHue must be used within <HueProvider>");
  }
  return ctx;
}

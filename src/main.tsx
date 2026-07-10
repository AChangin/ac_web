import React from "react";
import { createRoot } from "react-dom/client";
import Logo from "../components/Logo/Logo";
import { SectorLight } from "../components/Lighting/SectorLight";
import { SectorLightProvider } from "../components/Lighting/SectorLightContext";
import { LightReceiver } from "../components/Lighting/LightReceiver";
import { HueProvider, useHue } from "../hooks/useHueSystem";

function LogoBridge() {
  const { hue, setHue } = useHue();
  return React.createElement(Logo, { hue, onHueChange: setHue });
}

/** Demo：光束可照亮的大文段 */
function DemoContent() {
  const items = [
    {
      html: "The space between<br/>light and shadow<br/>defines everything.",
      top: "10%", left: "12%", maxWidth: "380px",
      size: "2rem", weight: 500, lineHeight: 1.5,
    },
    {
      html: "Form emerges not from<br/>what we add, but from<br/>what we choose to reveal.",
      bottom: "20%", right: "12%", maxWidth: "420px",
      size: "1.8rem", weight: 400, lineHeight: 1.6,
    },
    {
      html: "Every surface holds<br/>a story waiting for<br/>the right angle of light.",
      bottom: "16%", left: "14%", maxWidth: "360px",
      size: "1.6rem", weight: 400, lineHeight: 1.55,
    },
    {
      html: "Clarity is not<br/>about brightness.<br/>It is about direction.",
      top: "26%", right: "16%", maxWidth: "340px",
      size: "1.7rem", weight: 400, lineHeight: 1.5,
    },
  ];

  return React.createElement(
    "div",
    {
      style: {
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5,
        fontFamily: "'Playfair Display', Georgia, serif", color: "#fff",
      } as React.CSSProperties,
    },
    ...items.map((t, i) =>
      React.createElement(
        LightReceiver,
        {
          key: i,
          style: {
            position: "absolute",
            top: t.top, right: t.right, bottom: t.bottom, left: t.left,
            maxWidth: t.maxWidth,
          } as React.CSSProperties,
        },
        React.createElement("p", {
          style: {
            fontSize: t.size, fontWeight: t.weight,
            lineHeight: t.lineHeight, letterSpacing: "-0.01em",
            margin: 0,
          } as React.CSSProperties,
          dangerouslySetInnerHTML: { __html: t.html },
        })
      )
    )
  );
}

function App() {
  return React.createElement(
    HueProvider,
    null,
    React.createElement(
      SectorLightProvider,
      null,
      React.createElement(SectorLight),
      React.createElement(LogoBridge),
      React.createElement(DemoContent)
    )
  );
}

function mount() {
  const mountPoint = document.getElementById("logo-mount");
  if (!mountPoint) {
    console.warn("[Logo] Mount point #logo-mount not found");
    return;
  }
  const root = createRoot(mountPoint);
  root.render(React.createElement(App));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}

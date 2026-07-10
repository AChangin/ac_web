export interface LogoProps {
  hue: number;
  onHueChange: (hue: number) => void;
}

export interface LogoState {
  isActive: boolean;
  isDragging: boolean;
  hue: number; // 0–360
}

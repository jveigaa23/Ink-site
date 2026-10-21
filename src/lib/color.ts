/** Escolhe texto claro ou escuro sobre a cor de destaque, garantindo legibilidade. */
export function contrastTextFor(hex: string): "#ffffff" | "#0a0a0a" {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const contrastWhite = 1.05 / (lum + 0.05);
  const contrastBlack = (lum + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "#ffffff" : "#0a0a0a";
}

export const isHexColor = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

import type { Brand } from "@/data";

/** Lightness per step of the brand scale; 600 keeps the chosen colour itself. */
const STEPS: [number, number][] = [[25, 98], [50, 96], [100, 92], [200, 85], [300, 75], [400, 64], [500, 54], [700, 38], [800, 30], [900, 22], [950, 12]];

const toHsl = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16); const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (!d) return [0, 0, l * 100];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s * 100, l * 100];
};

/** Writes the brand onto <html>: colour scale, font and the Google Fonts link it needs. */
export const applyBrand = (b: Brand) => {
    const root = document.documentElement; const [h, s] = toHsl(b.color);
    root.style.setProperty("--color-brand-600", b.color);
    for (const [step, l] of STEPS) root.style.setProperty(`--color-brand-${step}`, `hsl(${h.toFixed(0)} ${Math.min(s, l > 90 ? 70 : 100).toFixed(0)}% ${l}%)`);
    root.style.setProperty("--font-body", `"${b.font}", ui-sans-serif, system-ui, sans-serif`);
    root.style.setProperty("--font-display", `"${b.font}", ui-sans-serif, system-ui, sans-serif`);
    const id = `font-${b.font.replace(/\s/g, "-")}`;
    if (!document.getElementById(id)) {
        const link = document.createElement("link"); link.id = id; link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(b.font)}:wght@400;500;600;700&display=swap`;
        document.head.appendChild(link);
    }
};

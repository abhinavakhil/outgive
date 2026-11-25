/**
 * The Outgive logo: an "OG" monogram beside the "outgive" wordmark.
 * The monogram's two colours swap between the letters, so the light colour flows like an S from the bottom of the O
 * over the top of the G. Thin cuts across the stroke mark each change of colour; they are masked, so they work on any background.
 * Tones: "light" sits on light pages (deep purple and the design system's brand purple #7B3FD6); "dark" sits on dark sections
 * (white and lilac); "auto" takes the surrounding text colour for its first half, for app screens with a dark mode.
 */
import { useId } from "react";

const TONES = { light: ["#4E22A0", "#7B3FD6"], dark: ["#ffffff", "#C6AEE8"], auto: ["currentColor", "#7B3FD6"] } as const;
export type LogoTone = keyof typeof TONES;
/** Drawn as 17-wide strokes on two 19.5-radius rings. */
const O_TOP = "M10.5 32 A19.5 19.5 0 0 1 43.79 18.21";
const O_BOT = "M43.79 18.21 A19.5 19.5 0 1 1 10.5 32";
const G_TOP = "M70.33 23.76 A19.5 19.5 0 0 1 102.49 18.95";
const G_BOT = "M70.33 23.76 A19.5 19.5 0 1 0 107.07 36.05 H91";
const CUTS = "M27.5 32 L-6.5 32 M31.77 30.23 L55.81 6.19 M85.73 30.94 L54.92 16.57";

/** The OG monogram alone. `size` is the height in pixels; it is twice as wide. */
export const Mark = ({ size = 22, tone = "light" }: { size?: number; tone?: LogoTone }) => {
    const id = useId(); const [a, b] = TONES[tone];
    return (
        <svg width={size * 2} height={size} viewBox="1 3 116 58" aria-hidden="true" className="shrink-0">
            <defs><mask id={id} maskUnits="userSpaceOnUse"><rect x="-10" width="140" height="64" fill="#fff" /><path d={CUTS} stroke="#000" strokeWidth="3.4" /></mask></defs>
            <g mask={`url(#${id})`} fill="none" strokeWidth="17">
                <path d={O_TOP} stroke={a} /><path d={O_BOT} stroke={b} />
                <path d={G_BOT} stroke={a} /><path d={G_TOP} stroke={b} />
            </g>
        </svg>
    );
};

/** Monogram and wordmark together. `size` is the wordmark's cap height in pixels, roughly. */
export const Logo = ({ size = 28, tone = "light" }: { size?: number; tone?: LogoTone }) => {
    const [a, b] = TONES[tone];
    return (
        <span className="inline-flex items-center gap-[0.32em] leading-none" style={{ fontSize: size }} aria-label="Outgive" role="img">
            <Mark size={Math.round(size * 0.82)} tone={tone} />
            <span aria-hidden="true" className="font-[Outfit,ui-sans-serif,sans-serif] text-[0.86em] font-extrabold tracking-[-0.035em]"><span style={{ color: a }}>out</span><span style={{ color: b }}>give</span></span>
        </span>
    );
};

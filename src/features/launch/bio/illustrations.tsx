/**
 * Cause illustrations: multicolour, hand-drawn style. Flat pastel shapes sit a few pixels off a wobbly ink outline,
 * like a hand-printed card. Drawn on a 120x100 box; decorative (aria-hidden), the card's title says what it is.
 */
import { type ReactNode, useId } from "react";

const K = "#222"; // ink
const C = { blue: "#8EC5FF", sky: "#CFE8FF", yellow: "#F7D44C", pink: "#F8A5E9", green: "#9BE07A", mint: "#CDEFD0", orange: "#FDA46B", peach: "#FFD2B3", purple: "#B9A8FF", red: "#FF7A6B", brown: "#C9875A", cream: "#FFF3D6" };
const ink = { fill: "none", stroke: K, strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
/** A pastel fill printed slightly off its outline. */
const Fill = ({ d, c, dx = 3, dy = 3 }: { d: string; c: string; dx?: number; dy?: number }) => <path d={d} fill={c} transform={`translate(${dx} ${dy})`} />;
const Line = ({ d, w }: { d: string; w?: number }) => <path d={d} {...ink} strokeWidth={w ?? ink.strokeWidth} />;
const Spark = ({ x, y, c = C.yellow }: { x: number; y: number; c?: string }) => <path d={`M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6}Z`} fill={c} stroke={K} strokeWidth="1.6" strokeLinejoin="round" />;

const ART: Record<string, ReactNode> = {
    water: <>
        <Fill d="M58 12C70 32 84 44 84 61a25 25 0 01-50 0c0-17 13-29 24-49z" c={C.blue} />
        <Line d="M58 12C70 32 84 44 84 61a25 25 0 01-50 0c0-17 13-29 24-49z" />
        <Line d="M46 62c1 9 6 14 13 15" w={2.2} />
        <path d="M10 92c7-6 13-6 20 0s13 6 20 0 13-6 20 0 13 6 20 0 13-6 20 0" fill="none" stroke="#5BA3F5" strokeWidth="2.6" strokeLinecap="round" />
        <Spark x={95} y={24} /><Spark x={22} y={30} c={C.pink} />
    </>,
    emergency: <>
        <Fill d="M24 36h72a6 6 0 016 6v38a6 6 0 01-6 6H24a6 6 0 01-6-6V42a6 6 0 016-6z" c={C.red} />
        <Line d="M24 36h72a6 6 0 016 6v38a6 6 0 01-6 6H24a6 6 0 01-6-6V42a6 6 0 016-6z" />
        <Line d="M46 36v-8a4 4 0 014-4h20a4 4 0 014 4v8" />
        <path d="M54 48h12v9h9v12h-9v9H54v-9h-9V57h9z" fill="#fff" stroke={K} strokeWidth="2.2" strokeLinejoin="round" />
        <Spark x={104} y={20} /><Line d="M10 22l6 4M14 14l2 7" w={2} />
    </>,
    shelter: <>
        <Fill d="M60 16L102 50H18z" c={C.orange} />
        <Fill d="M26 50h68v38H26z" c={C.cream} dx={2} dy={2} />
        <Line d="M60 16L102 50H18z" /><Line d="M26 50v38h68V50" />
        <path d="M52 88V68a8 8 0 0116 0v20" fill={C.green} stroke={K} strokeWidth="2.4" />
        <rect x="74" y="58" width="12" height="11" rx="2" fill={C.sky} stroke={K} strokeWidth="2.2" />
        <Line d="M10 88h100" w={2.2} />
        <circle cx="98" cy="20" r="7" fill={C.yellow} stroke={K} strokeWidth="2.2" />
    </>,
    food: <>
        <Fill d="M18 52h84a42 30 0 01-84 0z" c={C.orange} />
        <Line d="M18 52h84a42 30 0 01-84 0z" />
        <Line d="M14 52h92" />
        <path d="M34 50c2-8 8-10 12-6 3-6 10-6 13 0 4-5 11-3 12 3 5-2 10 1 11 4" fill={C.yellow} stroke={K} strokeWidth="2.2" strokeLinejoin="round" />
        <Line d="M44 32c-3-5 3-8 0-13M60 30c-3-5 3-8 0-13M76 32c-3-5 3-8 0-13" w={2.2} />
        <ellipse cx="98" cy="86" rx="7" ry="4.5" fill={C.brown} stroke={K} strokeWidth="2" transform="rotate(-20 98 86)" />
        <ellipse cx="22" cy="88" rx="7" ry="4.5" fill={C.brown} stroke={K} strokeWidth="2" transform="rotate(15 22 88)" />
    </>,
    orphans: <>
        <circle cx="42" cy="30" r="10" fill={C.peach} stroke={K} strokeWidth="2.4" />
        <circle cx="80" cy="36" r="8.5" fill={C.peach} stroke={K} strokeWidth="2.4" />
        <Fill d="M28 86V58c0-10 6-16 14-16s14 6 14 16v28z" c={C.purple} />
        <Fill d="M68 86V62c0-8 5-13 12-13s12 5 12 13v24z" c={C.green} />
        <Line d="M28 86V58c0-10 6-16 14-16s14 6 14 16v28" /><Line d="M68 86V62c0-8 5-13 12-13s12 5 12 13v24" />
        <Line d="M56 64c4 2 8 2 12 0" />
        <path d="M60 22c-3-4-9-1-6 4l6 6 6-6c3-5-3-8-6-4z" fill={C.pink} stroke={K} strokeWidth="2" strokeLinejoin="round" />
        <Line d="M14 90h92" w={2.2} />
    </>,
    education: <>
        <Fill d="M60 30C48 22 30 22 16 26v54c14-4 32-4 44 4 12-8 30-8 44-4V26c-14-4-32-4-44 4z" c={C.sky} />
        <Line d="M60 30C48 22 30 22 16 26v54c14-4 32-4 44 4 12-8 30-8 44-4V26c-14-4-32-4-44 4z" />
        <Line d="M60 30v54" />
        <Line d="M26 40c8-2 16-2 24 1M26 50c8-2 16-2 24 1M70 41c8-3 16-3 24-1M70 51c8-3 16-3 24-1" w={2} />
        <path d="M88 8l12 12-26 26-14 3 3-14z" fill={C.yellow} stroke={K} strokeWidth="2.2" strokeLinejoin="round" />
        <Spark x={18} y={12} c={C.pink} />
    </>,
    health: <>
        <Fill d="M60 88S20 64 20 38a18 18 0 0140-6 18 18 0 0140 6c0 26-40 50-40 50z" c={C.pink} />
        <Line d="M60 88S20 64 20 38a18 18 0 0140-6 18 18 0 0140 6c0 26-40 50-40 50z" />
        <path d="M14 56h22l6-12 9 24 8-18 5 6h42" fill="none" stroke={K} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <Spark x={100} y={18} />
    </>,
    zakat: <>
        <Fill d="M24 66h48v10H24zM24 56h48v10H24zM28 46h48v10H28z" c={C.yellow} dx={2} dy={2} />
        <Line d="M24 66h48v10H24zM24 56h48v10H24zM28 46h48v10H28z" />
        <circle cx="88" cy="68" r="14" fill={C.yellow} stroke={K} strokeWidth="2.6" />
        <text x="88" y="74" textAnchor="middle" fontFamily="Outfit, system-ui, sans-serif" fontWeight="700" fontSize="17" fill={K}>£</text>
        <path d="M66 14a16 16 0 1015 23 13 13 0 01-15-23z" fill={C.purple} stroke={K} strokeWidth="2.4" strokeLinejoin="round" />
        <Spark x={30} y={26} />
        <Line d="M14 86h92" w={2.2} />
    </>,
    mosque: <>
        <Fill d="M34 56c0-16 12-26 26-26s26 10 26 26z" c={C.green} />
        <Fill d="M28 56h64v32H28z" c={C.cream} dx={2} dy={2} />
        <Line d="M34 56c0-16 12-26 26-26s26 10 26 26M28 56h64v32H28z" />
        <Line d="M60 30v-8" /><path d="M60 14a5 5 0 105 6 4 4 0 01-5-6z" fill={C.yellow} stroke={K} strokeWidth="1.8" />
        <path d="M52 88V74a8 8 0 0116 0v14" fill={C.blue} stroke={K} strokeWidth="2.4" />
        <rect x="98" y="30" width="10" height="58" rx="2" fill={C.purple} stroke={K} strokeWidth="2.4" />
        <Line d="M97 30l6-10 6 10" />
        <Line d="M10 88h104" w={2.2} />
    </>,
    trees: <>
        <Fill d="M60 14c16 0 28 12 26 26 10 4 12 20 2 26-6 6-16 6-22 2H54c-6 4-16 4-22-2-10-6-8-22 2-26-2-14 10-26 26-26z" c={C.green} />
        <Line d="M60 14c16 0 28 12 26 26 10 4 12 20 2 26-6 6-16 6-22 2H54c-6 4-16 4-22-2-10-6-8-22 2-26-2-14 10-26 26-26z" />
        <path d="M54 68h12v22H54z" fill={C.brown} stroke={K} strokeWidth="2.4" />
        <Line d="M60 72l-8-8M60 78l8-8" w={2} />
        <Line d="M14 90h92" w={2.2} />
        <circle cx="44" cy="36" r="3" fill={C.red} /><circle cx="72" cy="44" r="3" fill={C.red} /><circle cx="58" cy="28" r="3" fill={C.red} />
    </>,
};
export const ILLUSTRATIONS = ["water", "emergency", "shelter", "food", "orphans", "education", "health", "zakat", "mosque", "trees"] as const;
export type Illustration = (typeof ILLUSTRATIONS)[number];
export const ILLUSTRATION_NAMES: Record<Illustration, string> = { water: "Water", emergency: "Emergency", shelter: "Shelter", food: "Food and iftar", orphans: "Orphans", education: "Education", health: "Health", zakat: "Zakat", mosque: "Masjid", trees: "Trees" };
/** The pastel each illustration sits on. */
export const ILLUSTRATION_BG: Record<Illustration, string> = { water: "#E3F1FF", emergency: "#FFE4DF", shelter: "#FFEFD9", food: "#FFF1D6", orphans: "#EEE9FF", education: "#E6F4FF", health: "#FFE6F6", zakat: "#FFF6CF", mosque: "#E4F7E1", trees: "#E4F7E1" };

/** A slight wobble on every line, so the drawing reads as hand-made rather than geometric. */
const Rough = ({ id }: { id: string }) => <filter id={id} x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" /><feDisplacementMap in="SourceGraphic" scale="2.2" /></filter>;

export const CauseArt = ({ name, className }: { name: string; className?: string }) => {
    const id = `rough-${useId().replace(/:/g, "")}`;
    return <svg viewBox="0 0 120 100" aria-hidden="true" className={className}><defs><Rough id={id} /></defs><g filter={`url(#${id})`}>{ART[name] ?? ART.health}</g></svg>;
};

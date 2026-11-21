/** Ramadan desk props for the home and pricing pages: a crescent, a lantern, prayer beads, a pencil, a folder, clips, a wrapped gift, a gold coin and a hanging star. All decorative. */
import type { CSSProperties } from "react";

type P = { className?: string; style?: CSSProperties };

/** A gold crescent with a small star. */
export const Crescent = ({ className, style }: P) => (
    <svg viewBox="0 0 112 112" className={className} style={style} aria-hidden="true">
        <defs>
            <linearGradient id="rdGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FCE7A2" /><stop offset=".5" stopColor="#D9A93D" /><stop offset="1" stopColor="#8E6517" /></linearGradient>
            <mask id="rdMoon"><rect width="112" height="112" fill="#fff" /><circle cx="74" cy="42" r="38" fill="#000" /></mask>
        </defs>
        <circle cx="54" cy="58" r="46" fill="url(#rdGold)" mask="url(#rdMoon)" />
        <path d="M88 18l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FCE7A2" />
    </svg>
);

/** A brass lantern, lit. */
export const Lantern = ({ className, style }: P) => (
    <svg viewBox="0 0 170 270" className={className} style={style} aria-hidden="true">
        <defs>
            <linearGradient id="rdBrass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8E6517" /><stop offset=".45" stopColor="#F3D27C" /><stop offset="1" stopColor="#7A5512" /></linearGradient>
            <radialGradient id="rdFlame" cx=".5" cy=".55" r=".6"><stop offset="0" stopColor="#FFF4C2" /><stop offset=".6" stopColor="#F7C95A" /><stop offset="1" stopColor="#C98A1E" /></radialGradient>
        </defs>
        <circle cx="85" cy="16" r="11" fill="none" stroke="url(#rdBrass)" strokeWidth="5" />
        <path d="M70 28h30l6 18H64z" fill="url(#rdBrass)" /><path d="M54 46h62l10 22H44z" fill="url(#rdBrass)" />
        <path d="M48 68h74l-6 120H54z" fill="url(#rdFlame)" />
        <path d="M73 68l-3 120M97 68l3 120M48 128h74" stroke="#8E6517" strokeWidth="4" fill="none" />
        <path className="rd-glow" d="M85 92c-10 12-10 22 0 30 10-8 10-18 0-30z" fill="#fff" />
        <path d="M50 188h70l12 22H38z" fill="url(#rdBrass)" /><rect x="44" y="210" width="82" height="12" rx="3" fill="url(#rdBrass)" /><path d="M64 222l-8 30h58l-8-30" fill="url(#rdBrass)" />
    </svg>
);

/** A strand of fifteen wooden prayer beads, laid in an arc. */
export const Beads = ({ className, style }: P) => (
    <div className={className} style={{ width: 200, height: 90, ...style }} aria-hidden="true">
        {Array.from({ length: 15 }, (_, i) => { const t = i / 14; return <span key={i} style={{ position: "absolute", left: Math.round(t * 186), top: Math.round(70 - Math.sin(t * Math.PI) * 60), width: 14, height: 14, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #F4E9D6, #B88A54 70%, #6E4A22)", boxShadow: "2px 4px 5px rgb(0 0 0 / 0.35)" }} />; })}
    </div>
);

/** A blue pencil, point up. Rotate it into place. */
export const Pencil = ({ className, style }: P) => (
    <div className={className} style={{ width: 16, height: 200, borderRadius: 4, background: "linear-gradient(90deg, #1E4FA8, #3D74D4 50%, #1E4FA8)", boxShadow: "0 10px 16px rgb(0 0 0 / 0.4)", ...style }} aria-hidden="true">
        <span style={{ position: "absolute", top: -26, left: "50%", marginLeft: -8, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: "26px solid #E9C894" }} />
    </div>
);

/** A manila folder with a receipt clipped inside. */
export const Folder = ({ className, style, label }: P & { label: string }) => (
    <div className={className} style={{ width: 210, height: 280, borderRadius: 14, background: "linear-gradient(160deg, #D9A86A, #B9824A)", boxShadow: "0 26px 30px rgb(0 0 0 / 0.4)", padding: "26px 22px", ...style }} aria-hidden="true">
        <div style={{ height: 130, borderRadius: 8, background: "#FBF8F1", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="rd-mono" style={{ fontSize: 11, color: "#7A2FA6", letterSpacing: 0 }}>{label}</span>
            {[80, 60, 70].map((w) => <span key={w} style={{ height: 7, width: `${w}%`, background: "#E4DFD4", borderRadius: 4 }} />)}
        </div>
    </div>
);

/** A steel paperclip. */
export const Paperclip = ({ className, style }: P) => (
    <svg viewBox="0 0 110 40" className={className} style={style} aria-hidden="true"><path d="M14 30h76a10 10 0 000-20H20a6 6 0 000 12h66" fill="none" stroke="rgb(230 235 240 / 0.85)" strokeWidth="3.5" strokeLinecap="round" /></svg>
);

/** A yellow binder clip. */
export const BinderClip = ({ className, style }: P) => (
    <svg viewBox="0 0 130 120" className={className} style={style} aria-hidden="true"><path d="M30 48c-10-30 20-44 32-22M70 48c4-34 44-30 34 0" fill="none" stroke="#C9CDD2" strokeWidth="5" strokeLinecap="round" /><path d="M10 52h110l-12 52H22z" fill="#F2CF2E" /><path d="M10 52h110l-4 14H14z" fill="#FBE26A" /></svg>
);

/** A wrapped gift with a gold bow. */
export const GiftBox = ({ className, style }: P) => (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
        <defs>
            <linearGradient id="rdBoxA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#EDC2FA" /><stop offset="1" stopColor="#A94FD0" /></linearGradient>
            <linearGradient id="rdBoxB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F8E0FE" /><stop offset="1" stopColor="#C77BE6" /></linearGradient>
            <linearGradient id="rdBoxC" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFF3B8" /><stop offset="1" stopColor="#E0A52E" /></linearGradient>
        </defs>
        <ellipse cx="100" cy="186" rx="68" ry="8" fill="#000" opacity=".25" />
        <rect x="38" y="94" width="124" height="86" rx="12" fill="url(#rdBoxA)" />
        <path d="M122 94h28a12 12 0 0112 12v62a12 12 0 01-12 12h-28z" fill="#6E2A96" opacity=".28" />
        <rect x="38" y="100" width="124" height="10" fill="#6E2A96" opacity=".25" />
        <rect x="86" y="94" width="28" height="86" fill="url(#rdBoxC)" />
        <rect x="30" y="70" width="140" height="32" rx="10" fill="url(#rdBoxB)" />
        <rect x="86" y="70" width="28" height="32" fill="url(#rdBoxC)" />
        <path d="M100 72C82 34 40 36 48 60c6 16 36 14 52 12z" fill="url(#rdBoxC)" />
        <path d="M100 72c18-38 60-36 52-12-6 16-36 14-52 12z" fill="#E9B84A" />
        <path d="M92 66C82 48 62 46 62 56c0 8 18 10 30 10z" fill="#FFF8E0" opacity=".75" />
        <circle cx="100" cy="70" r="11" fill="#D4901A" /><circle cx="97" cy="67" r="5" fill="#FFF3B8" opacity=".8" />
        <rect x="40" y="76" width="34" height="7" rx="3.5" fill="#fff" opacity=".65" />
    </svg>
);

/** A gold pound coin. */
export const Coin = ({ className, style }: P) => (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
        <defs>
            <radialGradient id="rdCoinA" cx=".34" cy=".28" r=".85"><stop offset="0" stopColor="#FFF6C4" /><stop offset=".5" stopColor="#F6CB4C" /><stop offset="1" stopColor="#D4901A" /></radialGradient>
            <linearGradient id="rdCoinB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E9B84A" /><stop offset="1" stopColor="#9C6410" /></linearGradient>
        </defs>
        <ellipse cx="104" cy="186" rx="62" ry="8" fill="#000" opacity=".22" />
        <circle cx="110" cy="104" r="80" fill="url(#rdCoinB)" />
        <circle cx="96" cy="98" r="80" fill="url(#rdCoinA)" />
        <circle cx="96" cy="98" r="62" fill="none" stroke="#C28A1C" strokeWidth="4" opacity=".55" />
        <circle cx="96" cy="98" r="72" fill="none" stroke="#FFF6C4" strokeWidth="2" opacity=".7" />
        <path d="M122 132H74v-6c8-4 12-10 12-20h-12v-10h10c-1-4-2-8-2-12 0-14 10-23 24-23 8 0 14 3 18 7l-9 9c-2-3-5-4-9-4-6 0-10 4-10 10 0 4 1 8 2 13h16v10H99c0 8-3 14-7 18h30z" fill="#A9741A" />
        <path d="M120 130H72v-6c8-4 12-10 12-20H72V94h10c-1-4-2-8-2-12 0-14 10-23 24-23 8 0 14 3 18 7l-9 9c-2-3-5-4-9-4-6 0-10 4-10 10 0 4 1 8 2 13h16v10H97c0 8-3 14-7 18h30z" fill="#FFF3B8" opacity=".85" />
        <ellipse cx="62" cy="58" rx="24" ry="9" fill="#fff" opacity=".6" transform="rotate(-38 62 58)" />
    </svg>
);

/** An eight-point brass star hanging on a thread. */
export const Star = ({ className, style }: P) => (
    <svg viewBox="0 0 120 200" className={className} style={style} aria-hidden="true">
        <defs>
            <linearGradient id="rdStar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0b0" /><stop offset=".5" stopColor="#e9b84a" /><stop offset="1" stopColor="#9c6410" /></linearGradient>
            <radialGradient id="rdStarGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffe48a" stopOpacity=".7" /><stop offset="1" stopColor="#ffe48a" stopOpacity="0" /></radialGradient>
        </defs>
        <path d="M60 0v92" stroke="#d9c38a" strokeWidth="1.5" />
        <circle className="rd-glow" cx="60" cy="130" r="58" fill="url(#rdStarGlow)" />
        <g transform="translate(60 130)">
            <rect x="-32" y="-32" width="64" height="64" rx="6" fill="url(#rdStar)" />
            <rect x="-32" y="-32" width="64" height="64" rx="6" fill="url(#rdStar)" transform="rotate(45)" />
            <circle r="20" fill="#4a1d6b" /><circle r="20" fill="none" stroke="#fff3c4" strokeWidth="2" opacity=".8" />
            <path d="M8 -10A12 12 0 1 0 8 10 9.5 9.5 0 1 1 8 -10z" fill="#fff3c4" />
        </g>
    </svg>
);

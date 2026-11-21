import { useId } from "react";
import { cx } from "@/shared/utils/cx";

export type BuddyMood = "happy" | "wow" | "cheer";

/** Penny, the campaign buddy: a glossy pink heart with a face, little arms, and hands that grip the edge of whatever sits below her
 *  (her hands' centre is at 90% of her height). Three moods; she bobs, and waves when cheering, unless motion is reduced. */
export const Buddy = ({ mood = "happy", className }: { mood?: BuddyMood; className?: string }) => {
    const id = useId();
    return (
        <svg viewBox="0 0 140 120" aria-hidden="true" className={cx("block overflow-visible drop-shadow-[0_14px_18px_rgb(190_40_120/0.25)]", className)}>
            <defs>
                <radialGradient id={`${id}b`} cx="36%" cy="28%" r="80%"><stop offset="0" stopColor="#ffe3f2" /><stop offset="0.45" stopColor="#ffa9d8" /><stop offset="1" stopColor="#e9549f" /></radialGradient>
                <radialGradient id={`${id}h`} cx="40%" cy="30%" r="75%"><stop offset="0" stopColor="#ffd0ea" /><stop offset="1" stopColor="#ea6bb0" /></radialGradient>
                <linearGradient id={`${id}r`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.3" stopColor="#fff" stopOpacity="0" /></linearGradient>
            </defs>
            <g className="origin-[70px_100px] animate-[bob_3.2s_ease-in-out_infinite] motion-reduce:animate-none">
                {/* arms */}
                <path d="M26 58q-14 26 12 46" fill="none" stroke="#ea6bb0" strokeWidth="9" strokeLinecap="round" />
                {mood === "cheer" ? <path d="M113 52q16-10 14-28" fill="none" stroke="#ea6bb0" strokeWidth="9" strokeLinecap="round" /> : <path d="M114 58q14 26-12 46" fill="none" stroke="#ea6bb0" strokeWidth="9" strokeLinecap="round" />}
                <path d="M70 104C34 81 16 60 16 38 16 20 29 7 46 7c11 0 19 6 24 14 5-8 13-14 24-14 17 0 30 13 30 31 0 22-18 43-54 66Z" fill={`url(#${id}b)`} />
                <path d="M70 104C34 81 16 60 16 38 16 20 29 7 46 7c11 0 19 6 24 14 5-8 13-14 24-14 17 0 30 13 30 31 0 22-18 43-54 66Z" fill={`url(#${id}r)`} />
                <ellipse cx="40" cy="22" rx="11" ry="6.5" fill="#fff" opacity="0.7" transform="rotate(-28 40 22)" />
                <circle cx="29" cy="34" r="3" fill="#fff" opacity="0.75" />
                {mood === "cheer" ? (
                    <g fill="none" stroke="#12182c" strokeWidth="4.5" strokeLinecap="round"><path d="M46 49q9-10 18 0" /><path d="M76 49q9-10 18 0" /></g>
                ) : (
                    <g><ellipse cx="55" cy="48" rx="9" ry="10.5" fill="#12182c" /><ellipse cx="85" cy="48" rx="9" ry="10.5" fill="#12182c" /><circle cx="58.5" cy="44" r="3.8" fill="#fff" /><circle cx="88.5" cy="44" r="3.8" fill="#fff" /><circle cx="52.5" cy="53" r="1.6" fill="#fff" opacity="0.8" /><circle cx="82.5" cy="53" r="1.6" fill="#fff" opacity="0.8" /></g>
                )}
                <ellipse cx="38" cy="64" rx="8" ry="4.5" fill="#ff4f9e" opacity="0.4" />
                <ellipse cx="102" cy="64" rx="8" ry="4.5" fill="#ff4f9e" opacity="0.4" />
                {mood === "wow" ? <ellipse cx="70" cy="68" rx="5.5" ry="6.5" fill="#12182c" /> : mood === "cheer" ? <path d="M58 62q12 17 24 0Z" fill="#12182c" /> : <path d="M60 64q10 10 20 0" fill="none" stroke="#12182c" strokeWidth="4.5" strokeLinecap="round" />}
            </g>
            {/* hands gripping the edge below */}
            <g fill={`url(#${id}h)`}><ellipse cx="44" cy="108" rx="12" ry="8" /><ellipse cx="96" cy="108" rx="12" ry="8" /></g>
            <path d="M38 106v5M44 105v6M50 106v5M90 106v5M96 105v6M102 106v5" stroke="#d65a9e" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
};

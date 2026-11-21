/**
 * BorderBeam, ported from Magic UI (https://magicui.design/docs/components/border-beam), MIT licence.
 * A beam of light that travels round the border of its parent, which needs `position: relative` and a border radius.
 * Decorative: it stands still under prefers-reduced-motion.
 */
import type { CSSProperties } from "react";
import { type Transition, motion, useReducedMotion } from "motion/react";
import { cx } from "@/shared/utils/cx";

interface BorderBeamProps {
    /** Length of the beam in px. */
    size?: number;
    /** Seconds for one lap. */
    duration?: number;
    delay?: number;
    colorFrom?: string;
    colorTo?: string;
    transition?: Transition;
    className?: string;
    style?: CSSProperties;
    reverse?: boolean;
    /** Where on the border the beam starts, 0–100. */
    initialOffset?: number;
    borderWidth?: number;
}

export const BorderBeam = ({ className, size = 50, delay = 0, duration = 6, colorFrom = "#ffaa40", colorTo = "#9c40ff", transition, style, reverse = false, initialOffset = 0, borderWidth = 1 }: BorderBeamProps) => {
    const still = useReducedMotion();
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] [mask-composite:intersect] [mask-clip:padding-box,border-box]" style={{ borderWidth, borderStyle: "solid" }}>
            <motion.div
                className={cx("absolute aspect-square bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent", className)}
                style={{ width: size, offsetPath: `rect(0 auto auto 0 round ${size}px)`, "--color-from": colorFrom, "--color-to": colorTo, ...style } as never}
                initial={{ offsetDistance: `${initialOffset}%` }}
                animate={still ? undefined : { offsetDistance: reverse ? [`${100 - initialOffset}%`, `${-initialOffset}%`] : [`${initialOffset}%`, `${100 + initialOffset}%`] }}
                transition={{ repeat: Infinity, ease: "linear", duration, delay: -delay, ...transition }}
            />
        </div>
    );
};

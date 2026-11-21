/**
 * NumberTicker, ported from Magic UI (https://magicui.design/docs/components/number-ticker), MIT licence.
 * Changes: `format` in place of a fixed en-US number format, the real value for screen readers, and no spring under reduced motion.
 */
import { type ComponentPropsWithoutRef, useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cx } from "@/shared/utils/cx";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
    value: number;
    startValue?: number;
    delay?: number;
    /** How the number is written at every step, e.g. as money. */
    format?: (n: number) => string;
}

const plain = (n: number) => Math.round(n).toLocaleString("en-GB");

export const NumberTicker = ({ value, startValue = 0, delay = 0, format = plain, className, ...props }: NumberTickerProps) => {
    const ref = useRef<HTMLSpanElement>(null);
    const still = useReducedMotion();
    const motionValue = useMotionValue(startValue);
    const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
    const isInView = useInView(ref, { once: true, margin: "0px" });

    useEffect(() => {
        if (!isInView) return;
        if (still) { springValue.jump(value); if (ref.current) ref.current.textContent = format(value); return; }
        const timer = setTimeout(() => motionValue.set(value), delay * 1000);
        return () => clearTimeout(timer);
    }, [motionValue, springValue, isInView, delay, value, still, format]);

    useEffect(() => springValue.on("change", (latest) => { if (ref.current) ref.current.textContent = format(latest); }), [springValue, format]);

    return <span className={cx("inline-block tabular-nums", className)} {...props}><span className="sr-only">{format(value)}</span><span ref={ref} aria-hidden="true">{format(startValue)}</span></span>;
};

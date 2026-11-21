/**
 * BlurFade, ported from Magic UI (https://magicui.design/docs/components/blur-fade), MIT licence.
 * Children fade up out of a blur, at once or when scrolled into view. Under prefers-reduced-motion they are simply there.
 */
import { type ReactNode, useRef } from "react";
import { AnimatePresence, type MotionProps, type UseInViewOptions, type Variants, motion, useInView, useReducedMotion } from "motion/react";

interface BlurFadeProps extends MotionProps {
    children: ReactNode;
    className?: string;
    duration?: number;
    delay?: number;
    offset?: number;
    direction?: "up" | "down" | "left" | "right";
    inView?: boolean;
    inViewMargin?: UseInViewOptions["margin"];
    blur?: string;
}

export const BlurFade = ({ children, className, duration = 0.4, delay = 0, offset = 6, direction = "down", inView = false, inViewMargin = "-50px", blur = "6px", ...props }: BlurFadeProps) => {
    const ref = useRef(null);
    const seen = useInView(ref, { once: true, margin: inViewMargin });
    const still = useReducedMotion();
    const axis = direction === "left" || direction === "right" ? "x" : "y";
    const variants: Variants = {
        hidden: { [axis]: direction === "right" || direction === "down" ? -offset : offset, opacity: 0, filter: `blur(${blur})` },
        visible: { [axis]: 0, opacity: 1, filter: "blur(0px)" },
    };
    return (
        <AnimatePresence>
            <motion.div ref={ref} initial={still ? false : "hidden"} animate={!inView || seen ? "visible" : "hidden"} exit="hidden" variants={variants} transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }} className={className} {...props}>
                {children}
            </motion.div>
        </AnimatePresence>
    );
};

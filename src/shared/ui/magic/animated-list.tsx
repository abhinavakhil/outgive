/**
 * AnimatedList, ported from Magic UI (https://magicui.design/docs/components/animated-list), MIT licence.
 * AnimatedListItem springs a row in and out and slides its neighbours into place; AnimatedList reveals its children one at a time, newest on top.
 * Wrap the app in <MotionConfig reducedMotion="user"> and both respect prefers-reduced-motion.
 */
import { Children, type ComponentPropsWithoutRef, type ReactNode, memo, useEffect, useMemo, useState } from "react";
import { AnimatePresence, type MotionProps, motion } from "motion/react";
import { cx } from "@/shared/utils/cx";

const SPRING: MotionProps = {
    initial: { scale: 0.96, opacity: 0 },
    animate: { scale: 1, opacity: 1, originY: 0 },
    exit: { scale: 0.96, opacity: 0 },
    transition: { type: "spring", stiffness: 350, damping: 40 },
};

/** Extra props (role, style, data-*) land on the animated element, so it can be the row itself. */
export const AnimatedListItem = ({ children, className, ...props }: ComponentPropsWithoutRef<typeof motion.div> & { children: ReactNode }) => <motion.div {...SPRING} layout className={cx("mx-auto w-full", className as string)} {...props}>{children}</motion.div>;

interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> { children: ReactNode; delay?: number }

export const AnimatedList = memo(({ children, className, delay = 1000, ...props }: AnimatedListProps) => {
    const [index, setIndex] = useState(0);
    const all = useMemo(() => Children.toArray(children), [children]);
    useEffect(() => {
        if (index >= all.length - 1) return;
        const timeout = setTimeout(() => setIndex((i) => (i + 1) % all.length), delay);
        return () => clearTimeout(timeout);
    }, [index, delay, all.length]);
    const shown = useMemo(() => all.slice(0, index + 1).reverse(), [index, all]);
    return (
        <div className={cx("flex flex-col items-center gap-4", className)} {...props}>
            <AnimatePresence>{shown.map((item) => <AnimatedListItem key={(item as { key?: string }).key}>{item}</AnimatedListItem>)}</AnimatePresence>
        </div>
    );
});
AnimatedList.displayName = "AnimatedList";

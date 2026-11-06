import { motion } from "motion/react";
import { useMemo } from "react";
import { cx } from "@/shared/utils/cx";

/** A burst of brand-coloured confetti; a new `at` fires it again. */
export const Confetti = ({ at }: { at: number }) => {
    const bits = useMemo(() => Array.from({ length: 80 }, (_, i) => ({ x: (i * 37) % 100, d: 0.6 + ((i * 13) % 10) / 10, r: (i * 53) % 360, c: ["bg-brand-400", "bg-brand-600", "bg-white", "bg-brand-200", "bg-yellow-300"][i % 5], w: 6 + (i % 3) * 3 })), [at]);
    return <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">{bits.map((b, i) => <motion.span key={`${at}-${i}`} initial={{ y: -40, x: `${b.x}vw`, rotate: 0, opacity: 1 }} animate={{ y: "110vh", rotate: b.r + 720, opacity: [1, 1, 0.8, 0] }} transition={{ duration: 2.4 + b.d, ease: "easeIn", delay: (i % 7) * 0.08 }} className={cx("absolute top-0 rounded-sm", b.c)} style={{ width: b.w, height: b.w * 1.6 }} />)}</div>;
};

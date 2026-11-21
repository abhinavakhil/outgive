import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";

/**
 * Building blocks of the create flow and the campaign page made from it (Plus Jakarta, the --f-* palette under .focus-bg in outgive.css).
 * Kept together so both screens look like one product.
 */
/** One accent colour for the whole flow: "pink" (homepage pink button, pink highlights) or "blue" (blue button, blue highlights). */
export const ACCENT: "pink" | "blue" = "pink";
export const focus = "outline-(--f-blue) focus-visible:outline-2 focus-visible:outline-offset-2";
/** Focus on a boxed field: a soft blue tint, not a hard blue border. */
export const soft = "focus-within:border-(--f-ice-line) focus-within:shadow-[0_0_0_4px_var(--f-ice)]";
/** One boxed field style for every text answer. */
export const field = cx("flex h-[72px] items-center gap-4 rounded-[20px] border-[1.5px] border-(--f-line) bg-(--f-card) px-5 shadow-[0_1px_2px_rgb(11_15_25/0.04)] transition", soft);
export const fieldInput = "min-w-0 flex-1 border-0 bg-transparent p-0 text-[20px] leading-none font-extrabold tracking-[-0.02em] text-(--f-ink) outline-none placeholder:text-(--f-ph) md:text-[24px]";
/** Selectable card: white, or ice-blue with a soft lift when chosen. */
export const tile = (on: boolean) => cx("relative cursor-pointer rounded-[18px] border-[1.5px] text-left transition duration-200", focus, on ? "border-(color:--f-sel) bg-(--f-card) shadow-[0_0_0_3px_var(--f-ice),0_12px_28px_-16px_var(--f-glow)]" : "border-(--f-line) bg-(--f-card) hover:-translate-y-px hover:border-(--f-ice-line) hover:shadow-[0_10px_24px_-16px_rgb(11_15_25/0.25)]");
export const pill = (on: boolean) => cx("h-11 cursor-pointer rounded-full border-[1.5px] px-4 text-[15px] leading-none font-bold tabular-nums transition", focus, on ? "border-(color:--f-sel) bg-(--f-card) text-(--f-blue) shadow-[0_0_0_3px_var(--f-ice)]" : "border-(--f-line) bg-(--f-card) text-(--f-ink) hover:border-(--f-ice-line)");
export const Tick = ({ on }: { on: boolean }) => <span className={cx("absolute top-3.5 right-3.5 flex size-[22px] items-center justify-center rounded-full transition", on ? "bg-(--f-mark) text-[#0b0f19]" : "border-2 border-(--f-line)")}>{on && <Svg d={TICK} size={12} w={3.5} />}</span>;
export const next = cx("group inline-flex h-[52px] cursor-pointer items-center gap-2.5 rounded-full bg-(--f-cta) pr-2 pl-6 text-[15px] leading-none font-bold text-(--f-cta-ink) shadow-press transition hover:bg-(--f-cta-hover) active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-50", focus);
export const linkCls = cx("inline-flex cursor-pointer items-center gap-2 text-sm leading-none font-bold text-(--f-grey) no-underline hover:text-(--f-ink)", focus);
export const Svg = ({ d, size = 16, w = 2.5, className }: { d: string; size?: number; w?: number; className?: string }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={d} /></svg>;
export const ARROW = "M5 12h14M13 6l6 6-6 6", UP = "M7 17L17 7M9 7h8v8", BACK = "M19 12H5M11 6l-6 6 6 6", TICK = "M5 12l5 5 9-10";
export const Bubble = ({ d = ARROW }: { d?: string }) => <span className="flex size-9 items-center justify-center rounded-full bg-white text-(--f-cta-arrow)"><Svg d={d} /></span>;
export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="inline-flex h-[22px] items-center rounded-md border border-(--f-line) bg-(--f-kbd) px-[7px] font-jakarta text-[11px] leading-none font-bold text-(--f-grey)">{children}</kbd>;
export const Mic = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8" /></svg>;
export const Check = ({ on, size = 20, line = "bg-(--f-line)" }: { on: boolean; size?: number; line?: string }) => <span className={cx("flex shrink-0 items-center justify-center rounded-full", on ? "bg-(--f-mark) text-[#0b0f19]" : line)} style={{ width: size, height: size }}>{on && <Svg d={TICK} size={12} w={4} />}</span>;

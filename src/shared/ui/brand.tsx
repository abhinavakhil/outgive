import { Moon01, Sun } from "@untitledui/icons";
import { useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { initials } from "@/shared/lib/format";
import { cx } from "@/shared/utils/cx";

/** The charity's mark: its uploaded logo, or its initials in the brand colour. */
export const BrandMark = ({ className }: { className?: string }) => {
    const { brand } = useApp();
    return brand.logo
        ? <img src={brand.logo} alt="" className={cx("size-9 shrink-0 rounded-xl object-cover", className)} />
        : <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-charity,var(--color-brand-600))] text-sm font-bold text-white", className)}>{initials(brand.name) || "?"}</span>;
};
/** The charity's name and mark; links home. */
export const BrandLogo = ({ onClick, mark }: { onClick?: () => void; mark?: string }) => {
    const { brand } = useApp();
    return (
        <button type="button" onClick={onClick} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
            <BrandMark className={cx("size-7 rounded-lg text-xs", mark)} />
            <span className="truncate text-[22px] leading-tight font-medium tracking-[-0.04em] text-primary">{brand.name}</span>
        </button>
    );
};

/** Outgive's own mark. With `href` it is a link (pages rendered without the app), otherwise a button. */
/** The solid heart from the homepage mark. */
const Heart = ({ className }: { className?: string }) => <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" /></svg>;
export const Logo = ({ onClick, href }: { onClick?: () => void; href?: string }) => {
    // The homepage mark: a heart on a rounded tile with a hard press shadow, and the wordmark in Fredoka.
    const cls = "flex cursor-pointer items-center gap-2 rounded-md text-primary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2";
    const mark = (
        <>
            <span className="flex size-8 items-center justify-center rounded-xl bg-brand-solid text-white shadow-[0_3px_0_rgb(0_0_0/0.15)]"><Heart aria-hidden="true" className="size-4.5" /></span>
            <span className="font-bubble text-2xl font-bold tracking-tight">outgive</span>
        </>
    );
    return href ? <a href={href} className={cls}>{mark}</a> : <button type="button" onClick={onClick} className={cls}>{mark}</button>;
};

const useTheme = () => {
    const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark-mode"));
    const toggle = () => {
        const next = !dark;
        document.documentElement.classList.toggle("dark-mode", next);
        try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* storage unavailable */ }
        setDark(next);
    };
    return [dark, toggle] as const;
};
export const ThemeToggle = () => {
    const [dark, toggle] = useTheme();
    return (
        <button type="button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle} className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-tertiary outline-focus-ring transition hover:bg-secondary hover:text-primary focus-visible:outline-2">
            {dark ? <Sun className="size-4" /> : <Moon01 className="size-4" />}
        </button>
    );
};

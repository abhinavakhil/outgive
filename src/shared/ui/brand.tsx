import { Moon01, Sun } from "@untitledui/icons";
import { useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { initials } from "@/shared/lib/format";
import { cx } from "@/shared/utils/cx";
import { Logo as OgLogo } from "@/shared/ui/og-logo";

/** The charity's mark: its uploaded logo, or its initials in the brand colour. */
export const BrandMark = ({ className }: { className?: string }) => {
    const { brand } = useApp();
    return brand.logo
        ? <img src={brand.logo} alt="" className={cx("size-9 shrink-0 rounded-xl object-cover", className)} />
        : <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-charity,var(--color-brand-600))] text-sm font-bold text-white", className)}>{initials(brand.name) || "?"}</span>;
};
/** The charity's name and mark; links home. */
export const BrandLogo = ({ onClick, mark }: { onClick?: () => void; mark?: string }) => {
    const { brand, go } = useApp();
    return (
        <button type="button" onClick={onClick ?? (() => go({ name: "landing" }))} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
            <BrandMark className={cx("size-7 rounded-lg text-xs", mark)} />
            <span className="truncate text-[22px] leading-tight font-medium tracking-[-0.04em] text-primary">{brand.name}</span>
        </button>
    );
};

/** Outgive's own mark. With `href` it is a link (pages rendered without the app), otherwise a button. */
/** The Outgive logo. It always links to the landing page (/); `onClick` and `href` are accepted for older callers and ignored. */
export const Logo = ({ tone = "auto" }: { onClick?: () => void; href?: string; tone?: "light" | "dark" | "auto" }) => (
    <a href="/" aria-label="Outgive home" className="flex cursor-pointer items-center rounded-md text-primary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"><OgLogo size={26} tone={tone} /></a>
);

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

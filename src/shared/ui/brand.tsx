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
        : <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-solid text-sm font-bold text-white", className)}>{initials(brand.name) || "?"}</span>;
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

export const Logo = ({ onClick }: { onClick?: () => void }) => (
    <button type="button" onClick={onClick} className="flex cursor-pointer items-center gap-2 rounded-md text-xl font-semibold tracking-tight text-primary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
        <svg width="28" height="24" viewBox="0 0 28 24" aria-hidden="true" fill="none" strokeLinecap="round" strokeWidth="4.2">
            <path d="M7 5h18" className="stroke-brand-600" /><path d="M7 12h12" className="stroke-fg-primary" /><path d="M7 19h6" className="stroke-fg-primary" /><path d="M3 5v14" className="stroke-fg-primary" />
        </svg>
        outgive
    </button>
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

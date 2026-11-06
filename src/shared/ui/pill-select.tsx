import { ChevronDown } from "@untitledui/icons";
import { cx } from "@/shared/utils/cx";

/** The one select style for toolbars and filters: pill, same font and height as the other controls, custom chevron. */
export const FIELD = "h-11 rounded-full bg-primary px-4 text-md text-primary ring-1 ring-primary ring-inset outline-focus-ring placeholder:text-placeholder focus:outline-2";
export const PillSelect = ({ label, value, onChange, options, placeholder, className, size = "md" }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; className?: string; size?: "sm" | "md" }) => (
    <span className={cx("relative inline-flex", className)}>
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cx(FIELD, "w-full cursor-pointer appearance-none pr-9", size === "sm" && "h-9 text-sm", !value && placeholder && "text-placeholder")}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-quaternary" />
    </span>
);

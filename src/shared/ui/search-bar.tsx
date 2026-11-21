import { SearchLg } from "@untitledui/icons";
import { useEffect, useId } from "react";
import { Input, type InputProps } from "@/shared/ui/base/input/input";

/**
 * Search field in the style of teseria.dev: the raised 52px field with a leading search icon and a key hint.
 * Press "/" anywhere to focus it; while it has text the hint reads "esc", which clears it.
 */
export const SearchBar = ({ placeholder = "Search", size = "lg", id, ...props }: Omit<InputProps, "icon" | "type" | "shortcut">) => {
    const auto = useId();
    const fieldId = id ?? auto;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable=true]")) return;
            e.preventDefault();
            document.getElementById(fieldId)?.focus();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [fieldId]);
    return <Input {...props} id={fieldId} size={size} type="search" icon={SearchLg} placeholder={placeholder} shortcut={props.value ? "esc" : "/"} />;
};

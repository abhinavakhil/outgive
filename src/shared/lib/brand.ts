import type { Brand } from "@/shared/domain/model";

/**
 * The app always uses the Outgive palette and fonts (see shared/styles/outgive.css).
 * A charity's own colour is exposed as --color-charity for its logo tile only.
 */
export const applyBrand = (b: Brand) => {
    document.documentElement.style.setProperty("--color-charity", b.color);
};

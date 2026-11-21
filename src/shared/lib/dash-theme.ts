/**
 * The dashboard keeps its own light/dark choice, apart from the site's: light unless its own toggle chose dark.
 * index.html reads the same key before first paint, so /dashboard never flashes the site's theme.
 */
export const DASH_THEME_KEY = "outgive.dash.theme";
export const DASH_BG = { light: "#F2F0EC", dark: "#18181B" } as const;
export const dashDark = () => { try { return localStorage.getItem(DASH_THEME_KEY) === "dark"; } catch { return false; } };

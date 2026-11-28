/** The home page (the Ramadan giving pitch, at /), the earlier coming-soon page (now /legacy) and the gate that shows it on every path. Loaded eagerly: it is the first paint. */
export { ComingSoon, ComingSoonGate } from "./components/ComingSoon";
export { Ramadan } from "./components/Ramadan";
export { LandingV2 } from "./components/LandingV2";
export { BioEditor, CharityBio } from "./components/CharityBio";
export { RamadanGive } from "./give/RamadanGive";
export { RamadanAccount, RamadanSignIn, RamadanTeam } from "./account/Account";
/** The home page's pieces, for other pages drawn in the same board-and-paper style (pricing). Importing them brings ramadan.css with it. */
export { Label, Logo, Mark, Tick, useMotion } from "./components/Ramadan";
export { Coin, GiftBox, Star } from "./components/props";
/** For the charity back office (/engage): sign-in, roles and the appeal's numbers. */
export { SignInPanel } from "./account/Account";
export { ROLE_INFO, atLeast, useRoles, type OrgRole, type Role } from "./account/roles";
export { type InsightStats, nightsFrom } from "./bio/Insights";
export type { BioPage } from "./bio/model";

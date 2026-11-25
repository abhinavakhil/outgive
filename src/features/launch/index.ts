/** The home page (the Ramadan giving pitch, at /), the earlier coming-soon page (now /legacy) and the gate that shows it on every path. Loaded eagerly: it is the first paint. */
export { ComingSoon, ComingSoonGate } from "./components/ComingSoon";
export { Ramadan } from "./components/Ramadan";
export { LandingV2 } from "./components/LandingV2";
export { BioEditor, CharityBio } from "./components/CharityBio";
export { RamadanGive } from "./give/RamadanGive";
/** The home page's pieces, for other pages drawn in the same board-and-paper style (pricing). Importing them brings ramadan.css with it. */
export { Label, Logo, Mark, Tick, useMotion } from "./components/Ramadan";
export { Coin, GiftBox, Star } from "./components/props";

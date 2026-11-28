import type { ReactNode } from "react";
import { LockSimple } from "@phosphor-icons/react";
import { OgLogo } from "@/shared/ui";
import { cx } from "@/shared/utils/cx";
import "./pledge.css";

/** The pay link's and the host console's frame: the logo, "Secure", then one centred column. */
export const Frame = ({ children, wide }: { children: ReactNode; wide?: boolean }) => (
    <div className="pp">
        <header className="pp-top"><a href="/" aria-label="Outgive home" className="pp-home"><OgLogo size={24} /></a><span style={{ flex: 1 }} /><span className="pp-secure"><LockSimple size={14} weight="fill" aria-hidden="true" />Secure</span></header>
        <main className={cx("pp-main", wide && "wide")}>{children}</main>
    </div>
);

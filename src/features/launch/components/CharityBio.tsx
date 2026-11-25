/**
 * /ramadhan: the charity's Ramadan giving page, as its organiser set it up in /ramadhan/edit.
 * "Organiser view" shows the appeal's insights on the page itself. ?date=YYYY-MM-DD previews the banner on another day;
 * ?insights opens organiser view.
 */
import { useState } from "react";
import { BioView, type GiveHref } from "../bio/BioView";
import { Insights } from "../bio/Insights";
import { useBioPage } from "../bio/model";

/**
 * Give buttons open the Ramadan donate flow. The page and the flow share one basket (give/store.ts), so whatever was picked
 * here is already there; a button for one cause (Pay your Zakat) adds it on the way.
 */
const giveHref: GiveHref = (_summary, start = {}) => (start.add?.length === 1 ? `/ramadhan/give?add=${start.add[0]}` : "/ramadhan/give");

export const CharityBio = () => {
    const { page } = useBioPage();
    const q = new URLSearchParams(window.location.search);
    const date = q.get("date");
    const [organiser, setOrganiser] = useState(q.has("insights"));
    return (
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", overflowX: "clip" }}>
            <div className="bp-tools">
                <button type="button" aria-pressed={organiser} onClick={() => setOrganiser(!organiser)} className="bp-tool">{organiser ? "Back to page" : "Organiser view"}</button>
                {/* The editor (/ramadhan/edit) is closed for now; see isOpen in App.tsx. */}
                {import.meta.env.VITE_ALL_PAGES === "true" && <a href="/ramadhan/edit" className="bp-tool">Edit page</a>}
            </div>
            {organiser ? (
                <main className="bp-dash">
                    <div className="bp-dash-in">
                        <header className="bp-dash-head"><span className="bp-pav">{page.avatar || page.name.slice(0, 2).toUpperCase()}</span><div><h1>{page.name}</h1><p>Ramadan appeal insights. Only you see this.</p></div></header>
                        <Insights page={page} />
                    </div>
                </main>
            ) : <div style={{ flex: 1, display: "flex", flexDirection: "column" }}><BioView page={page} now={date ? Date.parse(date) : undefined} giveHref={giveHref} /></div>}
        </div>
    );
};

export { BioEditor } from "../bio/BioEditor";

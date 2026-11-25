import { SitePage } from "@/shared/ui/site-shell";

/** The 404 page, in the public site's frame. */
export const NotFound = () => (
    <SitePage>
        <div className="flex flex-col items-start gap-5 pt-10">
            <span className="og-tag" style={{ background: "#FDEBDF", color: "#C24A14" }}>404</span>
            <h1 className="og-h1">We can't find <span className="og-script">that</span> page.</h1>
            <p className="og-lead" style={{ marginTop: 0 }}>The link may be wrong, or the page was made in another browser. Pages in this demo are saved only in the browser that published them.</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2"><a href="/leaderboard" className="og-btn">See the leaderboard</a><a href="/create" className="og-link">Start fundraising</a></div>
        </div>
    </SitePage>
);

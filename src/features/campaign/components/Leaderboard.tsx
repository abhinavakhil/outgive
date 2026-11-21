import { useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import type { Campaign } from "@/shared/lib/campaign-store";
import type { Donation, PageType } from "@/shared/domain/model";
import { initials } from "@/shared/lib/format";
import { cx } from "@/shared/utils/cx";

/** One place on the board: a team, a fundraiser or a supporter. */
interface Entry { id: string; name: string; amount: number; goal?: number; note?: string; open?: () => void }
type Tab = "teams" | "members" | "fundraisers" | "supporters";

const ring = "outline-white focus-visible:outline-2 focus-visible:outline-offset-2";
// Gold, silver, bronze: the medal face, its darker rim, and the ribbon behind it.
const MEDAL = [
    { face: "#ffd25e", rim: "#e0a400", ribbon: "#ffb0de", label: "1st" },
    { face: "#e6ecf5", rim: "#a9b6c8", ribbon: "#9ab4ff", label: "2nd" },
    { face: "#f2b27e", rim: "#c6773d", ribbon: "#ffd0ea", label: "3rd" },
];

/** A medal with ribbon tails and the place number. */
const Medal = ({ place, size = 30 }: { place: 0 | 1 | 2; size?: number }) => {
    const m = MEDAL[place];
    return (
        <svg viewBox="0 0 40 46" width={size} height={size * 1.15} role="img" aria-label={`${m.label} place`}>
            <path d="M12 26 7 44l7-4 4 6 4-16z" fill={m.ribbon} /><path d="M28 26l5 18-7-4-4 6-4-16z" fill={m.ribbon} opacity="0.85" />
            <circle cx="20" cy="20" r="16" fill={m.rim} /><circle cx="20" cy="20" r="12.5" fill={m.face} />
            <path d="M11 15a10 10 0 0 1 8-6" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <text x="20" y="25" textAnchor="middle" fontSize="14" fontWeight="800" fill="#3a2a00" fontFamily="Fredoka, Inter, sans-serif">{place + 1}</text>
        </svg>
    );
};

/** The winner's trophy, with a shine and a star. */
const Trophy = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 72 72" aria-hidden className={className}>
        <path d="M22 14h-9a3 3 0 0 0-3 3c0 9 6 16 15 17M50 14h9a3 3 0 0 1 3 3c0 9-6 16-15 17" fill="none" stroke="#e0a400" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M20 8h32v14c0 11-7 19-16 19S20 33 20 22z" fill="#ffd25e" /><path d="M20 8h32v4H20z" fill="#e0a400" />
        <path d="M27 14v8c0 5 3 9 7 11" stroke="#fff" strokeOpacity="0.75" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M32 41h8v9h-8z" fill="#e0a400" /><rect x="22" y="50" width="28" height="9" rx="3" fill="#c78f00" /><rect x="18" y="58" width="36" height="7" rx="3" fill="#a87800" />
        <path d="M36 17l1.6 3.4 3.7.4-2.8 2.5.8 3.7-3.3-1.9-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z" fill="#fff" />
    </svg>
);

const Podium = ({ top, money }: { top: Entry[]; money: (n: number) => string }) => (
    <ol className="m-0 grid list-none grid-cols-3 items-end gap-2.5 p-0 sm:gap-4">
        {([1, 0, 2] as const).map((r) => {
            const x = top[r];
            const m = MEDAL[r];
            return (
                <li key={r} className="relative flex min-w-0 flex-col items-center text-center">
                    {r === 0 && <>
                        <Trophy className="mb-2 size-16 drop-shadow-[0_8px_12px_rgb(0_0_0/0.25)] sm:size-20" />
                        <span aria-hidden className="absolute top-2 left-[18%] size-1.5 rounded-full bg-pop-300" /><span aria-hidden className="absolute top-8 right-[16%] size-2 rotate-45 bg-white/80" /><span aria-hidden className="absolute top-0 right-[30%] size-1 rounded-full bg-white" />
                    </>}
                    {x ? (
                        <button type="button" onClick={x.open} disabled={!x.open} className={cx("flex flex-col items-center gap-1 rounded-2xl p-1 disabled:cursor-default", x.open && "cursor-pointer", ring)}>
                            <span className="relative">
                                <span className={cx("flex items-center justify-center rounded-full font-bold", r === 0 ? "size-[72px] bg-pop-300 text-xl text-brand-950" : "size-14 bg-white text-base text-brand-700")} style={{ boxShadow: `0 0 0 4px ${m.face}, 0 10px 20px -8px rgb(0 0 0 / 0.35)` }}>{initials(x.name) || "?"}</span>
                                <span className="absolute -right-4 -bottom-5 drop-shadow-[0_4px_6px_rgb(0_0_0/0.3)]"><Medal place={r} size={r === 0 ? 42 : 34} /></span>
                            </span>
                            <span className="mt-5 line-clamp-2 max-w-full text-[13px] leading-tight font-bold text-white sm:text-sm">{x.name}</span>
                            <span className="font-bubble text-base font-bold text-white tabular-nums sm:text-lg">{money(x.amount)}</span>
                        </button>
                    ) : <span className="flex h-24 items-end pb-2 text-sm text-white/50">Open spot</span>}
                    {/* The step: tallest for 1st, with a lip on top like a real podium. */}
                    <div className={cx("relative mt-2 flex w-full flex-col items-center justify-start rounded-t-[18px] pt-3", r === 0 ? "h-32 bg-white text-brand-600 shadow-xl shadow-brand-950/30" : r === 1 ? "h-24 bg-white/20 text-white" : "h-16 bg-white/12 text-white")}>
                        <span aria-hidden className={cx("absolute inset-x-0 top-0 h-2 rounded-t-[18px]", r === 0 ? "bg-pop-300" : "bg-white/25")} />
                        <span className="font-bubble text-[30px] leading-none font-bold sm:text-[36px]">{r + 1}</span>
                        <span className={cx("mt-1 text-[11px] font-semibold tracking-wide uppercase", r === 0 ? "text-brand-600/70" : "text-white/60")}>{m.label}</span>
                    </div>
                </li>
            );
        })}
    </ol>
);

const Rows = ({ list, from, money }: { list: Entry[]; from: number; money: (n: number) => string }) => (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">{list.map((x, i) => { const p = x.goal ? Math.min(100, Math.round((x.amount / Math.max(1, x.goal)) * 100)) : 0; return (
        <li key={x.id}><button type="button" onClick={x.open} disabled={!x.open} className={cx("flex w-full items-center gap-3.5 rounded-[20px] bg-white/10 p-3.5 pr-5 text-left text-white ring-1 ring-white/15 transition ring-inset disabled:cursor-default", x.open && "cursor-pointer hover:bg-white/15", ring)}>
            <span className="w-7 text-center font-bubble text-lg font-bold text-white/70 tabular-nums">{from + i}</span>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-brand-700">{initials(x.name) || "?"}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5"><span className="truncate text-[15px] font-bold">{x.name}</span>{x.goal ? <span className="h-1.5 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-white/80" style={{ width: `${Math.max(p, x.amount > 0 ? 3 : 0)}%` }} /></span> : x.note && <span className="text-xs text-white/60">{x.note}</span>}</span>
            <span className="flex flex-col items-end"><span className="font-bubble text-lg font-bold text-white tabular-nums">{money(x.amount)}</span>{x.goal ? <span className="text-xs text-white/60">{p}% of {money(x.goal)}</span> : null}</span>
        </button></li>
    ); })}</ol>
);

/**
 * Who is raising and giving most for a page. Campaigns rank their teams, fundraisers and supporters; a team ranks its
 * members and supporters; a single fundraiser ranks its supporters. Top three stand on a podium, the rest follow in a list.
 */
export const Leaderboard = ({ type, kids, donations, open, start, give }: { type: PageType; kids: Campaign[]; donations: Donation[]; open: (c: Campaign) => void; start: () => void; give: () => void }) => {
    const { money } = useApp();
    const toEntry = (c: Campaign): Entry => ({ id: c.id, name: c.title, amount: c.raised, goal: c.goal, open: () => open(c) });
    // Supporters: gifts added up per name, anonymous gifts kept apart.
    const byName = new Map<string, { amount: number; gifts: number }>();
    donations.forEach((d, i) => { const k = d.name === "Anonymous" ? `Anonymous·${i}` : d.name; const o = byName.get(k) ?? { amount: 0, gifts: 0 }; byName.set(k, { amount: o.amount + d.usd, gifts: o.gifts + 1 }); });
    const supporters: Entry[] = [...byName].map(([k, v]) => ({ id: k, name: k.split("·")[0], amount: v.amount, note: `${v.gifts} ${v.gifts === 1 ? "gift" : "gifts"}` })).sort((a, b) => b.amount - a.amount);
    const hasTeams = type === "campaign" || type === "challenge" || type === "event";
    const hasPeople = type !== "fundraiser" && type !== "memory";
    const tabs: [Tab, string, Entry[]][] = [
        ...(hasTeams ? [["teams", "Teams", kids.filter((x) => x.type === "team").map(toEntry)] as [Tab, string, Entry[]]] : []),
        ...(hasPeople ? [[type === "team" ? "members" : "fundraisers", type === "team" ? "Members" : "Fundraisers", kids.filter((x) => x.type !== "team").map(toEntry)] as [Tab, string, Entry[]]] : []),
        ["supporters", "Supporters", supporters],
    ];
    const [tab, setTab] = useState<Tab>(() => (tabs.find(([, , list]) => list.length) ?? tabs[0])[0]);
    const [, label, list] = tabs.find(([id]) => id === tab) ?? tabs[0];
    const empty: Record<Tab, [string, string, string, () => void]> = {
        teams: ["No teams yet", "Teams raise together and race for the top spot.", "Start a team", start],
        members: ["No members yet", "Team members raise on their own pages and it all adds up here.", "Join the team", start],
        fundraisers: ["No fundraisers yet", "Anyone can start a page that raises for this one.", "Start a fundraiser", start],
        supporters: ["No supporters yet", "The biggest givers show up here.", "Be the first to give", give],
    };
    const [title, sub, cta, act] = empty[tab];
    return (
        <section className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-end gap-3"><h2 className="m-0 text-[26px] leading-tight font-extrabold tracking-[-0.035em] text-white">Leaderboard</h2><span aria-hidden className="font-hand -rotate-3 pb-0.5 text-2xl leading-none text-pop-300">who's leading</span></div>
                {tabs.length > 1 && <div role="tablist" aria-label="Leaderboard" className="flex items-center gap-1 rounded-full bg-white/12 p-1 ring-1 ring-white/25 ring-inset">
                    {tabs.map(([id, name, l]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cx("h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold transition", ring, tab === id ? "bg-white text-brand-700 shadow-[0_2px_0_rgb(0_0_0/0.12)]" : "text-white/80 hover:text-white")}>{name} <span className="tabular-nums opacity-70">{l.length}</span></button>)}
                </div>}
            </div>
            {list.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-[28px] border-2 border-dashed border-white/25 px-6 py-9 text-center">
                    <Trophy className="size-14 opacity-90" />
                    <p className="m-0 mt-1 text-[17px] font-bold text-white">{title}</p>
                    <p className="m-0 max-w-sm text-[15px] text-white/75">{sub} <button type="button" onClick={act} className="cursor-pointer font-semibold text-pop-300 underline underline-offset-4">{cta}</button>.</p>
                </div>
            ) : <div role="tabpanel" aria-label={label} className="flex flex-col gap-4"><Podium top={list.slice(0, 3)} money={money} />{list.length > 3 && <Rows list={list.slice(3)} from={4} money={money} />}</div>}
        </section>
    );
};

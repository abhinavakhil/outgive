import type { Post } from "../posts";
import { A, Note, Table } from "./kit";

export const teamIdeas: Post = {
    slug: "team-fundraising-ideas",
    title: "20 team fundraising ideas for schools, companies and clubs",
    description: "Team fundraising ideas that use friendly competition: class races, department challenges, step and mile challenges, matching and leaderboards. With the research on why teams out-raise individuals and how to run one fairly.",
    audience: "fundraisers",
    published: "2026-11-06",
    updated: "2026-11-06",
    minutes: 6,
    answer: "The best team fundraising ideas give each team a clear target, a visible score and a deadline: class against class, department against department, or a step or mile challenge where every unit is sponsored. Teams reliably raise more than people fundraising alone. Keep the competition friendly with more than one way to win, an anonymous option, and celebration of every team, not just the winner.",
    takeaways: [
        "Teams raise more. In a Blackbaud analysis, team captains raised nearly three times as much as individual participants, and DonorDrive data reported by AFP found each team raised about 10 times what an individual participant did.",
        "Team members are also more likely to reach their personal minimum: 80.2% against 63.0% for non-team fundraisers, in Haku's data.",
        "A live leaderboard turns a fundraiser into a game: people check it, share it, and give to move up.",
        "Reward more than the biggest total: most donors recruited, most improved, longest streak.",
        "Use a short window, such as a week, a month or one event day, with a reset or a final count people can plan around.",
    ],
    body: (
        <>
            <p>
                Friendly competition is one of the oldest fundraising tools there is, and it works online too. Below are 20 ideas grouped by setting, plus what the research says about why teams out-raise individuals, and how to keep the competition friendly.
            </p>

            <h2>Why do teams raise more than individuals?</h2>
            <Table
                head={["Finding", "Source"]}
                rows={[
                    ["Team captains raised nearly 3x as much as individual participants or team members", <A key="b" href="https://webfiles-sc1.blackbaud.com/files/resources/downloads/whitepaper_donorcentrics.p2p.fundraisingbenchmarkinginsights.pdf">Blackbaud, peer-to-peer benchmarking insights</A>],
                    ["Each team raised about 10x as much as an individual participant (2018 data)", <A key="a" href="https://afpglobal.org/peer-peer-fundraising-success-starts-teams-retention-and-diy">DonorDrive report, via AFP</A>],
                    ["Team members met their fundraising minimum 80.2% of the time, against 63.0% for non-team fundraisers", <A key="h" href="https://www.hakuapp.com/resource/your-first-time-peer-to-peer-fundraisers-are-underperforming">Haku</A>],
                ]}
            />
            <p>
                The reasons are human. A team gives you accountability (people are counting on you), reach (each member brings a different network), and a story to share ("our class is second, help us catch up"). The common thread in these studies is the <strong>team captain</strong>. Recruiting a few motivated captains matters more than the total number of participants.
            </p>

            <h2>Team fundraising ideas for schools</h2>
            <ol>
                <li><strong>Class against class.</strong> Each class has its own page and its spot on a leaderboard shown in assembly or on the school website. The winning class gets a pizza party or picks a teacher's forfeit.</li>
                <li><strong>House points race.</strong> Every gift adds points to a house. It works for schools that already have houses or teams.</li>
                <li><strong>Read-a-thon.</strong> Students get sponsored per book or per hour read. Track books read and money raised side by side.</li>
                <li><strong>Teacher challenge.</strong> Each teacher's page has a goal; if it's hit, they do something memorable (dye their hair, sing at assembly).</li>
                <li><strong>Year group against alumni.</strong> Current students take on graduates of their year, which brings former families back into the school.</li>
            </ol>

            <h2>Team fundraising ideas for companies</h2>
            <ol start={6}>
                <li><strong>Department race.</strong> Sales against engineering against finance, with a live leaderboard on the office screens for a week.</li>
                <li><strong>Step or mile challenge.</strong> Teams log steps, miles run or kilometers cycled, and colleagues sponsor them per unit.</li>
                <li><strong>Company match.</strong> The company matches every employee gift up to a cap, and the department that unlocks the most of the match wins.</li>
                <li><strong>Office versus office.</strong> For companies with several sites or countries: one board, one deadline, one trophy.</li>
                <li><strong>Lunch-skip day.</strong> Everyone gives what they'd spend on lunch; the board shows which team "skipped" the most.</li>
                <li><strong>Client challenge.</strong> Invite customers or partners to form teams and compete with yours. It builds goodwill and expands reach.</li>
            </ol>

            <h2>Team fundraising ideas for clubs and sports teams</h2>
            <ol start={12}>
                <li><strong>Per-goal or per-point pledges.</strong> Supporters pledge an amount per goal, try or point scored across a season.</li>
                <li><strong>Tournament with a giving table.</strong> Entry fees plus a leaderboard of teams' fundraising, so the winners on the field and the winners on the board are both celebrated.</li>
                <li><strong>Distance relay.</strong> A team covers a long distance together, such as the miles between two cities, with each leg sponsored.</li>
                <li><strong>Veterans against juniors.</strong> Different generations of the club go head-to-head.</li>
            </ol>

            <h2>Team fundraising ideas for friends and families</h2>
            <ol start={16}>
                <li><strong>Birthday team.</strong> Instead of gifts, friends form a team to hit a target for a charity you choose.</li>
                <li><strong>30-day challenge.</strong> A team commits to something daily (a cold swim, 10,000 steps, no takeaway) and posts progress.</li>
                <li><strong>Virtual 5K.</strong> Everyone runs their own route on the same weekend and the team totals their sponsorship.</li>
                <li><strong>In memory team.</strong> Family and friends fundraise together in someone's name, with a shared page of memories.</li>
                <li><strong>Live event night.</strong> A quiz, gala or concert where the team totals go up on the big screen in real time, and people give from their phones by scanning a QR code.</li>
            </ol>

            <h2>How do you run a team fundraiser that stays friendly?</h2>
            <ul>
                <li><strong>Recruit captains first.</strong> Each captain recruits their team and owns its page. Give captains a short kit: the story, a sample message, the deadline.</li>
                <li><strong>Make the score visible.</strong> A leaderboard people can check on their phone or see on a screen is the engine of the whole thing. Update it live.</li>
                <li><strong>Have more than one way to win.</strong> Most money raised, most donors recruited, highest share of team members who gave, biggest improvement on last year. Small teams and less wealthy communities can then still win something.</li>
                <li><strong>Allow anonymous giving.</strong> Some people want to give without their name on a board. Their gift should still count toward their team.</li>
                <li><strong>Use short rounds.</strong> A daily or weekly board that resets gives everyone a fresh chance and a reason to come back; an all-time board recognizes the long haul.</li>
                <li><strong>Celebrate everyone.</strong> Finish with a thank-you that names every team and the total impact, not just the winner.</li>
            </ul>

            <Note title="Where Outgive fits">
                <p>
                    Outgive is a fundraising platform for charities built around this idea. It has live leaderboards where supporters give to take a rank, team, company and school races, daily, weekly and all-time boards, anonymous giving that still counts toward a team, and live screens for events with a scan-to-give QR code. It's free for charities and launching soon. <a href="/#join">Join the waitlist</a>.
                </p>
            </Note>

            <p>
                If you're starting from scratch, read <a href="/blog/how-to-start-an-online-fundraiser">how to start an online fundraiser</a> first. If you're a charity planning a December campaign, see our <a href="/blog/giving-tuesday-2026-plan">GivingTuesday 2026 plan</a>.
            </p>
        </>
    ),
    faq: [
        ["What is a team fundraiser?", "A fundraiser where a group of people each raise money on their own pages, and their totals roll up into a shared team total, often competing with other teams toward one campaign goal."],
        ["What is the difference between peer-to-peer and team fundraising?", "Peer-to-peer fundraising means supporters raise money from their own networks on behalf of a cause. Team fundraising is peer-to-peer with groups: individual pages are combined into team totals, often with a leaderboard between teams."],
        ["What are the best fundraising ideas for schools?", "Class against class, house points races, read-a-thons and teacher challenges all work well, because they give students a team to belong to and a score they can see move."],
        ["How do you keep fundraising competition friendly?", "Reward more than the biggest total, let people give anonymously, keep rounds short, and thank every team at the end. The aim is energy, not pressure."],
        ["How many people should be on a fundraising team?", "There's no magic number. Blackbaud's research found that adding more team members doesn't necessarily raise more. A committed captain and a handful of active members usually beat a large, passive team."],
    ],
    sources: [
        ["Blackbaud: peer-to-peer fundraising benchmarking insights (DonorCentrics)", "https://webfiles-sc1.blackbaud.com/files/resources/downloads/whitepaper_donorcentrics.p2p.fundraisingbenchmarkinginsights.pdf"],
        ["Blackbaud: 2014 peer-to-peer fundraising study", "https://webfiles-sc1.blackbaud.com/files/resources/2014-peer-to-peer-fundraising-study.pdf"],
        ["AFP: peer-to-peer fundraising success starts with teams, retention and DIY", "https://afpglobal.org/peer-peer-fundraising-success-starts-teams-retention-and-diy"],
        ["Haku: your first-time peer-to-peer fundraisers are underperforming", "https://www.hakuapp.com/resource/your-first-time-peer-to-peer-fundraisers-are-underperforming"],
        ["GoFundMe: team fundraising tips", "https://www.gofundme.com/c/fundraising-tips/team"],
    ],
};

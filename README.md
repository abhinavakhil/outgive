# Outgive

A white-label leaderboard for a charity. Supporters hold ranks by what they have given to the charity, and anyone can
take a rank by giving more than the person above them. Seeing your own name on the board, and exactly what it takes to
climb, is what makes people give again.

![Outgive demo: switching layouts, applying a charity's branding, claiming #1](docs/demo.gif)

Also included: a seven-step create flow (fundraiser, campaign, team, challenge, event, in memory) and 12 page layouts.
Every gift to a fundraising page counts toward that page's rank on the board.

Built with React 19, Vite, Tailwind CSS v4 and the open-source Untitled UI React components.

## Run it

    npm install
    npm run dev      # local dev server
    npm run build    # production build in dist/

## White label

Press **Your branding** on the leaderboard to see the board as your own charity: name, tagline, logo, brand colour,
font and default ranking layout. Four example charities are one click away. The colour you pick is turned into the
full brand scale (`src/brand.ts`), so buttons, tints, rank highlights and dark mode all follow it. The brand is kept
in `localStorage` and nothing leaves the browser.

## Three ranking layouts

- **List**: one row per supporter, the top three tinted.
- **Podium**: the top three on a stand (2, 1, 3), the rest as rows.
- **Race**: every row is a bar relative to #1, so the gap to the next rank is visible at a glance.

After you claim a rank, your row is marked **You** and scrolled into view in whichever layout is on.

## Where things are

- `src/App.tsx`: view switching and shared state (currency, brand, the board, published pages)
- `src/brand.ts`: turns one hex colour and a font into the CSS variables the whole app uses
- `src/views/Leaderboard.tsx`: the ranking in three layouts, the claim dialog, filters
- `src/components/outgive/BrandPanel.tsx`: the "see it with your branding" dialog
- `src/views/CreateFlow.tsx`: the seven steps, live preview and the published screen
- `src/views/CampaignPage.tsx`: the 12 layouts and the layout switcher
- `src/views/Info.tsx`: About, Rules, FAQ
- `src/components/outgive/shared.tsx`: brand logo, donate card, boards, layout thumbnails
- `src/data.ts`: supporters, kinds, currencies, brand presets, page types, layouts
- `src/styles/outgive.css`: Poppins and the brand scale that replaces Untitled UI's default purple

## Untitled UI

`src/components/{base,application,foundations,...}`, `src/hooks`, `src/utils` and `src/styles` are copied from
https://github.com/untitleduico/react (MIT; licence in `src/components/UNTITLED-UI-LICENSE`), with stories and demos removed.
Only the components the app imports end up in the build. Some unused component files need extra packages
(charts, carousel, date picker and so on) that are not installed; add them if you start using those components.

One change was made to the copied source: in `src/components/base/select/select-native.tsx` the select only sets
`aria-labelledby` when a visible label is rendered, so an `aria-label` passed by the caller is respected.

## What is not real yet

- All supporters, people and amounts are fictional sample data, held in `localStorage`.
- No payments, accounts, uploads or charity verification. The claim dialog and donate buttons only update the screen.
- Currency rates in `src/data.ts` are fixed placeholder values.
- A logo is stored as a data URL in `localStorage`, so it is capped at 400 KB in this demo.

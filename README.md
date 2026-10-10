# Outgive

A leaderboard where charities hold ranks by what has been given in their name, plus a seven-step create flow
(fundraiser, campaign, team, challenge, event, in memory) and 12 page layouts.

Built with React 19, Vite, Tailwind CSS v4 and the open-source Untitled UI React components.

## Run it

    npm install
    npm run dev      # local dev server
    npm run build    # production build in dist/

## Where things are

- `src/App.tsx`: view switching and shared state (currency, the published page)
- `src/views/Leaderboard.tsx`: the ranking, claim dialog, filters
- `src/views/CreateFlow.tsx`: the seven steps, live preview and the published screen
- `src/views/CampaignPage.tsx`: the 12 layouts and the layout switcher
- `src/views/Info.tsx`: About, Rules, FAQ
- `src/components/outgive/shared.tsx`: logo, donate card, boards, layout thumbnails
- `src/data.ts`: causes, currencies, page types, layouts and the fictional sample charities
- `src/styles/outgive.css`: the coral brand scale that replaces Untitled UI's default purple

## Untitled UI

`src/components/{base,application,foundations,...}`, `src/hooks`, `src/utils` and `src/styles` are copied from
https://github.com/untitleduico/react (MIT; licence in `src/components/UNTITLED-UI-LICENSE`), with stories and demos removed.
Only the components the app imports end up in the build. Some unused component files need extra packages
(charts, carousel, date picker and so on) that are not installed; add them if you start using those components.

One change was made to the copied source: in `src/components/base/select/select-native.tsx` the select only sets
`aria-labelledby` when a visible label is rendered, so an `aria-label` passed by the caller is respected.

## What is not real yet

- All charities, people and amounts are fictional sample data, held in memory. Nothing is saved after a reload.
- No payments, accounts, uploads or charity verification. The claim dialog and donate buttons only update the screen.
- Currency rates in `src/data.ts` are fixed placeholder values.

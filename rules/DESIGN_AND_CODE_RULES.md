# Design & Code Rules — NER Landslide Watch
*Paste the "Guardrail Prompt" section into Antigravity before any new feature request. This whole file is short on purpose — a long rules doc gets ignored, a short one gets followed.*

## 1. Palette (refined, not replaced)

Your mint-green Stitch look had one real problem worth fixing: your brand color and your "safe/normal" status color were the same green. That means a green button and a green "this zone is fine" badge look identical — confusing in a screen people may be scanning fast during an actual alert.

Fix: two distinct greens, used in different contexts, never mixed.

| Token | Value | Used for |
|---|---|---|
| `brand` | `#0F766E` (teal-700) | Nav, logo, primary buttons, links — chrome only |
| `status-normal` | `#22C55E` (green-500) | Risk badges/markers ONLY — never on buttons or nav |
| `status-medium` | `#F59E0B` (amber-500) | Risk badges/markers |
| `status-high` | `#F97316` (orange-500) | Risk badges/markers |
| `status-severe` | `#DC2626` (red-600) | Risk badges/markers |
| `bg` | `#F8FAFC` (slate-50) | Page background |
| `surface` | `#FFFFFF` | Cards |
| `border` | `#E2E8F0` (slate-200) | Card/input borders |
| `text` | `#1E293B` (slate-800) | Primary text |
| `text-muted` | `#64748B` (slate-500) | Secondary text, timestamps |

**Rule: if it's a risk indicator, it uses a `status-*` colour. If it's UI chrome (button, nav, logo), it uses `brand`. Never the reverse.**

Add these as Tailwind theme colours (`tailwind.config.js`) so every component references `bg-status-severe` etc. instead of raw hex — one place to change if you ever adjust the palette.

## 2. Typography, spacing, radius — don't invent, use the defaults

- **Font:** Inter (one font, both weights 500/600 for headings, 400 for body). Don't add a second display font.
- **Spacing:** Tailwind's default scale only (`p-2`, `p-4`, `p-6`...). Don't invent custom pixel values.
- **Radius:** `rounded-lg` for cards/buttons/inputs, `rounded-full` for badges and avatars only. Pick one and stop deciding it per-component.
- **Shadows:** `shadow-sm` for cards, nothing heavier. A disaster dashboard should read as calm and legible, not flashy.

## 3. Component library — adopt shadcn/ui now, mid-project is fine

You're currently hand-rolling every button/card/badge in raw Tailwind, which is a real source of the bloat you're seeing — every new component reinvents slightly different class combinations. shadcn/ui isn't a dependency you install; its CLI copies small component source files straight into your project, so it adds no bundle weight and works with your existing Tailwind setup. You can add it incrementally, page by page — it won't force a rewrite of what's already working.

```bash
npx shadcn@latest init
npx shadcn@latest add button card badge dialog input select checkbox tabs sonner skeleton
```

From now on: **any button, card, badge, form input, or toast uses the shadcn primitive, not a hand-written Tailwind div.** This alone will cut a meaningful chunk of the "elaboration" you're seeing, because Antigravity stops inventing new markup for things that already exist.

## 4. Locked library list — nothing outside this list without asking first

| Purpose | Library |
|---|---|
| Framework | React + Vite |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Icons | lucide-react |
| Maps | react-leaflet + leaflet |
| Geospatial math | @turf/turf |
| Backend | @supabase/supabase-js |
| Forms + validation | react-hook-form + zod |
| Toasts | sonner (comes with shadcn) |
| Charts (only if/when needed) | recharts |
| Routing | react-router-dom |

If Antigravity proposes installing anything not on this list, that's your signal to stop and ask "why isn't an existing tool enough?" before accepting.

## 5. Codebase minimalism rules

**Folder structure — fixed, don't let it drift per feature:**
```
src/
  components/       shared reusable pieces (ZoneCard, RiskBadge, MapView)
  components/ui/    shadcn-generated primitives — don't hand-edit these much
  pages/            OfficerDashboard, CitizenReport, ZoneTable, ReportsQueue
  lib/              supabase.js client, the safety-score formula, helpers
  hooks/            only if a hook is actually reused in 2+ places
```

**Hard rules:**
- A component file over ~150 lines is doing too much — split it by responsibility, not "in case we need it later."
- No Redux/Zustand/MobX. `useState` + one optional React Context (for `risk_zones` data shared across pages) is enough for an app this size.
- No test suite, no CI setup — not worth the time for a hackathon build.
- No "service layer" or repository-pattern abstraction over Supabase. A thin `lib/supabase.js` with the client + a few plain functions is enough.
- One shared `<RiskBadge tier="severe" />` component used everywhere a severity shows up (map markers, zone cards, table rows, alerts) — not five slightly different re-implementations of the same colored dot.

## 6. Guardrail prompt — paste this before any new feature request

```
Before making changes: only touch files directly needed for this feature.
Do not install new dependencies — our locked library list (see
DESIGN_AND_CODE_RULES.md) already covers this app. If you genuinely think we
need something new, ask me first instead of installing it. Do not create new
abstraction layers, wrapper utilities, or config files unless they're used
immediately by this feature. Prefer editing an existing component over
creating a new one if a close fit already exists. Keep components under
~150 lines — if a change would push a file past that, split it by
responsibility.
```

**Run this periodically (every day or two) as a cleanup pass:**
```
Do a cleanup pass on [page/folder]. Remove unused imports, unused variables,
and dead code. If two components are doing near-identical things, merge them
into one with a prop for the difference. Don't change any functionality,
only remove or consolidate.
```

## 7. Frontend polish suggestions (small effort, real payoff)

- Build the shared `RiskBadge` component first, today — every other screen (map, zone table, alerts, reports queue) reuses it, which is both less code and instantly consistent.
- Skeleton loaders (shadcn's `Skeleton`) for the zone list and map while data loads — cheap, reads as far more polished than a blank screen or spinner.
- Sonner toast for citizen report submission errors specifically (network failure, missing photo) — your success page is good UX, keep it, just make sure failures don't silently look like success.
- A subtle pulse animation on the "● Live" badge on the map (a few lines of CSS) — small detail, judges notice it.
- Empty state copy for zero-reports/zero-alerts states ("No active alerts right now" with a calm icon) instead of a blank card — a genuinely empty disaster dashboard shouldn't look broken.

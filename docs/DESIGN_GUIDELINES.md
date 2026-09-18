# Design Guidelines — Admin Dashboard

Distilled from the dashboard refactor (`🚧 WIP` — tabbed event detail page,
`🚧 WIP 2` — dashboard-wide revamp) and the follow-up iterations on top.
This is the visual and structural language every page inside the sidebar
layout (`AppLayout`) should follow.

## 0. Styled components, not inline class strings

The patterns below are implemented once as shared **styled components** in
`client/src/components/ui/layout.tsx` (plus `CapacityBar`/`CapacityFill` in
`components/ui/capacity-bar.tsx`). Pages compose these components — they
never copy the underlying Tailwind class strings.

```tsx
import {
  AdminPageShell,
  AdminPageBody,
  AdminPageCenter,
  AdminHeader,
  AdminTabsList,
  AdminTabsTrigger,
  DataCard,
  DataCardHeader,
  DataCardTitle,
  DataCardContent,
  DataCardDivider,
} from "@/components/ui/layout"
```

Rules:

- If a class string from this doc already has a component, use the
  component. Do not paste the raw classes into a new page.
- If a new pattern repeats 3+ times, promote it to `layout.tsx` (or a
  colocated `ui/` primitive) and document it here instead of copying it.
- Per-instance tweaks still go through `className` (merged with
  `tailwind-merge` via `cn`), never by forking the component.
- Dynamic values that Tailwind can't express (e.g. progress-bar widths)
  live inside exactly one encapsulated component (`CapacityFill`) — pages
  must not use `style={{ ... }}` for them.

## 1. Page shell

Pages render full-bleed inside `AppLayout`'s padded `<main>`, then re-center
their own content:

```tsx
<AdminPageShell>
  {/* header band, then content */}
  <AdminPageBody>
    <AdminPageCenter>{/* cards */}</AdminPageCenter>
  </AdminPageBody>
</AdminPageShell>
```

- The shell's negative margins cancel `main`'s `p-4 md:p-6` so header bands
  reach the viewport edges. Content always comes back to `mx-auto max-w-5xl`.
- The legacy `Card shell-admin` page wrapper is retired — do not use it for
  new pages.

## 2. Page headers: information only, no buttons

Every page opens with a green header band. Use `AdminHeader` (or
`AdminHeaderBand` + title parts when tabs/actions need custom placement):

```tsx
<AdminHeader
  title="Title"
  subtitle="One-line subtitle."
  eyebrow="Created Jan 5, 2026" // optional
  meta={<MetaRow>…</MetaRow>} // optional
  actions={<Button size="sm">…</Button>} // optional, see exceptions below
/>
```

Title block conventions, in order:

1. Optional eyebrow (`AdminHeaderEyebrow`, e.g. `Created Jan 5, 2026`).
2. Title (`AdminHeaderTitle`, never truncate a title).
3. Subtitle (`AdminHeaderSubtitle`) — one line describing the page.
4. Optional `MetaRow` lines (e.g. location with a `MapPin` icon).

**Buttons do not live in headers.** The single exception: one button may sit
top-right if the action belongs nowhere else on the page or must always be
available without digging through tabs. Current examples:

- Dashboard → `New Event` (creation has no other home; the sidebar entry is
  hidden on mobile).
- Create/Edit event → `Cancel` + `Create Event` / `Save Changes` (a form
  spanning tabs needs an always-visible submit).

Everything else (edit, delete, copy, export) lives in tab content.

Band bottom spacing depends on what follows — pass `withTabs` when a tab
strip lives inside the band:

- Page with tabs: `<AdminHeaderBand withTabs>` + `<AdminTabsList>`, then
  `<Separator />`.
- Page without tabs: plain `<AdminHeader>` (padded band), then
  `<Separator />`.

## 3. Tabs

- Line variant only: `<AdminTabsList>` with `<AdminTabsTrigger>` children
  (the shared trigger styling lives inside `AdminTabsTrigger`):

```tsx
<AdminTabsList>
  <AdminTabsTrigger value="overview">Overview</AdminTabsTrigger>
</AdminTabsList>
```

- Tab labels are plain nouns: `Overview`, `Signups`, `Invites`,
  `Settings`, `List`, `Calendar`, `Recent`, `Outbox`.
- Uncontrolled (`defaultValue`) is fine unless code must switch tabs
  programmatically — then go controlled (`value`/`onValueChange`). Known
  triggers for controlled tabs: jumping to the tab that holds a validation
  error (create/edit event), or falling back when a tab disappears.
- Each `TabsContent` wraps its own padded, centered container (see §1), so
  every tab has identical page margins.

## 4. Cards

One card = one topic. Anatomy:

```tsx
<DataCard>
  <DataCardHeader>
    <DataCardTitle
      icon={Info}
      actions={<Badge variant="secondary">3 slots</Badge>}
    >
      Card title
    </DataCardTitle>
  </DataCardHeader>
  <DataCardDivider />
  <DataCardContent>{/* body */}</DataCardContent>
</DataCard>
```

Rules:

- Spacing comes from the header/content components, not the card default.
- Pick a title icon that names the topic (`Info`, `Clock`, `ListChecks`,
  `Users`, `CalendarDays`, `ChartColumn`, `Activity`, `Mail`, `BarChart3`,
  `Wrench` for management actions).
- The header's right side (`actions`, alone or combined): a search input,
  action buttons, and/or count/status badges. Keep it to one row that wraps
  gracefully on narrow screens.
- **Search inputs in card headers** use `<CardSearchInput>` (mobile
  `Search...` placeholder + full desktop label, e.g. `Search signups...`,
  with built-in clear button).
- Statistic/emphasis numbers use `<StatBlock>` / `<StatCard>` (see
  SuperAdmin stat cards, signup progress).

## 5. Tabular data: rows separated by lines, never nested cards

Tabular data (slots, signups, invites, groups, outbox rows) is **not**
rendered as cards-in-cards. Structure per card:

1. Card header (title + optional search/actions, §4).
2. `<Separator />`.
3. Rows, each separated by a bottom border; the last row has none.

Row mechanics for full-bleed dividers (use `variant="rows"` content so
dividers bleed to the card edges):

```tsx
<DataCardContent variant="rows">
  <DataRowList>
    {rows.map((row) => (
      <DataRow key={row.id}>…</DataRow>
    ))}
  </DataRowList>
</DataCardContent>
```

- Desktop tables go in `<TableBleed>` (raw `<table>` or the `Table`
  component with horizontal scroll for tables that can't sensibly stack,
  e.g. SuperAdmin, outbox); stacked mobile lists go in `<MobileRowList>`
  (`md:hidden`).
- Row internals: `<RowPrimary>` / `<RowSecondary>`, status/count as `Badge`
  (`destructive` for full/negative states, `secondary`/`default`
  otherwise), icon-only row actions via `<RowIconButton>` (`ghost`,
  destructive hover for removals). Icon-only buttons (`Button`
  `size="icon"` / `"icon-sm"`, `RowIconButton`) grow to ≈44px on coarse
  pointers (`pointer-coarse:size-11`); buttons constrained inside an
  input keep their box and get invisible `::before` hit-expansion
  instead — desktop density stays pixel-identical either way.
- Empty/loading/error states render as centered `py-8` (or `py-3` for inline
  sections) text inside the same content area — never a separate card.

## 6. Adding rows: header button or ghost row, always a popup

A tabular list gains an add-row affordance in exactly one of two places:

- **A button in the card header** (via `DataCardTitle actions`), or
- **A "ghost" footer row** at the end of the data — `<GhostAddRow>`, a
  full-width muted button that looks like one more row:

```tsx
<GhostAddRow onClick={addRow}>Add slot</GhostAddRow>
```

- The ghost row sits directly after the last data row (`last:border-0` on
  rows + `border-t` on the footer = exactly one divider) and is still shown
  for empty lists so creation is always one tap away (groups, invites).
- Either affordance opens a **popup** (`Dialog`), never inline editing or a
  page navigation. The dialog holds a `stack-md` form of `field-stack`
  fields, reuses the same validation helpers as the full-page forms
  (`validateSlotBasics`, …), shows failures as inline `field-error` text,
  confirms with toast + query invalidation, and **resets its state on every
  close path** (submit, cancel, overlay, Escape) so reopening starts blank.
- After creation, select/reveal the new row when there is a selection model
  (new timeslot becomes the selected slot and clears the slot filter).

### CRUD homes: operational vs. setup objects

Decide one home per object type and offer the full add/edit/delete set
there — asymmetric CRUD (add here, edit somewhere else) teaches an
expectation and then dead-ends the user.

- **Operational objects are managed where they're viewed.** Slots and
  signups live on the event detail page's Signups tab: per-row
  Pencil/Trash2 actions next to the `+` button, each opening the same
  dialog/confirm patterns as creation. Edit reuses the creation dialog
  prefilled (capacity floor = active signup count, mirroring the backend
  guard); delete confirms with the signup impact
  (`"«label»" has N active signup(s), which will be removed with the slot`)
  and never promises participant emails the backend doesn't send.
- **Setup objects are managed on create/edit pages.** Event fields and
  signup questions (with their type-lock and answer-preservation rules)
  need full form context and stay out of the detail page.
- **One edit path per object.** Creation and edit dialogs share one form
  component and validation helper so two edit UIs can't diverge
  (`SlotDialog` in create/edit modes).

## 7. Forms

### 7a. One form may span multiple tabs

Create/edit event wrap the whole `<Tabs>` in a single `<form>` so header
submit works from any tab:

```tsx
<form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
  <Tabs …>…</Tabs>
</form>
```

Consequences, all handled and to be preserved:

- Inactive `TabsContent` unmounts, so native `required` validation silently
  skips hidden tabs — **validate required fields by hand** in `handleSubmit`
  (event title is checked explicitly for this reason).
- On failure, **switch to the tab holding the error** (bad slots → Slots,
  bad questions → Settings, title/group/date → Overview) alongside the
  error toast.
- Destructive per-row states (slots/questions marked for deletion on edit)
  render as plain dimmed divider rows with an Undo button, not boxes.

### 7b. Field conventions

- Required fields get a red `*` via `<RequiredStar />`; optional fields are
  bare — no `(optional)` suffixes anywhere.
- Because `Label` is `display:flex` with `gap-2`, the star must sit inside a
  **single inner span** with the label text, or flex gap adds visible space:

```tsx
<Label htmlFor="title">
  <span>
    Event Title <RequiredStar />
  </span>
</Label>
```

- Labels and inputs use base sizing everywhere (`text-sm` labels, `h-9`
  inputs, `text-base md:text-sm` input text). No `text-xs` field labels or
  `h-8` form inputs — the one exception is muted inline toggle captions
  (`Allow waitlist when full`, `Required`), which stay `text-xs
text-muted-foreground` as helper text, not labels.
- Use full words on labels (`Capacity`, never `Cap`).
- Dialog forms (groups, add-slot) follow the same label/required/validation
  conventions as page forms.

## 8. Feedback and destructive actions

- Success/failure via `sonner` `toast`; API errors through
  `formatApiError(err, fallback)`. Some endpoints return machine `code`s
  (e.g. `duplicate_pending`, `group_has_events`) for client branching —
  surface those as explanatory UI (blocked-delete dialog), not raw errors.
- Destructive actions always confirm via `ConfirmDialog`
  (`variant="destructive"`, explicit `confirmLabel`, `isLoading` state),
  colocated with the button that triggers them (the Manage event card owns
  the delete-event dialog).
- Counts and statuses are `Badge`s next to what they describe, including in
  card headers (`3 slots`, `12/20`, `Active`, `2 waiting`).

## 9. Responsive rules

- `sm` (≈640px) is the main breakpoint: header action clusters, desktop
  tables, and side-by-side panes switch here.
- Never let tabular content push the viewport: tables get `overflow-x-auto`
  with edge-bleed cell padding, the week calendar scrolls inside
  `min-w-[840px]` columns, and slot rows wrap (`flex-wrap`).
- Prefer content-level actions (Overview cards, ghost footer rows) over a
  separate mobile action menu — the header `···` dropdown is a last resort
  that duplicates action paths per breakpoint.

## 10. Global type scale

All sizing is `rem`-based, so the single global lever is the root font size
(`client/src/index.css`):

```css
html {
  font-size: 112.5%; /* ≈18px at default browser settings */
}
```

Percentages (not `px`) keep respecting user browser settings. Tune this one
number to shift the whole app's type — currently one step up from default
(112.5%, previously 106.25%).

## 11. Page map (where the patterns live)

| Page              | Header                                                              | Tabs                                       | Notes                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard         | info + single `New Event` button (§2 exception)                     | List / Calendar                            | List items are compact cards; calendar nav lives in a card header, grid scrolls on mobile                                                                                                                                              |
| Event detail      | identity + invite copy card; trimmed mobile menu (copy/export only) | Overview / Signups / Invites / Settings | Manage event card (Edit/Delete) at the end of Overview; Signups is a two-pane slot list + roster with per-row slot edit/delete and a green `+` opening `SlotDialog` (create/edit modes); past events disable all structural actions |
| Groups            | info only                                                           | none                                       | Search in card header; desktop table / mobile stacked list; `New group` ghost footer row → dialog                                                                                                                                      |
| Create/Edit event | info + Cancel + Create/Save (§2 + §7a)                              | Overview / Slots / Settings                | Details card on Overview; slots and questions as divider-separated sections (§5) with ghost add-rows; questions live under Settings for now                                                                                            |
| Reports           | info only                                                           | none                                       | Single card with centered coming-soon empty state                                                                                                                                                                                      |
| SuperAdmin        | info only                                                           | Overview / Recent / Outbox                 | Stat cards, status card, activity chart; tables reuse the bleed pattern; controlled tabs                                                                                                                                               |

## 12. Quick checklist for new pages

1. `AdminPageShell` + `AdminHeader` (info-only) + `AdminPageBody` /
   `AdminPageCenter`.
2. Tabs only if the page has ≥2 topics; `AdminTabsList` +
   `AdminTabsTrigger`.
3. One `DataCard` per topic: `DataCardHeader` + `DataCardTitle icon={…}` +
   `DataCardDivider` + `DataCardContent`.
4. Tabular data as `DataRowList`/`DataRow` (or `TableBleed` +
   `MobileRowList`) inside `variant="rows"` content — no nested cards.
5. Search in the card header via `CardSearchInput`; actions/badges via
   `DataCardTitle actions`.
6. Add-row via header button or `<GhostAddRow>` → validating `Dialog`
   that resets on all close paths.
7. Required `<RequiredStar />` (nested span), no `(optional)`, base
   label/input sizes, full-word labels.
8. Toasts for outcomes, `ConfirmDialog` for destruction, badges for counts.
9. Same layout mobile and desktop; scroll or stack instead of squeezing.

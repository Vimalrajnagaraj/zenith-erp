# Customers — Delta Corrections (Components)

Differences only between the built page (`Customers_Page_1st.png`) and the original mockup (`Customers_original.png`). Anything not listed here already matches.

**Measurement basis**
- The mockup PNG (1115×631) is a downscaled 1920-wide frame. Every mockup measurement is multiplied by **1.72** so it lines up with the built capture (1917×915). All px values below are in **capture pixels**. If the build was captured at an OS/browser zoom other than 100%, divide by `window.devicePixelRatio` to get CSS px. At 125% Windows scaling that means ÷1.25.
- Colors were sampled from the PNGs. Mockup samples are slightly softened by downscaling, so each one is snapped to the nearest palette token where one exists.
- The mockup PNG is the source of truth. It differs from `zcerp_customers_1.html` in several places (Actions links, status pills, filters and pagination inside the card). Follow the PNG.
- Token names refer to `customers-delta-design-system.md` (for example `--primary` = `#5019E0` per the mockup).

---

## A. Global shell — Topbar

### A1. Topbar height
- **Current:** 66px (border at y=66).
- **Expected:** 86px (mockup 50px × 1.72).
- **Fix:** `height: 86px`. Keep `border-bottom: 1px solid var(--border)` (`#E5E7EB`, not the current lavender `#E4DFF3`). All topbar children stay `align-items: center`.

### A2. Sidebar collapse chevron on the topbar/sidebar seam
- **Current:** A circular `‹` button (≈28×28, border `#E5E7EB`) sits on the sidebar's right border at y≈34.
- **Expected:** No collapse button. The hamburger (≡) is the only toggle.
- **Fix:** Remove the chevron button from this layout, or hide it with `display:none`.

### A3. Workspace / Owner View selector
- **Current:** Pill (`border-radius: 999px`), bg `#ECE8FB`, no visible border, 433×40px, grid icon. The label reads `Owner View · MARUTHI TRADING COMPANY`, with the shop name in purple `#7C3AED`.
- **Expected:** Rounded rectangle, 280×48px, bg `#F5F5FA`, border `1px solid #E5E7EB`, `border-radius: 8px`. Store/shop outline icon at 18px in `--primary`. Label `Owner View (All Shops)` in one color `#374151`, 15px / 500. Chevron-down outline icon at 16px in `#374151`, 12px left gap.
- **Fix:** `border-radius:8px; background:#F5F5FA; border:1px solid var(--border); height:48px; padding:0 14px; gap:10px; min-width:280px; color:#374151; font-size:15px; font-weight:500`. Label format `Owner View (<scope>)`, where scope is "All Shops" or the shop short-name, rendered in the same color. Replace the grid icon with a store icon (Lucide `store`).

### A4. Module search
- **Current:** 351×40px. Placeholder `Search modules...`. The shortcut is a boxed `<kbd>Ctrl K</kbd>` pushed to the far right.
- **Expected:** 396×48px, bg `#F6F7FC`, border `1px solid #E5E7EB`, `border-radius: 10px`. 18px search icon in `--text-muted`. Placeholder followed immediately by the shortcut as plain text, `Search modules...  ⌘K` (use `Ctrl K` on Windows), 15px, `#9CA3AF`. No kbd box.
- **Fix:** `width:396px; height:48px; border-radius:10px; padding:0 14px; gap:10px`. Shortcut: `background:none; border:none; padding:0; margin-left:8px` (not `margin-left:auto`). Spacing: 16px gap after the Owner View selector.

### A5. Right-side icon cluster
- **Current:** 7 icons: lock, bell, mail, calendar, check-circle, theme (half-moon), power. Then the avatar.
- **Expected:** Four items, in this order:
  1. Location pin plus shop code text `MARUTHI`, 14px / 500, `#374151`, 6px gap. Pin icon 18px, `#374151`.
  2. Bell (outline 20px, `#374151`) with a red dot: 8×8px, `#EF4444`, top-right, `border: 2px solid #fff`.
  3. History icon (Lucide `history`), outline 20px, `#374151`.
  4. Avatar.
- **Fix:** Remove lock, mail, calendar, tasks, theme and power from the topbar. Move them into the avatar dropdown if they're still needed. Gap between items: 28px.

### A6. User avatar
- **Current:** ≈40px circle, light-purple bg (`#A78BFA`-ish) with purple initials.
- **Expected:** 46×46px circle, solid `--primary` (`#5019E0`) bg, `MA` in `#FFFFFF`, 16px / 500.
- **Fix:** `width:46px; height:46px; border-radius:50%; background:var(--primary); color:#fff; font-size:16px; font-weight:500`.

---

## B. Global shell — Sidebar

### B1. Sidebar width and scrollbar
- **Current:** ≈280px total, with a visible 12px scrollbar track (with ▲/▼ arrows) inside the sidebar at x≈263–275.
- **Expected:** 240px wide. No visible scrollbar. Border-right `1px solid #E5E7EB`.
- **Fix:** `width:240px; overflow-y:auto; scrollbar-width:none;` and `::-webkit-scrollbar{display:none}` (or a thin overlay scrollbar shown only on hover).

### B2. Logo
- **Current:** Thin outline `ZC` mark (~22px) next to wordmark `ZcERP` at ~20px / 700.
- **Expected:** Solid, heavy `ZC` mark (filled, `--primary`, ~44×24px) next to wordmark `ZcERP` at 26px / 700 in `#1F2937`. 10px gap between them. Vertically centered in the 86px topbar row.
- **Fix:** Swap in the filled/bold logo mark asset. Set wordmark `font-size:26px; font-weight:700; color:#1F2937`.

### B3. Nav icons style
- **Current:** A mix of filled Material icons (Dashboard grid, filled Contacts people, filled CRM megaphone, filled POS register, filled Shops/Manufacturing/Barcode).
- **Expected:** One consistent outline set: 20px, `stroke-width:1.75`, color `#374151` (active item `--primary`). Mockup icons, closest Lucide names:
  - Dashboard `home`
  - Contacts `users`
  - Sales `trending-up`
  - Purchase `shopping-cart`
  - CRM `heart-handshake`
  - POS `package`
  - POS Billing `credit-card`
  - Inventory `box`
  - Manufacturing `users-cog` / `factory`
  - Projects `folder`
  - Shops `store`
  - Accounting `landmark`
  - Payroll `wallet`
  - Expenses `receipt`
- **Fix:** Replace all sidebar icons with the outline set above at 20×20 and 12px icon–label gap.

### B4. Active nav item ("Contacts")
- **Current:** Label `font-weight:700`, `color:#7C3AED`, bg `#F5F3FF`, `border-radius:10px`, inset 13px from the sidebar's left edge.
- **Expected:** Label `font-weight:500`, color `--primary` (`#5019E0`), bg `#F5F3FF`, `border-radius:8px`, inset 4px left and 8px right (the highlight runs almost edge to edge).
- **Fix:** `.active{font-weight:500; color:var(--primary); border-radius:8px; margin:0 8px 0 4px}`.

### B5. Extra nav items
- **Current:** `Pricing` (under Sales & CRM) and `Barcode` (under Operations) appear.
- **Expected:** Not in the mockup. Sales & CRM ends at POS Billing, and Operations ends at Shops.
- **Fix:** Remove both items, or confirm with product whether the mockup is out of date. Keep them only if intentional.

---

## C. Contacts sub-tabs

### C1. Tab order and labels
- **Current:** `CONTACTS | All Contacts · Customers · Dashboard · Suppliers · Customer Groups · Merge Contacts`
- **Expected:** `CONTACTS  Dashboard · All Contacts · Customers · Suppliers · Customer Groups · Merge`
- **Fix:** Reorder so Dashboard comes first, and rename `Merge Contacts` to `Merge`.

### C2. Group-label divider
- **Current:** A 1px vertical divider after `CONTACTS`.
- **Expected:** No divider. `CONTACTS` is followed by a 50px gap before `Dashboard`.
- **Fix:** Remove the divider. `CONTACTS`: 15px / 500, uppercase, `#374151`, `letter-spacing:0.3px`, `margin-right:50px`.

### C3. Tab bar height and tab typography
- **Current:** Bar 49px tall. Tabs 17px / 500–600, `#111827`, packed tightly (≈16px padding, no gap).
- **Expected:** Bar 62px tall. Tabs 15px / 400, `#374151`. Each tab has `padding:0 14px`, with a 36px gap between tabs.
- **Fix:** `.sub-tabs{height:62px; gap:36px}`, `.sub-tab{font-size:15px; font-weight:400; color:#374151; padding:0 14px}`.

### C4. Active tab ("Customers")
- **Current:** Filled `#F5F3FF` background, bold purple text, 3px underline `#7C3AED`.
- **Expected:** No background fill. Text `--primary`, weight 500. Underline 2px `--primary`, spanning the tab including its 14px padding.
- **Fix:** `.sub-tab.active{background:none; font-weight:500; color:var(--primary); border-bottom:2px solid var(--primary); border-radius:0}`.

---

## D. Page header

### D1. Content padding
- **Current:** About 10px left gap from the sidebar edge and about 15px right gap before the scrollbar.
- **Expected:** 32px left and right, and 38px top (tabs to title).
- **Fix:** `.page-content{padding:38px 32px 32px}`.

### D2. "More" button row
- **Current:** A separate row above the title contains a pill `More ▾` button (grid icon, bg `#EDE9FE`, radius 999px, ~120×40) aligned right.
- **Expected:** No such row. Overflow actions live in a kebab button at the end of the header-actions row (see D5).
- **Fix:** Remove the `More` button and its row.

### D3. Title "Customers"
- **Current:** ≈40px / 700, `#111827`.
- **Expected:** 30px / 600, `#1F2937`, `line-height:1.2`.
- **Fix:** `h1{font-size:30px; font-weight:600; color:#1F2937; line-height:1.2}`.

### D4. Subtitle
- **Current:** 18px, a single line about 875px long.
- **Expected:** 15px, `line-height:26px`, `#374151`. It wraps onto two lines after "…see their details," with max-width 690px. 6px below the title.
- **Fix:** `.subtitle{font-size:15px; line-height:26px; max-width:690px; margin-top:6px; color:#374151}`.

### D5. Header action buttons (set and order)
- **Current:** `[+ New Customer ▾] [⤓ Export to CSV] [⤓ Export to Excel]`
- **Expected:** `[Add Person] [Add Company] [+ New Customer ▾] [Export to CSV] [⋮]`
- **Fix:**
  - Add `Add Person` (Lucide `user-round`) and `Add Company` (Lucide `building-2`) as outline buttons before New Customer.
  - Remove `Export to Excel`. Add a 43×43 kebab icon button (`more-vertical`, 20px) last.
  - Row: `gap:24px`, `align-items:center`, aligned to the title's top edge (`align-items:flex-start` on the header).

### D6. Outline buttons (Add Person, Add Company, Export to CSV, kebab)
- **Current:** Export buttons have purple text and icon (`#7C3AED`), 17px / 600, 44px tall.
- **Expected:** 43px tall, `padding:0 18px`, border `1px solid #E5E7EB`, `border-radius:8px`, bg `#FFFFFF`. Text 15px / 500, `#1F2937`. Icon 18px, `#374151` (Export uses Lucide `download`, outline). Icon–label gap 10px.
- **Fix:** Apply the values above. Text and icon must not use `--primary`.

### D7. Primary "New Customer" button
- **Current:** 219×50px, bg `#7C3AED`, 17px / 700, trailing caret is a filled ▼ triangle.
- **Expected:** 193×43px, bg `--primary` (`#5019E0`), `border-radius:8px`, `padding:0 16px`. Leading `+` icon 18px. Label 15px / 500, white. Trailing Lucide `chevron-down` outline 16px, with 14px gap before it.
- **Fix:** `height:43px; font-size:15px; font-weight:500; background:var(--primary)`. Swap ▼ for chevron-down.

### D8. Tip line
- **Current:** 15–16px, `#6B7280`, visibly letter-spaced.
- **Expected:** 13.5px, `#6B7280`, `letter-spacing:0`. It sits 29px below the subtitle and 38px above the card.
- **Fix:** `.tip{font-size:13.5px; letter-spacing:0; margin:29px 0 38px}`.

---

## E. Filter / table card structure

### E1. Card container
- **Current:** A white card (border `#E4DFF3`, radius ≈16px, 22px inner padding) holds a second bordered box. The Customer Type, Status and Show Disabled filters sit outside the card, above it.
- **Expected:** One card. Border `1px solid #E5E7EB`, `border-radius:12px`, bg `#FFFFFF`, no inner padding around the table. Its contents, top to bottom:
  1. Filter row (E2)
  2. Pagination row (E7)
  3. Table (section F)

  Rows are separated by `1px solid #F3F4F6` dividers.
- **Fix:** Move the Customer Type, Status and Show Disabled controls into the card. Remove the nested inner box and its padding. Set `padding:0; overflow:hidden`.

### E2. Filter row
- **Current:** Its items are split between outside the card and a grey `#F1F5F9` toolbar.
- **Expected:** Single white row inside the card, height 86px, `padding:0 16px`, `gap:28px`, `align-items:center`. Order: Find Options input, Filters button, Customer Type select, Status select, and Show Disabled pushed right with `margin-left:auto`.
- **Fix:** Build it as a flex row with the values above, bg `#FFFFFF`.

### E3. "Find Options" control
- **Current:** A button, 146×44px, dark border `#333`, dark text `Find Options`.
- **Expected:** A text input, 480×50px, border `1px solid #E5E7EB`, `border-radius:8px`. Leading search icon 18px in `#6B7280`, 14px padding. Placeholder `Find Options` at 15px in `#9CA3AF`.
- **Fix:** Render it as `<input placeholder="Find Options">` with the values above.

### E4. "Filters" button (missing)
- **Current:** Not present.
- **Expected:** 129×50px, bg `#F5F3FF`, border `1px solid #DDD6FE`, `border-radius:8px`. Funnel icon (Lucide `filter`) 18px plus label `Filters` 15px / 500, both in `--primary`, 10px gap.
- **Fix:** Add it right after Find Options.

### E5. Customer Type and Status selects
- **Current:** External inline labels (`Customer Type:`, `Status:`) to the left of each select, 16px / 500 `#6B7280`. Selects are 157–162×40, with filled ▼ triangle carets.
- **Expected:** Floating label inside the box. Label sits top-left (12px, `#374151`, 8px from the top) and the value `All` sits below it (15px, `#111827`). Box border `1px solid #E5E7EB`, `border-radius:8px`, height 50px. Width 277px (Customer Type) and 250px (Status). Lucide `chevron-down` outline 18px in `#374151`, 14px from the right edge.
- **Fix:** Remove the external labels and switch to the stacked label/value layout. Replace ▼ with the chevron.

### E6. Show Disabled toggle
- **Current:** Outside the card at top right, with a label at 16px / 500.
- **Expected:** Inside the filter row, right-aligned, 16px from the card edge. Label `Show Disabled` 13.5px, `#6B7280`, 12px gap to the toggle. Toggle 46×24, off track `#D1D5DB`, knob 20px white.
- **Fix:** Move it into E2 and apply the sizes above.

### E7. Pagination row
- **Current:** Grey `#F1F5F9` strip, 60px tall. Order: page-size, |◀, ◀◀, `1 / 4 (1-20 / 63)`, 2, 3, 4, ▶▶, ▶|. Page numbers are MUI-blue links (`#1976D2`), and there is no active page chip.
- **Expected:** White row, 68px tall, right-aligned, `padding:0 32px 0 16px`, `gap:24px`. Order: page-size, first `|◀`, prev `◀◀`, info text `1 - 20 of 117`, pages `1 2 3 4 5`, last `▶|`.
  - Info text: 14px, `#6B7280`, format `{start} - {end} of {total}`.
  - Active page: 34×34px chip, bg `--primary`, white, 14px / 500, `border-radius:6px`.
  - Other pages: plain text, 14px `#374151`, 34×34 hit area, no border.
  - Nav icons: 16px, `#374151`, no border.
- **Fix:**
  - Set the background to `#FFFFFF`.
  - Change the info text format.
  - Page numbers use `color:#374151`, not blue links.
  - Add an active-page chip.
  - Remove the `▶▶` next-page button (the mockup shows only `▶|` on the right).

### E8. Page-size select
- **Current:** 72×44, dark border `#333`, filled ▼.
- **Expected:** 70×34, border `1px solid #E5E7EB`, `border-radius:6px`. Value `20` at 14px / 500, with a Lucide `chevron-down` at 14px.
- **Fix:** Apply the values above.

### E9. "Show Disabled: No ✕" status strip
- **Current:** A full-width grey strip (`#F1F5F9`) with the text `Show Disabled: No` (value in green) and a red `✕` (`#C10015`).
- **Expected:** Not present.
- **Fix:** Remove it. The toggle in E6 already shows the state.

---

## F. Customers table

### F1. Selection checkbox column (missing)
- **Current:** No checkbox column.
- **Expected:** First column, about 4% (≈60px) wide. Checkbox 18×18, border `1.5px solid #D1D5DB`, `border-radius:4px`, `accent-color:var(--primary)`. There's also a select-all checkbox in the header.
- **Fix:** Add it. The name column's content then starts about 38px after the checkbox.

### F2. Column widths
- **Current:** Name ≈27%, Contact ≈22%, Type ≈12%, GSTIN ≈12%, PAN ≈10%, Status ≈8%, Actions ≈8% (no checkbox column).
- **Expected:** Checkbox 4%, Customer Name 22%, Contact Information 20%, Customer Type 11%, GSTIN 13%, PAN 10.5%, Status 8.5%, Actions 11%.
- **Fix:** Set `<col>` widths to the expected values.

### F3. Header row
- **Current:** 35px tall, bg `#FFFFFF`, labels 16px / 500 `#111827`.
- **Expected:** 54px tall, bg `#F8F9FC`, labels 13px / 500 `#6B7280`, normal case, `padding:0 16px`. Bottom border `1px solid #F3F4F6`.
- **Fix:** `th{height:54px; background:var(--bg); font-size:13px; font-weight:500; color:var(--text-secondary); text-transform:none}`.

### F4. Sort indicator (Customer Name)
- **Current:** Stacked ▲▼ pair in blue (`#1E88E5`).
- **Expected:** Single up caret (Lucide `chevron-up`, 12px, stroke 2) in `#6B7280`, 6px after the label.
- **Fix:** Show only the current direction's caret, in `--text-secondary`.

### F5. Row height and dividers
- **Current:** Rows ≈55px. Dividers `1px solid #E0E0E0`.
- **Expected:** Single-line contact rows ≈69px, and email+phone rows ≈80px. Dividers `1px solid #F3F4F6`.
- **Fix:** `td{padding:14px 16px}` with `min-height:68px`. Set `border-bottom-color:#F3F4F6`.

### F6. Customer avatar chip
- **Current:** 42×42, `border-radius:10px`, letter 17px / 600.
- **Expected:** 38×38, `border-radius:7px`, letter 16px / 500. Background and letter colors keep the existing tint pairs.
- **Fix:** `width:38px; height:38px; border-radius:7px; font-size:16px; font-weight:500`. Gap to the name: 22px.

### F7. Customer name and ID
- **Current:** Name 18px / 500 `#111827`. ID 15px `#6B7280`.
- **Expected:** Name 15px / 500 `#1F2937`. ID `ID: …` 12px `#9CA3AF`, 4px below the name.
- **Fix:** Apply the values above.

### F8. Contact information cell
- **Current:** Text 16–17px `#111827`. Phone icon is outline blue-grey. Empty rows show the literal text `No contact info` in `#9CA3AF`.
- **Expected:** Text 14px `#374151`. Icons are filled glyphs (mail, phone) at 14px in `#4B5563`, with a 14px icon–text gap and 8px between the email and phone lines. The empty state is `–`, matching the other empty cells.
- **Fix:** Apply the values above. Replace `No contact info` with `–`.

### F9. Customer Type badge
- **Current:** Pill (`border-radius:12px`), 26px tall, 14px / 600. Business uses bg `#CDF1FD` and text `#1A6FDC`.
- **Expected:** Small rectangle, `border-radius:4px`, 21px tall, `padding:0 8px`, 12px / 500.
  - Individual: bg `#DCFCE7`, text `#15803D`.
  - Business: bg `#DBEAFE`, text `#2563EB`.
- **Fix:** Apply the values above.

### F10. GSTIN / PAN empty values
- **Current:** GSTIN shows an em dash `—` in `#9CA3AF`, while PAN shows a hyphen `-` in `#111827`. The two don't match.
- **Expected:** Both show an en dash `–`, 14px, `#374151`. Populated GSTIN/PAN values are 14px / 400 `#1F2937` (not monospace).
- **Fix:** Use one empty-cell renderer (`–`, `#374151`) for all table cells.

### F11. Status badge
- **Current:** Pill (`border-radius:12px`), 26px tall, 14px / 600, bg `#E6F7E9`.
- **Expected:** `border-radius:4px`, 24px tall, `padding:0 8px`, 12px / 500.
  - Active: bg `#DCFCE7`, text `#16A34A`.
  - Inactive: bg `#FEE2E2`, text `#DC2626`.
- **Fix:** Apply the values above.

### F12. Actions column
- **Current:** A single purple pencil icon (`#7C3AED`, 18px).
- **Expected:** Three inline text links: `POs`, `Bills`, `Ledger`. Each is 14px / 500 in `--primary-blue` `#2563EB`, `gap:24px`, no underline (underline on hover).
- **Fix:** Replace the edit icon with the three links. They route to the customer's POs, Bills and Ledger. Editing moves to clicking the customer name or ID, as the tip line describes.

---

## G. Footer and floating elements

### G1. Footer
- **Current:** bg `#F7F5FD` (lavender tint). Text ≈18px in light grey. `Support` at 18px in `#7C3AED`.
- **Expected:** bg `#F8F9FC` (the page bg, no tint). Copyright text 13px `#6B7280`, 22px from the sidebar edge. `Support` 13px / 500 in `--primary`. Height 46px.
- **Fix:** `footer{background:var(--bg); font-size:13px; color:var(--text-secondary); height:46px; padding:0 22px}`.

### G2. AI Copilot FAB
- **Current:** Full pill (`border-radius:25px`), 134×50, bg `#463D7A` (dark slate-violet), no icon, label 17px / 700.
- **Expected:** Rounded rectangle, 170×55, `border-radius:14px`, bg `--primary`. Leading filled chat-bubble icon 20px in white, 10px gap. Label `AI Copilot` 17px / 500 in white. Shadow `0 6px 20px rgba(80,25,224,.35)`. Position: 16px from the right and 16px from the bottom.
- **Fix:** Apply the values above.

### G3. Extra floating widget
- **Current:** A second, green floating element peeks out below the AI Copilot at bottom-right (x≈1797–1875, y≥900).
- **Expected:** Not present.
- **Fix:** Remove or hide it on this route.

### G4. Page scrollbar
- **Current:** A visible light-grey browser scrollbar with arrows on the far right (x≈1905).
- **Expected:** None visible at this viewport.
- **Fix:** Scroll inside the table card area, or use a thin overlay scrollbar: `scrollbar-width:thin; scrollbar-color:#E5E7EB transparent`.

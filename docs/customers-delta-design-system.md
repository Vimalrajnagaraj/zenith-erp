# Customers — Delta Corrections (Design Tokens)

Only tokens that are wrong or missing in the built page (`Customers_Page_1st.png`) compared with the original mockup (`Customers_original.png`). Colors were sampled from the PNGs. Sizes are in capture px at a 1917px-wide capture: mockup measurements ×1.72. Divide by `devicePixelRatio` for CSS px. Component-level usage is in `customers-delta-components.md`.

---

## 1. Color tokens

| Token | Built (current) | Mockup (expected) | Evidence / note |
|---|---|---|---|
| `--primary` | `#7C3AED` | **`#5019E0`** | Mockup samples: New Customer `#521EE1`/`#531CE6`, active page chip `#4917DC`, avatar `#4D17DD`, AI Copilot `#4F19E3`, Support link `#451DE8`. ⚠️ **Conflicts with `zcerpthemepalette.md`**, which mandates `#7C3AED`. Decide which one wins. If the mockup is authoritative, update the palette file too so other screens stay consistent. |
| `--primary-dark` (hover/pressed) | `#6D28D9` | **`#4312C0`** | Derived from the new `--primary` at about 15% darker. It isn't visible in a static mockup, so this is a proposal. |
| `--primary-rgb` (new, for shadows) | — | **`80, 25, 224`** | The Copilot shadow uses `rgba(var(--primary-rgb), .35)`. |
| AI Copilot background | `#463D7A` (hard-coded slate-violet) | `var(--primary)` | Should not be a separate color. |
| `--border` | `#E4DFF3` (lavender-tinted, on the card, tabs and topbar) | **`#E5E7EB`** | Mockup borders read neutral grey. |
| Table row divider | `#E0E0E0` (MUI default) | **`#F3F4F6`** | |
| Toolbar / pagination strip bg | `#F1F5F9` | **`#FFFFFF`** (inside the card, no tint) | Remove the slate-100 usage on this page. |
| Table header bg | `#FFFFFF` | **`#F8F9FC`** (`--bg`) | Mockup sample `#FAFAFC`. |
| Page / main content bg | `#FFFFFF` | **`#F8F9FC`** (`--bg`) | Mockup sample `#FBFBFD`. The white card has to stand out against it. |
| Footer bg | `#F7F5FD` (lavender) | **`#F8F9FC`** (`--bg`) | |
| Pagination page-number color | `#1976D2` (MUI blue) | **`#374151`** | Only the active page uses `--primary` (as a chip). |
| Sort-indicator color | `#1E88E5` | **`#6B7280`** (`--text-secondary`) | |
| Owner View selector bg | `#ECE8FB` | **`#F5F5FA`** | Mockup sample `#F5F5FB`. Paired with a `--border` outline. |
| Filters button (new) | — | bg `#F5F3FF`, border **`#DDD6FE`**, fg `var(--primary)` | `#DDD6FE` isn't in the palette yet. Add it as `--primary-border`. |
| Type badge: Business | bg `#CDF1FD`, fg `#1A6FDC` | bg **`#DBEAFE`**, fg **`#2563EB`** | |
| Type badge: Individual | bg ≈`#E6F7E9`, fg ≈`#2E7D32` | bg **`#DCFCE7`**, fg **`#15803D`** | Mockup sample bg `#E3F6E5`. |
| Status: Active | bg `#E6F7E9`, fg ≈`#2E7D32` | bg **`#DCFCE7`**, fg **`#16A34A`** | |
| Status: Inactive | (not rendered) | bg **`#FEE2E2`**, fg **`#DC2626`** | Mockup sample bg `#FDDADC`. |
| Action link color | — (purple pencil icon) | **`#2563EB`** (`--primary-blue`) | For the POs / Bills / Ledger links. |
| Contact-info icon color | blue-grey outline | **`#4B5563`** (filled glyph) | New neutral step. Add it as `--text-icon`. |
| Body text in cells, tabs and subtitle | `#111827` | **`#374151`** | The mockup uses gray-700 for secondary body copy. `#111827` stays only for select values. Add it as `--text-body`. |
| Heading / name text | `#111827` | **`#1F2937`** | Title, customer names, button labels. |
| Toggle off track | `#E5E7EB` | **`#D1D5DB`** | Mockup sample `#D5D5D6`. |

---

## 2. Typography tokens

Font family is unchanged. The scale in the built page runs about 15–25% larger than the mockup. In capture px:

| Token / role | Built | Expected |
|---|---|---|
| Page title (`h1`) | ≈40px / 700 | **30px / 600**, line-height 1.2 |
| Subtitle | 18px / 400 | **15px / 400**, line-height 26px |
| Tip text | 15–16px, letter-spaced | **13.5px / 400**, letter-spacing 0 |
| Sub-tab label | 17px / 500–600 | **15px / 400** (active: 500) |
| Button label | 17px / 600–700 | **15px / 500** |
| Table header | 16px / 500 | **13px / 500**, sentence case |
| Table cell body | 16–17px | **14px / 400** |
| Customer name | 18px / 500 | **15px / 500** |
| Meta (ID line) | 15px | **12px / 400** |
| Badge label (type and status) | 14px / 600 | **12px / 500** |
| Footer | ≈18px | **13px / 400** |
| Avatar initials (row) | 17px / 600 | **16px / 500** |
| Sidebar active item weight | 700 | **500** |
| Logo wordmark | ≈20px / 700 | **26px / 700** |

---

## 3. Radius tokens

| Token / role | Built | Expected |
|---|---|---|
| `--radius-badge` (new) | 12px / full pill | **4px** |
| Card (`--radius`) | ≈16px | **12px** |
| Owner View selector | 999px (pill) | **8px** (`--radius-sm`) |
| Topbar search | ≈8px | **10px** |
| Row avatar chip | 10px | **7px** |
| Sidebar active item | 10px | **8px** (`--radius-sm`) |
| Sub-tab active | 6px 6px 0 0 | **0** |
| AI Copilot FAB | 25px (pill) | **14px** |
| Pagination active chip | — | **6px** |

---

## 4. Layout / spacing tokens

| Token | Built | Expected |
|---|---|---|
| `--topbar-height` | 66px | **86px** |
| `--sidebar-width` | ≈280px (incl. visible scrollbar) | **240px**, scrollbar hidden |
| Sub-tab bar height | 49px | **62px** |
| Sub-tab gap | ≈0 | **36px** (tab padding `0 14px`) |
| Page content padding | ≈10px L / 15px R | **38px top, 32px left/right** |
| Filter-row height (in card) | — | **86px** |
| Pagination-row height | 60px | **68px** |
| Table header height | 35px | **54px** |
| Table row height | ≈55px | **≈69px** (1-line contact) / **≈80px** (2-line) |
| Header-actions gap | ≈20px | **24px** |
| Control height: buttons | 44–50px | **43px** |
| Control height: filter inputs / selects | 40–44px | **50px** |

---

## 5. Elevation

| Role | Built | Expected |
|---|---|---|
| AI Copilot shadow | dark neutral shadow | **`0 6px 20px rgba(80,25,224,.35)`** |

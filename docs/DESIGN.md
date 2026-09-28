# Clear Money Design System

Calm, premium financial utility. Light-first. Strong typography. Restrained color. Motion clarifies state only.

## Tokens

### Canvas and surfaces

| Token | Light | Dark |
| --- | --- | --- |
| `--cm-canvas` | `#F7F8FA` | `#0B1020` |
| `--cm-surface` | `#FFFFFF` | `#121A2B` |
| `--cm-elevated` | `#FFFFFF` | `#121A2B` |
| `--cm-border` | `#E4E7EC` | `#27334A` |
| `--cm-shadow` | `0 8px 28px rgba(16,24,40,.06)` | soft dark equivalent |

### Ink

| Token | Light | Dark |
| --- | --- | --- |
| `--cm-ink` | `#101828` | `#F8FAFC` |
| `--cm-ink-secondary` | `#667085` | `#98A2B3` |
| `--cm-ink-muted` | `#98A2B3` | `#667085` |

### Brand and semantic

| Token | Value | Use |
| --- | --- | --- |
| `--cm-brand` | `#5B5CE2` | Primary actions, selected nav, focus |
| `--cm-brand-tint` | `#EEF0FF` | Soft selection |
| `--cm-income` | `#159A72` | Income (pair with label) |
| `--cm-expense` | `#D95D5D` | Expense (pair with label) |
| `--cm-warning` | `#C78324` | Warnings |
| `--cm-ai` | `#8B5CF6` | AI surfaces |
| `--cm-info` | `#3B82F6` | Info |

### Radius

| Token | Value |
| --- | --- |
| `--cm-radius-sm` | `10px` |
| `--cm-radius-control` | `12px` |
| `--cm-radius-card` | `16px` |
| `--cm-radius-feature` | `20px` |
| `--cm-radius-pill` | `999px` |

### Type

- Family: Geist or Inter variable
- Weights: 400, 500, 600, 700
- Amounts: tabular numerals (`font-variant-numeric: tabular-nums`)

### Spacing

4px base grid. Common steps: 8, 12, 16, 20, 24, 32, 48.

## Motion

| Duration | Use |
| --- | --- |
| 120ms | Press / hover |
| 200ms | Menus / sheets |
| 320ms | Page reveal |

Curves: ease-out enter, ease-in leave. Respect `prefers-reduced-motion`. Count-up finishes quickly; final value stays in the DOM. No WebGL, shaders, cursor effects, or heavy motion inside authenticated money workflows.

Approved motion surfaces: landing, pricing, onboarding completion, loading, empty states, lightweight count-up totals.

## Shell

- **Desktop:** 240px collapsible left sidebar, content column max 1280px, active Space in top bar.
- **Mobile (<768px):** bottom nav Home / Activity / Reports / Spaces + persistent Add FAB. Tables → stacked rows. Filters → Sheet.
- **RTL:** mirror navigation and directional icons; do not mirror numerals, currency symbols, charts, or receipt images.

## Route → layout map

| Route | Layout |
| --- | --- |
| `/` landing, `/pricing` | Public marketing shell |
| `/setup/*` | Setup shell (no app chrome) |
| `/auth/*` | Auth card shell |
| `/app/*` | AppShell (sidebar or bottom nav) |

## Component inventory

AppShell, SpaceSwitcher, AmountInput, TransactionForm, PeriodSelector, SummaryCard, CategoryBreakdown, TimePatternChart, GoalCard, ExportDialog, MemberList, PermissionGate. Foundation: shadcn/ui copied into the repo and themed via CSS variables only.

## Accessibility

Keyboard navigation, visible focus, semantic labels, 4.5:1 text contrast, 44pt / 48dp touch targets, reduced motion, screen-reader chart summaries, never color alone as the only signal.

## States required on every primary screen

Loading, empty, error, success, permission-denied, offline.

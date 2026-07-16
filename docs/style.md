# NWD Central Hub — Style Reference

## Stack

- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Fonts**: Geist Sans (body), Geist Mono (accents, labels, badges)
- **No CSS modules or CSS-in-JS** — all component styling is Tailwind utilities + inline `style` props

---

## Color Palette

Defined as CSS custom properties in `app/globals.css` and exposed to Tailwind via `@theme inline`:

| Token | Hex | Usage |
|---|---|---|
| `--nwd-purple` | `#4D3F9F` | Primary brand color, branding text, borders |
| `--nwd-purple-dark` | `#3A2E7A` | Hover state for purple elements |
| `--nwd-teal` | `#1E7A8C` | Admin accent, section labels, active sort indicators |
| `--nwd-sky` | `#3ECAE8` | Auth/secondary accent |
| `--nwd-surface` | `#F7F7F5` | Off-white page backgrounds |
| `--nwd-border` | `#E4E4E0` | Subtle borders (header, card edges) |

Use these via inline `style` props: `style={{ color: 'var(--nwd-teal)' }}`.

They are also available as Tailwind classes: `text-nwd-purple`, `bg-nwd-surface`, `border-nwd-border`, etc.

---

## Typography

| Use | Font | Class/Style |
|---|---|---|
| Body text | Geist Sans | Default (applied on `body`) |
| Labels, badges, tags, footer watermark | Geist Mono | `style={{ fontFamily: 'var(--font-geist-mono)' }}` |

**Scale used across pages:**

| Element | Classes |
|---|---|
| Page heading | `text-3xl font-bold text-gray-900 leading-tight` |
| Section label (eyebrow) | `text-xs font-semibold tracking-widest` + `color: var(--nwd-teal)` + Geist Mono |
| Card label | `font-semibold text-gray-900` |
| Card description | `text-sm text-gray-400` |
| Table header | `text-xs font-medium text-gray-500 uppercase tracking-wider` |
| Badge text | `text-xs font-semibold tracking-wider` + Geist Mono |
| Footer watermark | `text-xs tracking-wide` + `color: var(--nwd-purple)` at 40% opacity + Geist Mono |

---

## Page Layout

All pages share a three-part flex structure:

```tsx
<div className="min-h-screen flex flex-col" style={{ background: 'white' }}>
  <header>...</header>
  <main className="flex-1 flex flex-col items-center justify-center px-4 py-14">
    ...
  </main>
  <footer>...</footer>
</div>
```

### Header

White bar with the NWD logo, a multi-level breadcrumb, and a **Back** link in the top-right. Use `max-w-5xl` for data-dense pages.

- Breadcrumb segments: brand name (purple) → parent page (gray, clickable `<Link>` or `<button onClick={router.back()}>`) → current page (teal, non-clickable)
- Back link sits flush right: chevron-left SVG + "Back" text, `text-gray-400 hover:text-gray-600`

```tsx
<header className="bg-white border-b" style={{ borderColor: 'var(--nwd-border)' }}>
  <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
    <Image src="/NextWaveDev_FINAL_small.png" alt="NextWaveDev logo" width={36} height={36} className="object-contain" />
    <div className="flex items-center flex-1 min-w-0">
      <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--nwd-purple)' }}>
        NextWaveDev
      </span>
      <span className="text-gray-400 mx-2 select-none">/</span>
      {/* Parent page — use Link for a fixed route, button+router.back() for dynamic origin */}
      <Link href="/parent-route" className="text-sm text-gray-500 font-medium hover:text-gray-700 transition-colors">
        Parent Page
      </Link>
      <span className="text-gray-400 mx-2 select-none">/</span>
      {/* Current page — teal, no interaction */}
      <span className="text-sm font-medium truncate" style={{ color: 'var(--nwd-teal)' }}>
        Current Page
      </span>
    </div>
    {/* Back link — top-right of header */}
    <Link href="/parent-route" className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 flex-shrink-0">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L5 8l5 5" />
      </svg>
      Back
    </Link>
  </div>
</header>
```

For pages with a dynamic origin (e.g. shared workspace reached from multiple roles), replace `<Link>` with `<button onClick={() => router.back()}>` for both the parent breadcrumb segment and the Back link.

### Footer

Minimal monospace watermark, centered:

```tsx
<footer className="text-center py-6 px-4">
  <p className="text-xs tracking-wide"
     style={{ color: 'var(--nwd-purple)', opacity: 0.4, fontFamily: 'var(--font-geist-mono)' }}>
    NWD CENTRAL HUB
  </p>
</footer>
```

### Content Container

For centered portal/dashboard pages: `w-full max-w-md` inside the `main`.

For wider pages (tables, data-dense views): `max-w-5xl mx-auto px-6 py-14`.

---

## Section Labels (Eyebrow Text)

Used above a page heading to indicate context (e.g., "ADMIN", "PORTAL"):

```tsx
<p className="text-xs font-semibold tracking-widest mb-2"
   style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>
  SECTION NAME
</p>
<h1 className="text-3xl font-bold text-gray-900 leading-tight">
  Page heading
</h1>
```

---

## Navigation Cards

The primary interactive element on dashboard/portal pages. Each card is a bordered link with a left accent bar, label, tag badge, description, and arrow icon.

```tsx
<Link
  href="/route"
  className="group flex items-center gap-5 rounded-lg px-5 py-4 border transition-colors hover:brightness-95"
  style={{ borderColor: accentColor, background: 'white' }}
>
  {/* Accent bar */}
  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: accentColor }} />

  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 mb-0.5">
      <span className="font-semibold text-gray-900">Label</span>
      <span
        className="text-xs font-semibold tracking-wider px-1.5 py-0.5 rounded"
        style={{
          color: accentColor,
          background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
          fontFamily: 'var(--font-geist-mono)',
        }}
      >
        TAG
      </span>
    </div>
    <p className="text-sm text-gray-400">Description text</p>
  </div>

  {/* Arrow */}
  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0"
       fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10M9 4l4 4-4 4" />
  </svg>
</Link>
```

Accent colors map to sections:
- Purple (`var(--nwd-purple)`) → Proposals
- Teal (`var(--nwd-teal)`) → Admin
- Sky (`var(--nwd-sky)`) → Auth

---

## Badges

Badges use `color-mix()` to generate a tinted background from the text color. All badges use Geist Mono.

### Role Badge

```tsx
const ROLE_STYLES = {
  contractor: { color: 'var(--nwd-teal)',   label: 'Contractor' },
  client:     { color: 'var(--nwd-purple)', label: 'Client'     },
  admin:      { color: '#6b7280',           label: 'Admin'      },
}

<span
  className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
  style={{
    color: roleColor,
    background: `color-mix(in srgb, ${roleColor} 12%, transparent)`,
    fontFamily: 'var(--font-geist-mono)',
  }}
>
  {label}
</span>
```

### Status Badge

```tsx
// Pending
<span className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
      style={{ color: '#92400e', background: 'color-mix(in srgb, #f59e0b 15%, transparent)', fontFamily: 'var(--font-geist-mono)' }}>
  Pending
</span>

// Active
<span className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
      style={{ color: '#065f46', background: 'color-mix(in srgb, #10b981 15%, transparent)', fontFamily: 'var(--font-geist-mono)' }}>
  Active
</span>
```

### Tag Badge (inline, in nav cards)

Same pattern as Role Badge but with 10% opacity mix instead of 12%.

---

## Tables

Used on the user management and proposals pages.

```tsx
<div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Column
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      <tr>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          Value
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Sortable Column Headers

Sort icons use two SVG triangle paths — the active direction renders in `var(--nwd-teal)`, the inactive one stays `#d1d5db`:

```tsx
<button className="flex items-center gap-1 uppercase tracking-wider text-xs font-medium text-gray-500"
        onClick={() => toggleSort('column')}>
  Column
  <SortIcon col="column" sortCol={sortCol} sortDir={sortDir} />
</button>
```

### Expandable Rows

Expanded detail panels sit below their row with a visible transition. The row itself has a slightly tinted teal background when expanded:

```tsx
// Row
<tr className="cursor-pointer transition-colors"
    style={{ background: isExpanded ? 'color-mix(in srgb, var(--nwd-teal) 4%, white)' : undefined }}
    onClick={() => toggleExpand(user.id)}>

// Expand panel (conditionally rendered)
{isExpanded && (
  <tr>
    <td colSpan={totalCols} className="px-6 py-4 bg-gray-50 border-t border-gray-100">
      ...
    </td>
  </tr>
)}
```

---

## Forms

### Input / Textarea

```tsx
<label className="block text-sm font-medium text-gray-700">Field Label</label>
<input
  type="text"
  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
/>
```

### Select

```tsx
<select className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900">
  <option value="client">Client</option>
</select>
```

### Form Container

```tsx
<div className="bg-white p-8 rounded-lg shadow-md">
  <h2 className="text-2xl font-bold text-gray-900 mb-6">Form Title</h2>
  <form className="space-y-4">...</form>
</div>
```

---

## Buttons

### Primary (Submit / Action)

```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
>
  {loading ? 'Processing...' : 'Submit'}
</button>
```

### Destructive (Delete)

```tsx
<button className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors disabled:opacity-40">
  Delete
</button>
```

### Ghost / Secondary Action

```tsx
<button className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
  Cancel
</button>
```

### Inline Action (table rows, small spaces)

```tsx
<button className="text-xs px-3 py-1.5 rounded border font-medium transition-colors"
        style={{ borderColor: 'var(--nwd-teal)', color: 'var(--nwd-teal)' }}
        onMouseOver={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--nwd-teal) 8%, transparent)'}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
  Action
</button>
```

---

## Loading States

### Spinner (centered, full-area)

```tsx
<div className="flex flex-col items-center justify-center py-24 gap-4">
  <div className="w-9 h-9 rounded-full border-[3px] border-stone-200 border-t-stone-900 animate-spin" />
  <p className="text-sm text-stone-400">Loading…</p>
</div>
```

For light backgrounds use `border-gray-200 border-t-gray-600`.

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
  <span className="text-5xl">📋</span>
  <p className="text-lg font-bold text-stone-800 mt-2">No items</p>
  <p className="text-sm text-stone-400 max-w-xs leading-relaxed">
    Descriptive message explaining the empty state.
  </p>
</div>
```

---

## Success / Error Feedback

### Success Banner

```tsx
<div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
  Success message here.
</div>
```

### Error Banner

```tsx
<div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
  Error message here.
</div>
```

---

## Dark Theme (Contractor Dashboard)

The contractor page uses a stone-based dark theme with `bg-stone-800`. Use only for this page — all other pages are light.

| Element | Classes |
|---|---|
| Page background | `bg-stone-800` |
| Primary heading | `text-4xl font-black text-stone-50 tracking-tight` |
| Divider line | `h-0.5 bg-gradient-to-r from-stone-50 to-transparent rounded-full` |
| Count badge | `bg-stone-900 text-white text-xs font-semibold px-4 py-1.5 rounded-full` |
| Project cards | `bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200` |
| Card top accent | `h-1.5 bg-gradient-to-r from-stone-800 to-stone-500` |
| Active status dot | `text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-0.5 text-xs` |

---

## Pagination Controls

For paginated tables, pagination sits below the table:

```tsx
<div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
  <span>{start}–{end} of {total}</span>
  <div className="flex items-center gap-1">
    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
      ←
    </button>
    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
            className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
      →
    </button>
  </div>
</div>
```

---

## Inline Style vs Tailwind: When to Use Each

| Scenario | Use |
|---|---|
| Layout, spacing, sizing, shadows, rounding | Tailwind utilities |
| NWD brand colors (`--nwd-*`) | Inline `style` prop with CSS variable |
| Dynamic colors from component state | Inline `style` prop |
| `color-mix()` tinted backgrounds | Inline `style` prop |
| Geist Mono font on specific elements | Inline `style={{ fontFamily: 'var(--font-geist-mono)' }}` |
| Standard Tailwind color scale (gray, red, green…) | Tailwind utilities |
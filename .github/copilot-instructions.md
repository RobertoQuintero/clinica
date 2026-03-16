# Copilot Workspace Instructions — Centro Podológico

## Date/Datetime Handling (mandatory in all forms and API routes)

This project uses SQL Server via `mssql` (the `db` instance in `database/connection.ts`).
**JS `Date` objects cause UTC timezone shifts when serialized by mssql.**
All user-visible date and datetime fields must flow as plain strings end-to-end, never as `Date` objects.

---

### Utility helpers — always import from `@/utils/date_helpper`

| Helper | Purpose | Example |
|---|---|---|
| `toDBString(val)` | Converts any date input (`"YYYY-MM-DDTHH:mm"`, `"YYYY-MM-DD HH:mm:ss"`, `null`) to SQL Server safe `"YYYY-MM-DD HH:mm:ss"` or `null` | `"2026-03-15T10:00"` → `"2026-03-15 10:00:00"` |
| `toDateTimeLocal(val)` | Converts DB string or ISO string to `<input type="datetime-local">` value format `"YYYY-MM-DDTHH:mm"` | `"2026-03-15 10:00:00"` → `"2026-03-15T10:00"` |
| `addZeroToday(date)` | Converts a local `Date` to `"YYYY-MM-DD"` string (local time, no UTC shift) | `new Date()` → `"2026-03-15"` |
| `buildDate(date)` | Converts a local `Date` to `"YYYY-MM-DD HH:mm:ss"` string (local time) | `new Date()` → `"2026-03-15 10:00:00"` |

---

### Rule 1 — API route GET: return dates as strings from SQL Server

Use `CONVERT(varchar(N), [column], 120)` in the SELECT so mssql never materialises a JS `Date`:

```ts
// datetime columns → "YYYY-MM-DD HH:mm:ss"
CONVERT(varchar(19), [fecha_inicio], 120) AS fecha_inicio

// date-only columns → "YYYY-MM-DD"
CONVERT(varchar(10), [fecha_nacimiento], 120) AS fecha_nacimiento
```

### Rule 2 — API route POST: pass fecha fields as strings, not Date objects

```ts
import { toDBString } from "@/utils/date_helpper";

// User-supplied datetime fields — use toDBString
fecha_inicio: toDBString(String(fecha_inicio ?? "")),
fecha:        toDBString(String(fecha        ?? "")),

// Date-only fields — also use toDBString (returns "YYYY-MM-DD 00:00:00", SQL Server casts fine)
fecha_nacimiento: toDBString(String(fecha_nacimiento ?? "")),

// System-managed timestamps — also use toDBString or pass the string directly
// DO NOT use new Date(val) for any field that comes from user input
created_at: toDBString(String(created_at ?? "")) ?? buildDate(new Date()),
```

The `queryParams` wrapper in `database/connection.ts` sends strings as `NVarChar`; SQL Server performs
a safe implicit cast to `datetime2`/`date` using the literal wall-clock value, with no timezone shift.

### Rule 3 — Frontend form inputs: use helpers for value binding

```tsx
import { toDateTimeLocal } from "@/utils/date_helpper";

// datetime-local input
<input
  type="datetime-local"
  name="fecha_inicio"
  value={toDateTimeLocal(String(form.fecha_inicio ?? ""))}
  onChange={onChange}
/>

// date-only input
<input
  type="date"
  name="fecha_nacimiento"
  value={String(form.fecha_nacimiento ?? "").slice(0, 10)}
  onChange={onChange}
/>
```

### Rule 4 — Display (table rows, read-only text): normalise before parsing

Never pass a DB date string directly to `new Date()` — add `T00:00:00` (date-only) or replace the space
with `T` (datetime) so the browser parses as **local time**, not UTC:

```ts
// datetime
const fmtDatetime = (val: Date | string) => {
  if (!val) return "—";
  return new Date(String(val).replace(" ", "T"))
    .toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

// date-only
const fmtDate = (val: Date | string) => {
  if (!val) return "—";
  const s = String(val).replace(" ", "T");
  return new Date(s.includes("T") ? s : s + "T00:00:00")
    .toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "2-digit" });
};
```

### Rule 5 — New record timestamps (`created_at`)

Use `buildDate(new Date())` instead of `new Date().toISOString()`:

```ts
// ✅ correct — local wall-clock time, no UTC offset
body: JSON.stringify({ ...form, created_at: buildDate(new Date()) })

// ❌ wrong — toISOString() appends "Z" → SQL Server shifts by timezone offset
body: JSON.stringify({ ...form, created_at: new Date().toISOString() })
```

### Rule 6 — `fecha_registro` / date-only defaults

Use `addZeroToday(new Date())` instead of `new Date().toISOString().slice(0, 10)`:

```ts
// ✅ correct
fecha_registro: addZeroToday(new Date())   // "2026-03-15"

// ❌ wrong — toISOString() is UTC; at night it may return yesterday's date in UTC-6
fecha_registro: new Date().toISOString().slice(0, 10)
```

---

### Anti-patterns to avoid

| ❌ Pattern | ✅ Replacement |
|---|---|
| `new Date(dbValue)` on display | normalize string first (Rule 4) |
| `new Date().toISOString()` for timestamps | `buildDate(new Date())` |
| `new Date().toISOString().slice(0, 10)` | `addZeroToday(new Date())` |
| `toDate(val)` / `new Date(val)` for user dates in POST | `toDBString(String(val ?? ""))` |
| `.slice(0, 16)` on a DB date value in form inputs | `toDateTimeLocal(String(val ?? ""))` |
| Returning raw `[fecha]` column from GET | `CONVERT(varchar(19), [fecha], 120) AS fecha` |

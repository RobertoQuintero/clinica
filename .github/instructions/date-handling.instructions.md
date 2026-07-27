---
applyTo: "app/api/**/route.ts,app/dashboard/**/*.tsx,app/dashboard/**/*.ts"
---

# Date Handling Pattern — API Routes & Form Components

When creating or editing any API route (`route.ts`) or dashboard form component (`.tsx`/`.ts`),
follow the rules below. Full rationale is in `.github/copilot-instructions.md`.

## API route GET — always CONVERT datetime/date columns to strings

```sql
-- datetime fields
CONVERT(varchar(19), [fecha_inicio],    120) AS fecha_inicio
CONVERT(varchar(19), [fecha],           120) AS fecha

-- date-only fields  
CONVERT(varchar(10), [fecha_nacimiento], 120) AS fecha_nacimiento
CONVERT(varchar(10), [fecha_registro],   120) AS fecha_registro
```

## API route POST — use `toDBString` for user-supplied date fields

```ts
import { toDBString } from "@/utils/date_helpper";

// In commonParams:
fecha_inicio:    toDBString(String(fecha_inicio    ?? "")),
fecha:           toDBString(String(fecha           ?? "")),
fecha_nacimiento: toDBString(String(fecha_nacimiento ?? "")),
fecha_registro:  toDBString(String(fecha_registro  ?? "")),

// For created_at set by the server (not supplied by the user):
created_at: toDBString(String(created_at ?? "")) ?? buildDate(new Date()),
```

**Never use `new Date(val)` / `toDate(val)` for any field that originates from user input.**

## Form component — datetime-local inputs

```tsx
import { toDateTimeLocal } from "@/utils/date_helpper";

<input
  type="datetime-local"
  name="fecha"
  value={toDateTimeLocal(String(form.fecha ?? ""))}
  onChange={onChange}
/>
```

## Form component — date inputs

```tsx
<input
  type="date"
  name="fecha_nacimiento"
  value={String(form.fecha_nacimiento ?? "").slice(0, 10)}
  onChange={onChange}
/>
```

## openEdit — normalise before setting form state

```ts
// datetime field
const openEdit = (item: IModel) => {
  setForm({ ...item, fecha: toDateTimeLocal(String(item.fecha ?? "")) });
};
```

## Display (rows / read-only) — normalise before parsing with new Date()

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

## New-record timestamp

```ts
import { buildDate, addZeroToday } from "@/utils/date_helpper";

created_at: buildDate(new Date())     // "YYYY-MM-DD HH:mm:ss"  (local time)
fecha_registro: addZeroToday(new Date()) // "YYYY-MM-DD"         (local date)
```

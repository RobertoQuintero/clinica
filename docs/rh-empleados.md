# HR — Employees (empleados)

- `app/dashboard/empleados/` covers employee onboarding, listing, and detail (`RH.empleados` table; catalogs in `interfaces/rh_catalogs.ts` — department, puesto, turno).
- Employee detail (`empleados/[id]/`) is a tabbed layout: **Documentos** (`[id]/documentos/`, Cloudinary uploads) and **Asistencia** (`[id]/asistencia/`, attendance records fed by the biometric checadores — see `docs/asistencias-biometricas.md`).

## Usuarios tab (`empleados/[id]/usuarios/`)

- Links system accounts (`dbo.users`) to an employee through `users.id_empleado` (nullable FK to `RH.empleados`, non-unique index). A user belongs to at most one employee; an employee can have several users. There is no bridge table and no link history.
- The tab is a Server Component listing **all** linked users (including those later set to `status = 0`), with a per-row "Desvincular" button. Only `LinkUserModal.tsx` and `UnlinkUserButton.tsx` are Client Components. Access is already covered by `proxy.ts` for `/dashboard/empleados` (roles 1 and 4).
- **Eligibility to link:** same `id_empresa` as the employee, `status = 1`, and `id_empleado IS NULL`. Branch (`sucursal`) and `id_role` do not restrict. Linking an employee with `activo = 0` is allowed.
- **Server actions** (`usuarios/actions.ts`, schemas in `usuarios/schemas.ts`): `getEmployeeLinkedUsers`, `getLinkableUsers`, `linkUserToEmployee`, `unlinkUserFromEmployee`. The two writes parse with `zod`, re-validate against the DB, and repeat the link condition in the `UPDATE ... WHERE` (`IS NULL` when linking, `= @id_empleado` when unlinking) with `OUTPUT INSERTED`, so a concurrent change affects zero rows and returns `{ ok: false }`.
- **Unlinking** sets `id_empleado = NULL` and keeps the user's access, role and branch. **Deactivating an employee does not unlink** their users.
- `/dashboard/usuarios` shows a read-only, sortable "Empleado" column (`getUsuarios` does a `LEFT JOIN` on `RH.empleados`). `saveUsuario` lists its columns explicitly and never touches `id_empleado`.
- **Not implemented yet:** `users.id_empleado` is only the foundation for attributing commissions (sales, consultations, treatments) and feeding payroll. No calculation or report uses the link today.

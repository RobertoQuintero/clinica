# 55 — Empleados: vincular usuarios del sistema

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [25 — Módulo de Empleados (RH): alta, listado y expediente](25-empleados-alta-listado-detalle.md): la ficha `/dashboard/empleados/[id]` y su layout con pestañas.
  - [39 — Empleados: historial de asistencias en la pestaña "Asistencia"](39-empleado-historial-asistencias.md): el patrón de pestaña como Server Component con un modal cliente encima.
- **Modifica base de datos:** Sí. Se agrega la columna `id_empleado` a `[dbo].[users]`.
- **Fecha:** 2026-09-23
- **Objetivo:** Vincular cada cuenta de `dbo.users` a lo mucho un empleado de `RH.empleados`, y administrar ese vínculo desde una pestaña "Usuarios" en la ficha del empleado.

## Alcance

**Incluye:**

- **Base de datos.** Columna nueva `[id_empleado] INT NULL` en `[CentroPodologico].[dbo].[users]`, con FK a `[RH].[empleados]([id_empleado])` e índice no único. La DDL se deja en `queries.txt`, como el resto de los cambios de esquema (no hay herramienta de migraciones).
- **Ruta** `/dashboard/empleados/[id]/usuarios` (Server Component), cuarta pestaña de la ficha, después de "Asistencia". El acceso de roles 1 y 4 ya lo cubre `proxy.ts` para todo `/dashboard/empleados`; no se agrega gating nuevo.
- **Tabla de usuarios vinculados:** nombre (enlace a `/dashboard/usuarios`), email, rol, sucursal principal, estatus, y un botón "Desvincular" por fila. Lista **todos** los usuarios vinculados, incluidos los que después quedaron en `status = 0`. Estado vacío: "Este empleado no tiene usuarios vinculados".
- **Botón "Vincular usuario"** que abre un modal con buscador por nombre o email sobre los usuarios elegibles, y un botón "Vincular" por fila.
- **Elegibilidad para vincular:** usuarios con el mismo `id_empresa` que el empleado, con `status = 1` y con `id_empleado` nulo. Los ya vinculados a otro empleado no aparecen en el buscador. La sucursal no restringe.
- **Desvincular:** deja `users.id_empleado` en `NULL`. El usuario conserva su acceso, su rol y su sucursal. No se guarda historial.
- **Validación en servidor.** Las dos actions de escritura revalidan las reglas con `zod` antes de tocar la BD: el empleado existe, el usuario existe, ambos son de la misma empresa, el usuario tiene `status = 1` y no está vinculado. La UI no es la única defensa.
- **Columna "Empleado" en `/dashboard/usuarios`:** nombre completo del empleado como enlace a `/dashboard/empleados/{id}`, o "—" si no tiene. Ordenable con el `toggleSort` que ya existe en `usuarios/page.tsx`.
- **`saveUsuario` conserva el vínculo.** Su `UPDATE` lista columnas explícitas, así que editar un usuario no pisa `id_empleado`. Se verifica con un criterio de aceptación.
- **Documentación:** `docs/rh-empleados.md` gana la pestaña y la regla de elegibilidad.

**No incluye (fuera de alcance, para specs futuras):**

- **Cualquier cálculo o reporte que use el vínculo:** comisiones por ventas, consultas o tratamientos, y su entrada a la nómina de la spec 53. Esta spec entrega el cimiento; la atribución va en su propia spec.
- Vincular desde `/dashboard/usuarios` (un `<select>` "Empleado" en `UsuarioModal.tsx`). La administración vive sólo en la ficha del empleado.
- Crear un usuario nuevo desde la ficha del empleado.
- Que el empleado vea sus propios datos al entrar con su usuario (asistencia, recibos): cambia el modelo de permisos.
- Historial de vínculos: quién vinculó, cuándo, y vínculos pasados.
- Filtrar la tabla de usuarios por empleado (sólo se ordena).
- Desvincular en cascada al desactivar un empleado.
- Restringir por `id_role`: se puede vincular un usuario de cualquier rol, incluido el 5.
- Restringir por sucursal.
- Propagar datos entre empleado y usuario (nombre, email, sucursal, estatus): siguen siendo campos independientes.

## Modelo de datos

**La base de datos cambia:** una columna nueva en `dbo.users`. No hay tabla puente.

```sql
-- Spec 55: un usuario pertenece a lo mucho a un empleado.
ALTER TABLE [CentroPodologico].[dbo].[users]
    ADD [id_empleado] [int] NULL
GO

ALTER TABLE [CentroPodologico].[dbo].[users] WITH CHECK
    ADD CONSTRAINT [FK_users_empleado] FOREIGN KEY ([id_empleado])
        REFERENCES [CentroPodologico].[RH].[empleados] ([id_empleado])
GO

-- No único: un empleado puede tener varios usuarios.
CREATE NONCLUSTERED INDEX [IX_users_id_empleado]
    ON [CentroPodologico].[dbo].[users] ([id_empleado])
GO
```

La DDL se agrega al final de `queries.txt`, con el mismo encabezado de comentario que usó la spec 53.

**`interfaces/user.ts`** (se amplía):

```ts
export interface IUser {
  // … campos actuales …
  id_empleado: number | null;   // NULL = la cuenta no pertenece a ningún empleado
}

/** Fila del listado de /dashboard/usuarios: IUser + nombre del empleado por LEFT JOIN. */
export interface IUserListItem extends IUser {
  nombre_empleado: string | null;   // nombre + apellidos, o null si id_empleado es NULL
}

/** Fila de usuario en la pestaña "Usuarios" de la ficha. La usan las dos listas:
 *  los ya vinculados y los elegibles del buscador. */
export interface IEmployeeUserListItem {
  id_user:         number;
  nombre:          string;
  email:           string;
  id_role:         number;
  nombre_role:     string;
  id_sucursal:     number;
  nombre_sucursal: string;
  status:          boolean;
}
```

**`app/dashboard/empleados/[id]/usuarios/schemas.ts`** (archivo nuevo, patrón `app/dashboard/solicitudes/schemas.ts`):

```ts
export const linkUserToEmployeeSchema = z.object({
  id_empleado: z.number().int().positive(),
  id_user:     z.number().int().positive(),
});

// Lleva id_empleado para confirmar que el usuario está vinculado a ESE empleado.
export const unlinkUserFromEmployeeSchema = linkUserToEmployeeSchema;
```

**`app/dashboard/empleados/[id]/usuarios/actions.ts`** (archivo nuevo):

| Action | Devuelve | Qué hace |
|---|---|---|
| `getEmployeeLinkedUsers(id_empleado)` | `IEmployeeUserListItem[]` | Usuarios con `id_empleado = @id_empleado`, sin filtrar por `status`. `ORDER BY nombre`. |
| `getLinkableUsers(id_empleado)` | `IEmployeeUserListItem[]` | Usuarios con `id_empleado IS NULL`, `status = 1` e `id_empresa` igual al del empleado. `ORDER BY nombre`. |
| `linkUserToEmployee(input)` | `ActionResult<null>` | `UPDATE users SET id_empleado = @id_empleado, updated_at = @updated_at WHERE id_user = @id_user AND id_empleado IS NULL`. |
| `unlinkUserFromEmployee(input)` | `ActionResult<null>` | `UPDATE users SET id_empleado = NULL, updated_at = @updated_at WHERE id_user = @id_user AND id_empleado = @id_empleado`. |

Las dos escrituras parsean con `zod`, revalidan contra la BD (empleado existe, misma empresa, `status = 1`, no vinculado) y hacen `revalidatePath` de la pestaña y de `/dashboard/usuarios`.

**Convenciones:**

- Vincular y desvincular escriben `updated_at` con `buildDate(new Date())`, igual que `saveUsuario`.
- El `WHERE` de cada `UPDATE` repite la condición del vínculo (`IS NULL` al vincular, `= @id_empleado` al desvincular). Si dos admins actúan a la vez, el segundo afecta cero filas y recibe `{ ok: false }` en lugar de pisar el vínculo del otro.
- Esta spec no agrega columnas de fecha nuevas, así que las reglas de `CONVERT(varchar…, 120)` sólo aplican a las que ya se leían.

## Plan de implementación

1. **Columna en la base de datos.**
   - Ejecutar el `ALTER TABLE`, el `FOREIGN KEY` y el `CREATE INDEX` de la sección anterior contra `CentroPodologico`.
   - Agregar esa misma DDL al final de `queries.txt`, bajo el comentario `-- Spec 55: …`.

   *Verificación:* `SELECT TOP 1 [id_empleado] FROM [dbo].[users]` devuelve `NULL` para todas las filas. La app sigue funcionando sin cambios de código.

2. **Interfaces y lectura del listado de usuarios.**
   - `interfaces/user.ts`: `id_empleado` en `IUser`, más `IUserListItem` e `IEmployeeUserListItem`.
   - `getUsuarios` (`usuarios/actions.ts`): selecciona `[id_empleado]`, hace `LEFT JOIN [RH].[empleados]` para `nombre_empleado` y devuelve `IUserListItem[]`.
   - `usuarios/page.tsx`: `EMPTY` gana `id_empleado: null` y el estado pasa a `IUserListItem[]`. `UsuarioFila.tsx` recibe el tipo nuevo.
   - **Sin cambios visibles todavía.**

   *Verificación:* `npx tsc --noEmit` sin errores. `/dashboard/usuarios` se ve y funciona igual que antes: alta, edición y cambio de contraseña.

3. **Schemas y server actions de la pestaña.**
   - `app/dashboard/empleados/[id]/usuarios/schemas.ts` con los dos schemas `zod`.
   - `app/dashboard/empleados/[id]/usuarios/actions.ts` con `getEmployeeLinkedUsers`, `getLinkableUsers`, `linkUserToEmployee` y `unlinkUserFromEmployee`, con las revalidaciones contra BD y la condición repetida en el `WHERE` de cada `UPDATE`.

   *Verificación:* `npx tsc --noEmit` sin errores.

4. **Pestaña mínima, sólo lectura.**
   - `app/dashboard/empleados/[id]/usuarios/page.tsx` (Server Component): valida que `id` sea entero positivo, llama a `getEmployeeLinkedUsers` y pinta la tabla (nombre con enlace a `/dashboard/usuarios`, email, rol, sucursal, estatus) o el estado vacío.
   - `EmployeeTabs.tsx`: cuarta entrada "Usuarios", después de "Asistencia".

   *Verificación:* la pestaña aparece en la ficha y muestra "Este empleado no tiene usuarios vinculados". Vinculando una fila a mano con un `UPDATE` en SQL, la tabla la muestra. Con el rol 2, `/dashboard/empleados/{id}/usuarios` redirige a `/dashboard`.

5. **Modal "Vincular usuario"** (usando el skill `frontend-design`).
   - `page.tsx` carga también `getLinkableUsers(id_empleado)` y se la pasa al modal.
   - `componentes/LinkUserModal.tsx` (`"use client"`): botón "Vincular usuario", modal con `createPortal`, input de búsqueda que filtra la lista en el cliente por nombre o email, y un botón "Vincular" por fila que llama a `linkUserToEmployee` y hace `router.refresh()`.
   - Estado vacío del buscador: "No hay usuarios disponibles para vincular".
   - El `message` de un `{ ok: false }` se muestra dentro del modal en un `role="alert"`.

   *Verificación:* vincular un usuario lo saca del buscador y lo mete en la tabla. Un usuario de otra empresa, uno con `status = 0` y uno ya vinculado a otro empleado no aparecen en la lista.

6. **Desvincular** (usando el skill `frontend-design`).
   - `componentes/UnlinkUserButton.tsx` (`"use client"`, un botón por fila): llama a `unlinkUserFromEmployee`, deshabilita mientras corre y hace `router.refresh()`.
   - La tabla de la pestaña sigue siendo Server Component; sólo el botón es cliente.

   *Verificación:* desvincular saca al usuario de la tabla y lo devuelve al buscador del modal. El usuario desvinculado sigue pudiendo iniciar sesión.

7. **Columna "Empleado" en `/dashboard/usuarios`.**
   - `UsuarioFila.tsx`: celda nueva con el `nombre_empleado` como `<Link>` a `/dashboard/empleados/{id_empleado}`, o "—".
   - `usuarios/page.tsx`: encabezado "Empleado" con `toggleSort`, y `"nombre_empleado"` agregado al tipo `SortKey`. Los `null` ordenan al final.

   *Verificación:* la columna muestra el empleado de los usuarios vinculados y "—" en los demás. Ordenar por "Empleado" no rompe las otras columnas. Editar un usuario desde el modal conserva su empleado.

8. **Documentación.**
   - `docs/rh-empleados.md`: sección "Pestaña Usuarios" con la ruta, la regla de elegibilidad, el comportamiento al desactivar un empleado y la nota de que `users.id_empleado` es el cimiento para la atribución de comisiones.

   *Verificación:* `npm run build` compila sin errores.

Cada paso deja el sistema compilando y funcional.

## Criterios de aceptación

**Base de datos**

- [ ] `dbo.users` tiene la columna `id_empleado INT NULL`, la FK `FK_users_empleado` y el índice `IX_users_id_empleado`.
- [ ] Un `UPDATE` con un `id_empleado` inexistente es rechazado por la FK.
- [ ] Todos los usuarios que ya existían quedaron con `id_empleado = NULL` y siguen iniciando sesión igual que antes.
- [ ] La DDL de la spec está en `queries.txt`.

**Permisos y rutas**

- [ ] Los roles 1 y 4 abren `/dashboard/empleados/{id}/usuarios`. Con los roles 2, 3, 5 y 6 la URL redirige a `/dashboard`.
- [ ] Un `id` inexistente o no numérico responde 404 (lo cubre el `notFound()` de `empleados/[id]/layout.tsx`).
- [ ] `linkUserToEmployee` con un usuario de otra empresa devuelve `{ ok: false }` y no escribe en la BD.
- [ ] `linkUserToEmployee` con un `id_user` o un `id_empleado` que no sean enteros positivos falla en el parse de `zod` y devuelve `{ ok: false }`.

**Vincular**

- [ ] El buscador lista sólo usuarios con `id_empresa` igual al del empleado, `status = 1` e `id_empleado` nulo.
- [ ] Escribir en el buscador filtra por nombre y por email, sin distinguir mayúsculas de minúsculas.
- [ ] Vincular un usuario lo saca del buscador y lo muestra en la tabla, sin recargar la página a mano.
- [ ] Un mismo empleado puede tener dos o más usuarios vinculados al mismo tiempo.
- [ ] Un usuario ya vinculado a otro empleado no aparece en el buscador, y si se llama a la action con su `id_user` devuelve `{ ok: false }` sin cambiar el vínculo existente.
- [ ] Se puede vincular un usuario a un empleado con `activo = 0`.
- [ ] Un usuario de otra sucursal de la misma empresa sí aparece en el buscador.

**Desvincular**

- [ ] "Desvincular" deja `id_empleado` en `NULL`, saca al usuario de la tabla y lo devuelve al buscador.
- [ ] El usuario desvinculado conserva su rol, su sucursal y su `status`, y puede iniciar sesión.
- [ ] Desvincular dos veces el mismo usuario (dos pestañas abiertas) deja la segunda llamada en `{ ok: false }` sin afectar filas.
- [ ] Desvincular no escribe ninguna fila de historial en ninguna tabla.
- [ ] Desactivar un empleado (`activo = 0`) no desvincula a sus usuarios.

**Pestaña "Usuarios"**

- [ ] La pestaña aparece cuarta en la ficha, después de "Asistencia", y se marca como activa al abrirla.
- [ ] Sin usuarios vinculados muestra "Este empleado no tiene usuarios vinculados".
- [ ] La tabla muestra nombre, email, rol, sucursal y estatus, y el nombre enlaza a `/dashboard/usuarios`.
- [ ] Un usuario que se vinculó y después quedó en `status = 0` sigue apareciendo en la tabla, con su estatus.

**Listado de `/dashboard/usuarios`**

- [ ] La columna "Empleado" muestra el nombre completo del empleado como enlace a `/dashboard/empleados/{id}`, o "—" si el usuario no tiene empleado.
- [ ] Ordenar por "Empleado" agrupa a los vinculados y manda los "—" al final, sin romper el orden de las demás columnas.
- [ ] Editar un usuario desde `UsuarioModal` (nombre, rol, sucursal, estatus o contraseña) conserva su `id_empleado`.
- [ ] Un usuario creado desde `UsuarioModal` nace con `id_empleado = NULL`.

**Técnico**

- [ ] `empleados/[id]/usuarios/page.tsx` y su tabla son Server Components. Sólo `LinkUserModal.tsx` y `UnlinkUserButton.tsx` llevan `"use client"`.
- [ ] Las cuatro actions usan `db.queryParams`, nunca concatenación de SQL.
- [ ] Las dos actions de escritura parsean con `zod` antes de tocar la BD.
- [ ] Ninguna query de la pestaña devuelve un `Date` de JS.
- [ ] `docs/rh-empleados.md` tiene la sección "Pestaña Usuarios".
- [ ] `npm run build` compila sin errores de TypeScript.

## Decisiones tomadas y descartadas

**Modelo**

- **Sí: una columna `users.id_empleado` nullable.** Un usuario pertenece a lo mucho a un empleado, así que la relación cabe entera en una columna, una FK y un índice. Cero tablas nuevas.
- **No: tabla puente `RH.empleado_usuarios`.** Sólo se justifica si un usuario pudiera pertenecer a varios empleados. Agregaría una tabla, más queries y más pantalla para modelar algo que no ocurre.
- **No: columna `id_user` en `RH.empleados`.** Permitiría un solo usuario por empleado, que es justo lo contrario del requerimiento.
- **Sí: vincular y desvincular escriben `updated_at`.** Es un cambio en la fila del usuario, y deja la marca de "algo se movió aquí" sin necesitar una tabla de historial.
- **Sí: el `UPDATE` repite la condición del vínculo en el `WHERE`.** Cierra la ventana entre validar y escribir sin transacciones ni bloqueos.

**Dónde se administra**

- **Sí: en la ficha del empleado.** Es el patrón que ya usa `RH.empleado_identificadores` en la pestaña "Asistencia": el empleado es el dueño de la relación y sus hijos se administran desde su expediente.
- **No: un `<select>` "Empleado" en `UsuarioModal.tsx`.** Duplicaría la validación de elegibilidad en dos formularios, y dejaría que un guardado de usuario cambiara el vínculo sin querer.
- **Sí: la columna "Empleado" en `/dashboard/usuarios` es sólo lectura y ordenable.** Responde "¿de quién es esta cuenta?" sin abrir otra pantalla, y sin volverse un segundo lugar de edición.
- **No: filtro por empleado en esa tabla.** El orden ya agrupa. Un filtro nuevo obliga a decidir su UI y si se persiste.

**Reglas del vínculo**

- **Sí: elegibilidad por empresa, no por sucursal.** `sucursales_string` permite que un usuario opere en varias sucursales, así que la sucursal no dice de quién es la cuenta.
- **Sí: sólo se vinculan usuarios con `status = 1`.** El `status` es la aprobación de la cuenta; atar un empleado a una cuenta no aprobada vincularía algo que todavía no opera.
- **Sí: la tabla de vinculados muestra también los `status = 0`.** "A quién puedo vincular" y "qué está vinculado hoy" son preguntas distintas. Ocultarlos haría creer que el vínculo se perdió.
- **Sí: se puede vincular a un empleado con `activo = 0`.** Hay que poder corregir el dato de alguien que ya causó baja.
- **Sí: desactivar un empleado no desvincula a sus usuarios.** El vínculo es lo que permitirá atribuirle lo que hizo. Borrarlo en la baja perdería el dato justo cuando el último periodo de nómina lo necesita.
- **Sí: se puede vincular un usuario de cualquier `id_role`, incluido el 5.** El rol dice qué puede hacer la cuenta, no de quién es. Restringirlo obligaría a mantener una lista de roles "de empleado" que se desactualiza sola.
- **No: historial de vínculos.** Obliga a una tabla más y a decidir su retención. Si la atribución de comisiones algún día necesita saber quién era el dueño de una cuenta en marzo, se resuelve en esa spec, con el requisito real enfrente.

**UI**

- **Sí: el buscador filtra en el cliente sobre la lista que la página ya trajo.** El conjunto está acotado por empresa; una action por tecleo agregaría latencia sin ganar nada.
- **No: búsqueda en servidor por tecleo.** Se justificaría con miles de usuarios por empresa. No es el caso, y el paso 5 se puede cambiar después sin tocar el modelo.
- **Sí: desvincular sin diálogo de confirmación.** Es reversible con un clic, no borra datos del usuario y no le quita el acceso. Un `confirm` bloquea y no aporta.
- **Sí: sólo el modal y el botón de desvincular son componentes cliente.** La página y la tabla se quedan de servidor.

**Alcance**

- **Sí: esta spec entrega el vínculo, no la atribución.** Calcular comisiones exige decidir qué tablas llevan `id_user`, la regla de cada concepto y su entrada al cálculo de la spec 53. Son tres dominios distintos; juntos no se revisan bien.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Dos admins vinculan al mismo usuario con dos empleados distintos desde pestañas abiertas a la vez. | El `UPDATE` lleva `AND [id_empleado] IS NULL` en el `WHERE`. El segundo afecta cero filas y recibe `{ ok: false }`. Hay un criterio de aceptación dedicado. |
| Editar un usuario desde `UsuarioModal` pisa `id_empleado` con `NULL`. | El `UPDATE` de `saveUsuario` lista columnas explícitas y no incluye `id_empleado`. El paso 7 lo verifica y hay un criterio de aceptación para eso. |
| `getUsuarios` deja de funcionar por el `LEFT JOIN` nuevo. | El paso 2 agrega el `JOIN` sin cambiar la UI, así que un error se atribuye a la query y no a la columna. El `JOIN` va por `id_empleado`, que es la PK de `RH.empleados`. |
| La lista de elegibles crece y el modal se vuelve pesado. | Está acotada por empresa. Si algún día molesta, el paso 5 se cambia a una action con búsqueda en servidor sin tocar el modelo de datos ni las demás pantallas. |
| Se entiende que el vínculo ya produce comisiones. | El alcance, las decisiones y `docs/rh-empleados.md` dicen explícitamente que la atribución no existe todavía y que `users.id_empleado` es sólo el cimiento. |
| Un empleado con usuarios vinculados se borra de `RH.empleados`. | La FK lo impide. Además, el módulo da de baja con `activo`/`status`, no con `DELETE`. |

## Qué **no** incluye esta spec

- Comisiones, ni ningún cálculo o reporte que use el vínculo, ni su entrada a la nómina de la spec 53.
- Vincular o crear usuarios desde `/dashboard/usuarios`.
- Que el empleado vea sus propios datos al entrar con su usuario.
- Historial de vínculos.
- Filtrar la tabla de usuarios por empleado.
- Desvincular en cascada al desactivar un empleado.
- Restricciones por rol o por sucursal.
- Propagar nombre, email, sucursal o estatus entre el empleado y sus usuarios.

Cada uno de esos, si se hace, va en su propia spec.

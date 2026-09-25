# 59 — Empleados: horario semanal estructurado

## Header

- **Estado:** Implementado
- **Depende de:**
  - [25 — Módulo de Empleados (RH): alta, listado y expediente](25-empleados-alta-listado-detalle.md): `RH.empleados`, `EmployeeModal.tsx`, `EmployeeGeneralInfo.tsx` y las columnas de texto libre `dias_laborales` / `horario`, que esta spec deja de capturar.
  - [39 — Empleados: historial de asistencias](39-empleado-historial-asistencias.md): dejó explícitamente pendiente estructurar el horario, que es requisito previo para calcular retardos y faltas.
  - [55 — Empleados: vincular usuarios del sistema](55-empleado-vincular-usuarios.md): el patrón de pestaña del expediente que se sigue aquí (`[id]/usuarios/` con `page.tsx` Server Component, `actions.ts`, `schemas.ts` y modal cliente).
- **Modifica base de datos:** Sí. Una tabla nueva, `RH.empleado_horarios`. No se modifica ni se borra ninguna columna de `RH.empleados`.
- **Fecha:** 2026-09-25
- **Objetivo:** Capturar, en una pestaña nueva "Horario" del expediente, qué días de la semana trabaja cada empleado y su hora de entrada y salida de cada día (hasta dos bloques por día), sustituyendo en la UI el texto libre `dias_laborales` / `horario`.

## Alcance

**Incluye:**

- **Base de datos:**
  - Tabla nueva `RH.empleado_horarios`: una fila por día trabajado, con hasta dos bloques de entrada y salida. Un día sin fila es día de descanso.
  - El DDL se documenta en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`.
- **Pestaña nueva "Horario"** en el expediente (`app/dashboard/empleados/[id]/horario/`), entre "Asistencia" y "Usuarios" en `EmployeeTabs.tsx`:
  - `page.tsx` es un Server Component. Muestra la semana de lunes a domingo, una fila por día: "Descanso", o bien los bloques (`09:00–14:00` y `16:00–20:00`) con las horas de ese día.
  - Muestra el **total de horas por semana**, calculado sumando los bloques.
  - Si el empleado no tiene horario capturado, muestra "Sin horario definido". Si además tiene texto en `dias_laborales` / `horario`, lo muestra en solo lectura como **"Referencia anterior"**.
  - Un botón "Editar horario" abre `EditScheduleModal.tsx`, que es el único Client Component de la pestaña.
- **Modal de edición (`EditScheduleModal.tsx`):**
  - Por cada día: una casilla "Trabaja", entrada y salida del bloque 1, y un control "Agregar segundo bloque" que muestra entrada y salida del bloque 2. Las horas se capturan con `<input type="time">`.
  - Una acción **"Copiar a todos los días laborales"** en cada día marcado, que copia sus bloques a los demás días marcados.
  - Al guardar se **reemplaza la semana completa** del empleado, sin guardar historial.
- **Server actions** en `[id]/horario/actions.ts`, con esquemas zod en `[id]/horario/schemas.ts`:
  - `getEmployeeSchedule(id_empleado)`.
  - `saveEmployeeSchedule(id_empleado, days)`: valida con zod y reescribe la semana con `DELETE` + `INSERT` dentro de `db.transaction`. Devuelve `ActionResult`.
- **Validación**, en zod y reflejada en el modal:
  - En cada bloque, `salida > entrada`. No se permiten turnos que crucen la medianoche.
  - El bloque 2 empieza después de que termina el bloque 1.
  - El bloque 2 lleva las dos horas o ninguna.
  - `dia_semana` va de 1 a 7 y no se repite.
  - Se permite guardar una semana vacía, que equivale a "sin horario definido".
- **Helper puro** `[id]/horario/scheduleFormatting.ts`, en la línea de `attendancePairing.ts`. Calcula las horas semanales y arma el resumen compacto: días consecutivos con los mismos bloques se agrupan, por ejemplo `Lun–Vie 09:00–18:00 · Sáb 09:00–14:00`.
- **"Datos Personales" (`EmployeeGeneralInfo.tsx`):** las filas "Días laborales" y "Horario" se reemplazan por una fila "Horario" con el resumen compacto (o "Sin horario definido") y un enlace a la pestaña "Horario". `[id]/page.tsx` obtiene el horario en paralelo con `getEmployeeById`.
- **`EmployeeModal.tsx`:** se quitan los inputs "Días laborales" y "Horario".
- **`interfaces/employee.ts` y `app/dashboard/empleados/actions.ts`:**
  - `EmployeeFormInput` excluye `dias_laborales` y `horario`.
  - El `INSERT` y el `UPDATE` dejan de escribir esas dos columnas, así que editar un empleado ya no puede borrar su texto anterior.
  - `IEmployee` las conserva y el SELECT las sigue leyendo, para mostrar la "Referencia anterior".
- **Documentación:** `docs/rh-empleados.md` gana una sección sobre la pestaña "Horario".
- **Acceso:** no hay cambios en `proxy.ts`. La guarda de `/dashboard/empleados` (roles 1 y 4) ya cubre `[id]/horario`, y quien entra a la pestaña puede editar.

**No incluye (queda para specs futuras):**

- Cálculo de retardos, faltas, tolerancias o puntualidad, y cualquier cruce del horario con `RH.asistencias` o con la nómina.
- Historial de horarios y fechas de vigencia: el horario se sobrescribe.
- Turnos que cruzan la medianoche y más de dos bloques por día.
- Relación entre el horario y `id_turno`: el catálogo `RH.turnos` y el select "Turno" siguen igual e independientes.
- Borrar las columnas `dias_laborales` / `horario` de `RH.empleados`, y migrar su texto al formato estructurado. RH recaptura cada horario a mano.
- Mostrar el horario en el listado de empleados (`/dashboard/empleados`) o en `EmployeeHeader.tsx`.
- Horarios por sucursal, excepciones por fecha (festivos, vacaciones) y plantillas de horario reutilizables entre empleados.

## Modelo de datos

**Tabla nueva `RH.empleado_horarios`.** El DDL va en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`, después de `RH.empleado_identificadores`:

```sql
-- Spec 59: horario semanal del empleado. Una fila por día trabajado; día sin fila = descanso.
-- Hasta dos bloques por día (turno partido). Se reescribe completo en cada guardado (sin historial).
CREATE TABLE [RH].[empleado_horarios](
    [id_empleado_horario] [int] IDENTITY(1,1) NOT NULL,
    [id_empleado]         [int]          NOT NULL,
    [dia_semana]          [tinyint]      NOT NULL,   -- ISO: 1 = lunes … 7 = domingo
    [hora_entrada_1]      [time](0)      NOT NULL,
    [hora_salida_1]       [time](0)      NOT NULL,
    [hora_entrada_2]      [time](0)      NULL,
    [hora_salida_2]       [time](0)      NULL,
    [created_at]          [datetime2](0) NULL,       -- momento del guardado que creó la fila (buildDate)
 CONSTRAINT [PK_empleado_horarios] PRIMARY KEY CLUSTERED ([id_empleado_horario] ASC),
 CONSTRAINT [UQ_empleado_horarios_empleado_dia] UNIQUE ([id_empleado], [dia_semana]),
 CONSTRAINT [FK_empleado_horarios_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [CK_empleado_horarios_dia]     CHECK ([dia_semana] BETWEEN 1 AND 7),
 CONSTRAINT [CK_empleado_horarios_bloque1] CHECK ([hora_salida_1] > [hora_entrada_1]),
 CONSTRAINT [CK_empleado_horarios_bloque2] CHECK (
     ([hora_entrada_2] IS NULL AND [hora_salida_2] IS NULL)
  OR ([hora_entrada_2] > [hora_salida_1] AND [hora_salida_2] > [hora_entrada_2]))
) ON [PRIMARY]
GO
```

- El `UNIQUE (id_empleado, dia_semana)` también funciona como índice para leer y borrar la semana de un empleado, así que no hace falta otro índice.
- Los `CHECK` repiten en la BD las reglas de zod. Son la última defensa si algún día otra ruta escribe en la tabla.
- `"El bloque 2 empieza después del bloque 1"` se implementa como `hora_entrada_2 > hora_salida_1`, con desigualdad estricta. Si el bloque 2 empieza exactamente cuando termina el 1, en realidad es un solo bloque.

**Lectura y escritura de horas (regla de strings):**

- En el SELECT, cada columna `time` se lee con `CONVERT(varchar(5), [col], 108)` y llega como `"HH:mm"`. Sin esto, mssql devolvería un `Date`.
- En la escritura, las horas se mandan como string `"HH:mm"` a `queryParams`, que las tipa como `NVarChar`. SQL Server las convierte solo a `time(0)`. Nunca se construye un `Date`.
- `created_at` se llena con `buildDate(new Date())`.

**Interfaz nueva `interfaces/employee_schedule.ts`:**

```ts
/** ISO: 1 = lunes … 7 = domingo. */
export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Un día trabajado de RH.empleado_horarios. Horas siempre "HH:mm", nunca Date. */
export interface IScheduleDay {
  dia_semana:     WeekdayNumber;
  hora_entrada_1: string;
  hora_salida_1:  string;
  hora_entrada_2: string | null;
  hora_salida_2:  string | null;
}

/** Semana del empleado: solo los días trabajados, ordenados por dia_semana. */
export interface IEmployeeSchedule {
  id_empleado: number;
  days:        IScheduleDay[];   // vacío = sin horario definido
  updated_at:  string | null;    // MAX(created_at) de sus filas, "YYYY-MM-DD HH:mm:ss"
}
```

**Esquema zod en `[id]/horario/schemas.ts`**, con esta forma (el detalle se decide al implementar):

```ts
// saveEmployeeScheduleSchema
{
  id_empleado: number,             // int positivo
  days: IScheduleDay[],            // 0..7 elementos, dia_semana único, horas /^\d{2}:\d{2}$/
}                                  // + refine: reglas de bloque 1, bloque 2 y par completo
```

**Cambios en tipos existentes (`interfaces/employee.ts`):**

```ts
// EmployeeFormInput deja de incluir el texto libre:
export type EmployeeFormInput = Omit<
  IEmployee,
  "id_empleado" | "codigo_empleado" | "id_empresa" | "activo" | "status"
  | "created_at" | "updated_at" | "dias_laborales" | "horario"
>;
// IEmployee NO cambia: conserva dias_laborales y horario (lectura para "Referencia anterior").
```

**Constante de días**, en `scheduleFormatting.ts`:

```ts
// 1..7 → { short: "Lun", long: "Lunes" } … { short: "Dom", long: "Domingo" }
```

## Plan de implementación

1. **Base de datos.**
   - Ejecutar contra la BD el `CREATE TABLE [RH].[empleado_horarios]`, con sus constraints.
   - Documentarlo en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`, después de `RH.empleado_identificadores`.
   - Prueba manual:
     - Un `INSERT` válido entra.
     - Un `INSERT` con `hora_salida_1 <= hora_entrada_1` falla por `CK_empleado_horarios_bloque1`.
     - Un `INSERT` con el bloque 2 a medias falla por `CK_empleado_horarios_bloque2`.
     - Al terminar, se borran las filas de prueba.

2. **Tipos y helper puro.**
   - Crear `interfaces/employee_schedule.ts` con `WeekdayNumber`, `IScheduleDay` e `IEmployeeSchedule`.
   - Crear `app/dashboard/empleados/[id]/horario/scheduleFormatting.ts` con:
     - La constante de días (1 a 7 → `Lun`/`Lunes` … `Dom`/`Domingo`).
     - `calculateWeeklyHours(days)`, que devuelve el total en horas con dos decimales.
     - `formatScheduleSummary(days)`, que agrupa días consecutivos con los mismos bloques (`Lun–Vie 09:00–18:00 · Sáb 09:00–14:00`), lista con coma los días no consecutivos (`Lun, Mié, Vie …`) y devuelve `null` si `days` está vacío.
   - Nada lo consume todavía, así que el sistema compila igual.

3. **Server actions y schemas.**
   - Crear `[id]/horario/schemas.ts` con `saveEmployeeScheduleSchema` (zod, con las reglas de validación de la sección Alcance).
   - Crear `[id]/horario/actions.ts` con:
     - `getEmployeeSchedule(id_empleado)`: un SELECT con `CONVERT(varchar(5), …, 108)`, `ORDER BY dia_semana`, y `updated_at` a partir de `MAX(created_at)`.
     - `saveEmployeeSchedule(input)`: valida con zod, confirma que el empleado existe, y dentro de `db.transaction` hace un `DELETE` de sus filas y un `INSERT` por día. Devuelve `ActionResult<IEmployeeSchedule>` y llama a `revalidatePath` sobre `/dashboard/empleados/[id]` y `/dashboard/empleados/[id]/horario`.

4. **Pestaña "Horario" en solo lectura.**
   - Crear `[id]/horario/page.tsx` como Server Component con:
     - La semana de lunes a domingo, con "Descanso" o los bloques de cada día.
     - El total de horas por semana y la fecha de la última actualización.
     - "Sin horario definido" cuando no hay filas, más el bloque "Referencia anterior" si `dias_laborales` / `horario` tienen texto.
   - Agregar la entrada "Horario" en `EmployeeTabs.tsx`, entre "Asistencia" y "Usuarios".
   - Se aplica la skill `frontend-design` con los tokens de color que ya usa el expediente.
   - Prueba manual: con filas insertadas a mano en el paso 1, la pestaña las muestra bien.

5. **Modal de edición.**
   - Crear `[id]/horario/componentes/EditScheduleModal.tsx` (Client Component). Por cada día incluye:
     - Una casilla "Trabaja".
     - Entrada y salida del bloque 1, con `<input type="time">`.
     - "Agregar segundo bloque" y "Quitar segundo bloque".
     - La acción "Copiar a todos los días laborales".
   - Los errores de validación se muestran por día antes de enviar. Si el servidor responde `{ ok: false }`, se muestra `message`.
   - Si se guarda bien, el modal se cierra y se hace `router.refresh()`.
   - Se conecta a `page.tsx` con el botón "Editar horario".

6. **Resumen en "Datos Personales".**
   - `[id]/page.tsx` obtiene `getEmployeeSchedule` en paralelo con `getEmployeeById` (`Promise.all`) y le pasa el horario a `EmployeeGeneralInfo.tsx`.
   - En `EmployeeGeneralInfo.tsx`, las filas "Días laborales" y "Horario" se reemplazan por una sola fila "Horario", con `formatScheduleSummary` o "Sin horario definido" y un enlace a la pestaña.

7. **Dejar de capturar el texto libre.**
   - Quitar `dias_laborales` y `horario` de `EmployeeFormInput` en `interfaces/employee.ts`.
   - En `EmployeeModal.tsx`, quitar los dos inputs y esos campos de `buildEmptyForm()` y `employeeToFormInput()`.
   - En `app/dashboard/empleados/actions.ts`, quitarlos de `buildEmployeeWriteParams`, del `INSERT` de `createEmployee` y del `SET` de `updateEmployee`. Se mantienen en `EMPLOYEE_SELECT_COLUMNS`.
   - Prueba manual: editar un empleado que tiene texto libre y confirmar que el texto sigue en la BD.

8. **Documentación.** Agregar a `docs/rh-empleados.md` una sección "Horario tab (`empleados/[id]/horario/`)" que explique:
   - La tabla y su regla "día sin fila = descanso".
   - Que el guardado reemplaza la semana completa.
   - Que las horas se leen como `"HH:mm"`.
   - Que `dias_laborales` / `horario` quedan como solo lectura heredada.
   - Que retardos y faltas todavía no se calculan.

Cada paso deja el sistema compilando y funcionando.

## Criterios de aceptación

**Base de datos**

- [x] `RH.empleado_horarios` existe en la BD con las columnas, el `UNIQUE`, la FK y los tres `CHECK` del modelo de datos, y está documentada en `queries.txt`.
- [x] Un `INSERT` directo con `hora_salida_1 <= hora_entrada_1`, con el bloque 2 a medias o con `hora_entrada_2 <= hora_salida_1` es rechazado por la BD.
- [x] No se agregó, modificó ni borró ninguna columna de `RH.empleados`.

**Pestaña "Horario"**

- [x] El expediente muestra la pestaña "Horario" entre "Asistencia" y "Usuarios", y abre `/dashboard/empleados/[id]/horario`.
- [x] La pestaña lista los 7 días de lunes a domingo. Los días sin fila dicen "Descanso" y los días trabajados muestran sus bloques en formato `HH:mm–HH:mm`.
- [x] Con un horario L‑V 09:00–18:00 y Sáb 09:00–14:00, el total semanal muestra 50 horas.
- [x] Con un día partido 09:00–14:00 y 16:00–20:00, ese día aporta 9 horas al total.
- [x] Un empleado sin filas muestra "Sin horario definido". Si tiene texto en `dias_laborales` o `horario`, también ve ese texto bajo "Referencia anterior".
- [x] Un empleado con horario capturado no muestra el bloque "Referencia anterior".
- [x] `page.tsx` de la pestaña es un Server Component. El único archivo con `"use client"` en `[id]/horario/` es `EditScheduleModal.tsx`.

**Edición**

- [x] Al desmarcar "Trabaja" en un día y guardar, ese día pasa a "Descanso" y su fila desaparece de la BD.
- [x] "Copiar a todos los días laborales" copia los bloques del día elegido a todos los demás días marcados y no toca los días desmarcados.
- [x] El modal no deja guardar, y señala el día con error, cuando:
  - la salida del bloque es menor o igual que su entrada;
  - el bloque 2 tiene solo una de sus dos horas;
  - el bloque 2 empieza antes o justo cuando termina el bloque 1.
- [x] Si esos mismos casos se envían directo a `saveEmployeeSchedule` (sin pasar por el modal), la acción devuelve `{ ok: false, message }` y no escribe nada.
- [x] Guardar una semana sin días marcados deja al empleado sin filas y la pestaña muestra "Sin horario definido".
- [x] Guardar de nuevo reemplaza la semana completa: nunca quedan filas duplicadas ni días viejos que se desmarcaron.
- [x] Si el `INSERT` falla a mitad de la transacción, el horario anterior del empleado sigue intacto.
- [x] Después de guardar, la pestaña y "Datos Personales" muestran el horario nuevo sin recargar la página a mano.

**Datos Personales y modal de empleado**

- [x] "Datos Personales" ya no muestra las filas "Días laborales" y "Horario" de texto libre. En su lugar hay una sola fila "Horario" con el resumen compacto (por ejemplo `Lun–Vie 09:00–18:00 · Sáb 09:00–14:00`) o "Sin horario definido", y un enlace a la pestaña.
- [x] El modal de alta y edición de empleado ya no tiene los inputs "Días laborales" ni "Horario".
- [x] Al editar y guardar un empleado que tenía texto en `dias_laborales` / `horario`, esas columnas conservan su valor en la BD.
- [x] Un empleado nuevo se crea con `dias_laborales` y `horario` en `NULL`.

**Transversal**

- [x] Ninguna hora ni fecha de esta feature pasa por un objeto `Date`: las horas se leen con `CONVERT(varchar(5), …, 108)` y se escriben como string `"HH:mm"`.
- [x] Los roles distintos de 1 y 4 que intentan entrar a `/dashboard/empleados/[id]/horario` son redirigidos por `proxy.ts`, sin cambios en ese archivo.
- [x] `docs/rh-empleados.md` tiene la sección de la pestaña "Horario".
- [x] `npm run build` (o `tsc --noEmit`) termina sin errores de tipos.

## Decisiones tomadas y descartadas

- **Sí: un horario por día de la semana (1a).** Cada día trabajado tiene sus propias horas. **No:** una sola entrada y salida para todos los días marcados, porque el caso común de un sábado más corto no cabría.
- **Sí: hasta dos bloques por día (2b).** Cubre el turno partido, que el catálogo `RH.turnos` ya anticipa con "Matutino/Vespertino". **No:** un solo bloque, porque dejaría fuera a esos empleados. **No:** bloques ilimitados, porque nadie los pidió y obligarían a mover la regla del máximo al código.
- **Sí: una fila por día, con columnas `_1` y `_2`.** El límite de dos bloques queda en el esquema y cada día se lee en una sola fila. **No:** una fila por bloque con columna `bloque`. Sería más flexible, pero el "máximo dos" quedaría solo en zod y leer un día obligaría a juntar filas.
- **Sí: día sin fila = descanso.** Así no hay filas "vacías" ni una bandera `trabaja` que mantener. **No:** 7 filas fijas por empleado con un flag. Duplicaría el estado y permitiría incoherencias como un día marcado como descanso pero con horas.
- **Sí: `time(0)` en SQL, leído como `"HH:mm"` con `CONVERT(…, 108)`.** Es el tipo correcto para comparar y restar horas, y deja listo el futuro cálculo de retardos. **No:** `varchar(5)`, porque perdería los `CHECK` de orden y la aritmética de horas en SQL. El riesgo de que mssql devuelva un `Date` se evita con el `CONVERT`, igual que en las fechas.
- **Sí: `dia_semana` 1 a 7 con 1 = lunes (ISO).** Es el orden en que RH piensa la semana laboral. **No:** la numeración de `DATEPART(weekday)`, que depende de `@@DATEFIRST` en el servidor.
- **Sí: `CHECK` en la BD además de zod.** Las reglas de bloque son baratas de repetir y protegen si otra ruta escribe en la tabla en el futuro.
- **Sí: turnos que no cruzan la medianoche.** Con esto basta `salida > entrada`. Una clínica no tiene turno nocturno, y soportarlo cambiaría el modelo (bloques con día de salida distinto).
- **Sí: guardar reemplaza la semana completa, `DELETE` + `INSERT` en una transacción, sin historial (5a).** Es lo más simple y el modal siempre edita la semana entera. **No:** vigencias con fecha "desde" y guardar el historial. Prepara mejor el cálculo de retardos de periodos pasados, pero agrega mucha complejidad sin un consumidor hoy (ver Riesgos).
- **Sí: pestaña propia "Horario" con modal de edición (4a).** Una tabla de 7 días con dos bloques saturaría `EmployeeModal.tsx`, que ya es largo. **No:** capturarlo en el modal de alta. **No:** capturarlo en ambos lugares, porque serían dos editores del mismo dato.
- **Sí: dejar de capturar `dias_laborales` / `horario` sin borrar las columnas (3a).** Se conserva lo que ya se capturó como "Referencia anterior" para facilitar la recaptura. **No:** borrar las columnas, que perdería esa información. **No:** mantenerlas como nota editable, porque dejaría dos fuentes de verdad del horario.
- **Sí: quitar esas dos columnas del `INSERT` / `UPDATE` y de `EmployeeFormInput`.** Si solo se quitaran los inputs, el modal seguiría reenviando el valor. Quitarlas del write path garantiza que editar un empleado no borre ni altere el texto heredado.
- **No: migrar automáticamente el texto libre al formato estructurado.** Parsear "Lunes a Sábado" / "09:00 - 18:00" es frágil, el mismo argumento de la spec 39. RH recaptura a mano, con la referencia anterior a la vista.
- **Sí: el horario es independiente de `id_turno`.** Derivar uno del otro implicaría definir rangos horarios por turno, algo que nadie pidió. El select "Turno" sigue igual.
- **Sí: "Copiar a todos los días laborales" y el total de horas semanales (4a y 4b).** El primero ahorra la captura del caso típico L‑V. El segundo sale directo de los datos, sin supuestos.
- **Sí: resumen compacto en "Datos Personales", con enlace a la pestaña (5).** Es donde RH ya espera ver el horario. **No:** quitar la fila sin reemplazo.
- **No: calcular retardos, faltas o tolerancias.** Es otro dominio, conectado con `RH.asistencias` y con la nómina, y merece su propia spec. Esta spec solo deja el horario esperado estructurado para que esa spec sea posible.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| **Sin historial, la futura spec de retardos y faltas evaluaría periodos pasados con el horario actual.** Si un empleado cambia de horario, sus asistencias anteriores quedarían mal evaluadas. | Se documenta en `docs/rh-empleados.md` que el horario no tiene vigencias. La spec de retardos y faltas tendrá que decidir entre agregar vigencias (una migración que conserve las filas actuales como "vigente desde hoy") o evaluar solo hacia adelante. La tabla nueva no bloquea ninguna de las dos opciones. |
| **mssql devuelve las columnas `time` como `Date`** (1970‑01‑01 en UTC), lo que corrompería la hora mostrada. | Todas las lecturas usan `CONVERT(varchar(5), [col], 108)`, y hay un criterio de aceptación que lo verifica. Ningún SELECT de la tabla debe leer las columnas `time` sin convertir. |
| **Texto heredado que ya no coincide con la realidad.** "Referencia anterior" puede mostrar un horario viejo y RH podría recapturarlo sin revisarlo. | El bloque se rotula claramente como "Referencia anterior", en solo lectura, y desaparece en cuanto el empleado tiene horario estructurado. |
| **Guardados simultáneos** de dos usuarios de RH sobre el mismo empleado. | La transacción `DELETE` + `INSERT` es atómica y el `UNIQUE (id_empleado, dia_semana)` impide duplicados. En el peor caso gana el último guardado completo, algo aceptable sin historial. No se agrega control optimista. |
| **Periodo de convivencia:** los empleados sin recapturar muestran "Sin horario definido" en "Datos Personales" aunque antes tenían texto. | Es el comportamiento esperado de 3a. La pestaña muestra el texto anterior para agilizar la recaptura. |

## Lo que **no** está en esta spec

- Cálculo de retardos, faltas, tolerancias o puntualidad, y cualquier cruce del horario con `RH.asistencias` o con la nómina.
- Historial de horarios y fechas de vigencia.
- Turnos que cruzan la medianoche y más de dos bloques por día.
- Relación entre el horario y `id_turno`.
- Borrar `dias_laborales` / `horario` de `RH.empleados`, o migrar su texto automáticamente.
- Mostrar el horario en el listado de empleados o en `EmployeeHeader.tsx`.
- Horarios por sucursal, excepciones por fecha (festivos, vacaciones) y plantillas de horario reutilizables.

Si alguno de estos puntos entra, va en su propia spec.

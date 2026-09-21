# 54 — Nómina: detalle individual de percepciones por empleado

## Header

- **Estado:** Implementado
- **Depende de:**
  - [53 — Nómina: cálculo del salario](53-nomina-calculo-salario.md): el detalle lee el snapshot `payroll.period_employees` y cuelga de `/dashboard/nomina/procesar`.
  - [52 — Nómina: periodos de nómina](52-nomina-periodos.md): periodo, sucursal y estatus.
- **Modifica base de datos:** No.
- **Fecha:** 2026-09-21
- **Objetivo:** Crear la pantalla `/dashboard/nomina/procesar/[id_empleado]`, donde los roles 1 y 4 ven las percepciones calculadas de un empleado en un periodo y tipo de nómina (hoy solo "Sueldo base"), con navegación al empleado anterior y siguiente.

Referencia de diseño: `references/nomina/nomina_detalle.html` (solo la tarjeta del empleado y la columna de percepciones).

## Alcance

**Incluye:**

- **Ruta** `/dashboard/nomina/procesar/[id_empleado]?periodo=ID&tipo=operativa|fiscal&puesto=&q=` (Server Component).
  - `periodo` es obligatorio. Si falta, o si el periodo no existe o es de otra sucursal, se llama a `notFound()`.
  - `tipo` vale `operativa` por defecto. `puesto` y `q` solo se conservan para "Regresar" y para Anterior / Siguiente.
  - Si el `id_empleado` no existe en `RH.empleados` o es de otra sucursal, también se llama a `notFound()`.
  - El acceso es para los roles 1 y 4: `proxy.ts` ya cubre `/dashboard/nomina/*` y la action usa `assertPayrollAccess()`.
- **Encabezado:**
  - breadcrumb "Nómina › Procesar Nómina › Detalle individual" (el segundo nivel es un enlace);
  - título "Detalle de Nómina" y badge con el código del periodo;
  - botón "Regresar" a `/dashboard/nomina/procesar` con los mismos `periodo`, `tipo`, `puesto` y `q`;
  - botones "Anterior" y "Siguiente".
- **Toggle Operativa | Fiscal** dentro del detalle, guardado en la URL (`tipo`).
- **Tarjeta del empleado:**
  - foto (`foto_url`, con iniciales si no hay), nombre completo, código, puesto y badge de estatus (Activo/Inactivo);
  - salario diario del snapshot del tipo seleccionado;
  - rango del periodo (`fecha_inicio – fecha_fin`) y fecha de pago.
- **Tarjeta "Percepciones totales":**
  - encabezado con el total de percepciones y el conteo de conceptos ("1 concepto");
  - una línea "Sueldo base" con la descripción "N días × $X.XX diarios" y el importe a la derecha;
  - si `fecha_ingreso > fecha_inicio`, la nota "Ingresó el DD/MM/AAAA, proporcional".
  - Las líneas se construyen desde una lista de conceptos, así que agregar otro concepto no cambia el layout.
- **Anterior / Siguiente:**
  - se navega entre los empleados del snapshot del mismo periodo y tipo, en el orden de la tabla de Procesar (apellido paterno, materno, nombre, `id_empleado`) y con los filtros `puesto` y `q` aplicados;
  - en los extremos el botón se ve deshabilitado;
  - si el empleado actual no está en el snapshot del tipo, no hay Anterior ni Siguiente.
- **Estados:**
  - Periodo en estatus 1: aviso "Esta nómina aún no se calcula" con enlace a Procesar. No se muestra la tarjeta de percepciones.
  - Empleado sin fila en el tipo seleccionado (estatus 2): aviso "Este empleado no está en la nómina {operativa|fiscal} de este periodo". El toggle y la tarjeta del empleado siguen visibles, y el salario diario muestra "—".
- **Enlace desde Procesar:** en `PayrollEmployeesTable`, el nombre del empleado se vuelve un `<Link>` al detalle y se agrega una columna final con un ícono "Ver detalle". El enlace conserva `periodo`, `tipo`, `puesto` y `q`. La tabla sigue siendo Server Component.
- **Reuso:** se extrae el avatar con iniciales de `EmployeeHeader.tsx` a un componente compartido, que usan tanto la ficha de empleado como el detalle de nómina.
- **Documentación:** se agrega a `docs/nomina.md` la ruta del detalle y sus estados.

**No incluye (fuera de alcance, para specs futuras):**

- Cualquier percepción distinta del salario base: bonos de puntualidad y asistencia, comisiones, horas extra, prima vacacional, aguinaldo y despensa. Tampoco su captura manual ni una tabla de conceptos por empleado.
- La clave SAT de la percepción (catálogo `payroll.perceptions`).
- Deducciones y retenciones (ISR, IMSS, faltas, retardos, préstamos), el neto y la nota de cuota patronal.
- La separación transferencia/efectivo, el subtotal en efectivo y los datos bancarios.
- "Exportar recibo", "Firmar digitalmente", "Ver recibo imprimible", "Dispersar nómina", el pie de firma biométrica y el badge "Huella digital verificada".
- La vista del propio empleado (podólogo) de su salario y comisiones: sigue siendo solo para los roles 1 y 4.
- Editar montos desde el detalle.
- No se muestran columnas ni tarjetas vacías o con "próximamente".

## Modelo de datos

**La base de datos no cambia.** El detalle solo lee:

- `payroll.period_employees`, el snapshot de la spec 53;
- `payroll.periods`;
- `RH.empleados` y `RH.puestos`.

**`interfaces/payroll_calculation.ts`** (se amplía). Todas las fechas son `string`.

```ts
// Una línea de la tarjeta "Percepciones totales". Hoy solo existe "sueldo_base".
export interface IPayrollPerceptionLine {
  key:         string;          // identificador estable, se usa como React key: "sueldo_base"
  label:       string;          // "Sueldo base"
  description: string;          // "15 días × $333.33 diarios"
  note:        string | null;   // "Ingresó el 22/09/2026, proporcional" o null
  amount:      number;          // importe ya redondeado a 2 decimales
}

export interface IPayrollEmployeeDetailFilters {
  idEmpleado:  number;
  idPeriod:    number;          // obligatorio: sin periodo se llama a notFound()
  payrollType: PayrollType;
  idPuesto:    number | null;   // solo para Anterior / Siguiente y Regresar
  search:      string;          // ídem
}

export interface IPayrollEmployeeDetail {
  period:   IPayrollPeriodRow;  // de interfaces/payroll_period.ts
  employee: {
    id_empleado:     number;
    codigo_empleado: string;
    nombre_completo: string;
    nombre_puesto:   string;
    foto_url:        string | null;
    activo:          boolean;
    fecha_ingreso:   string;    // "YYYY-MM-DD"
  };
  // Fila del snapshot para el tipo pedido; null si el empleado no está en esa nómina
  // (o si el periodo sigue en estatus 1).
  snapshot: {
    salario_diario:  number;
    dias:            number;
    importe_salario: number;
    calculated_at:   string;    // "YYYY-MM-DD HH:mm:ss"
  } | null;
  perceptions:      IPayrollPerceptionLine[];   // [] si snapshot es null
  totalPerceptions: number;                     // suma de perceptions[].amount
  navigation: {
    previousEmployeeId: number | null;
    nextEmployeeId:     number | null;
  };
}
```

**`lib/payroll/perceptionLines.ts`** (archivo nuevo, funciones puras sobre strings `"YYYY-MM-DD"`):

- `buildPerceptionLines(snapshot, fechaIngreso, fechaInicio)` devuelve `IPayrollPerceptionLine[]`. Hoy devuelve una sola línea `sueldo_base`, con `amount = snapshot.importe_salario`. La `note` se llena solo si `fechaIngreso > fechaInicio`.
- Cuando existan bonos o comisiones, se agregan aquí como nuevas líneas. La pantalla no cambia.

**`lib/payroll/processUrls.ts`** (archivo nuevo, funciones puras):

- `buildPayrollProcessHref({ idPeriod, payrollType, idPuesto, search })` devuelve `/dashboard/nomina/procesar?...`. La usa "Regresar".
- `buildPayrollEmployeeDetailHref(idEmpleado, { idPeriod, payrollType, idPuesto, search })` devuelve `/dashboard/nomina/procesar/{id}?...`. La usan la tabla y Anterior / Siguiente.
- Los parámetros vacíos o `null` no se escriben en la URL.

**`app/dashboard/empleados/componentes/EmployeeAvatar.tsx`** (componente nuevo, de servidor):

- Recibe `{ fotoUrl, nombreCompleto, sizeClassName }`.
- Muestra la foto o, si no hay, las iniciales. `getInitials` se mueve aquí desde `EmployeeHeader.tsx`.
- Se reusa `EmployeeStatusBadge`, que ya existe en esa carpeta, para el badge Activo/Inactivo.

## Plan de implementación

1. **Extraer `EmployeeAvatar`.**
   - Crear `app/dashboard/empleados/componentes/EmployeeAvatar.tsx` con `getInitials`, que se mueve desde `EmployeeHeader.tsx`.
   - Hacer que `EmployeeHeader.tsx` lo use, sin cambiar su aspecto.

   *Verificación:* la ficha `/dashboard/empleados/[id]` se ve igual, con foto y sin foto (iniciales). `tsc --noEmit` sin errores.

2. **Tipos y lógica pura.**
   - Ampliar `interfaces/payroll_calculation.ts` con `IPayrollPerceptionLine`, `IPayrollEmployeeDetailFilters` e `IPayrollEmployeeDetail`.
   - Crear `lib/payroll/perceptionLines.ts` (`buildPerceptionLines`) y `lib/payroll/processUrls.ts` (`buildPayrollProcessHref`, `buildPayrollEmployeeDetailHref`).

   *Verificación manual con un script temporal en el scratchpad:*
   - con snapshot `{ salario_diario: 333.33, dias: 15, importe_salario: 4999.95 }`, ingreso `2025-01-10` e inicio `2026-09-16`, devuelve una línea `sueldo_base` con la descripción "15 días × $333.33 diarios", `note: null` y `amount: 4999.95`;
   - con ingreso `2026-09-22` e inicio `2026-09-16`, la `note` es "Ingresó el 22/09/2026, proporcional";
   - `buildPayrollEmployeeDetailHref(7, { idPeriod: 3, payrollType: "F", idPuesto: null, search: "" })` devuelve `/dashboard/nomina/procesar/7?periodo=3&tipo=fiscal`.

3. **Server action de lectura `getPayrollEmployeeDetail(filters)`** en `app/dashboard/nomina/procesar/actions.ts`:
   - Llama a `assertPayrollAccess()` y resuelve el periodo con `resolvePeriod(id_sucursal, idPeriod)`, que ya existe.
   - Lee al empleado de `RH.empleados` + `RH.puestos`. Cuenta como encontrado si su `id_sucursal` es la del periodo o si tiene alguna fila en el snapshot del periodo (cubre a quien cambió de sucursal después del cálculo).
   - Lee la fila del snapshot del `tipo`.
   - Calcula `previousEmployeeId` y `nextEmployeeId` con `LAG`/`LEAD` sobre el snapshot del periodo y tipo, con los filtros `puesto` y `q` y el mismo `ORDER BY` de la tabla.
   - Extrae a un helper privado del archivo el armado de condiciones de puesto y búsqueda que hoy vive dentro de `getPayrollProcessPage`, para que ambas actions filtren igual.
   - Arma `perceptions` y `totalPerceptions` con `buildPerceptionLines`.
   - Devuelve `ActionResult<IPayrollEmployeeDetail | null>`: `null` si el periodo o el empleado no se encuentran.
   - Fechas con `CONVERT(varchar(10|19), …, 120)` y montos convertidos a `number`.

   *Verificación:* `tsc --noEmit` sin errores. `getPayrollProcessPage` sigue filtrando igual en la pantalla de Procesar.

4. **Página mínima** `app/dashboard/nomina/procesar/[id_empleado]/page.tsx` (Server Component):
   - lee `params` y `searchParams`, y valida `id_empleado` y `periodo` como enteros positivos (si no, `notFound()`);
   - llama a la action y hace `notFound()` si devuelve `null`;
   - muestra el `message` en un `role="alert"` si `ok` es `false`;
   - renderiza el breadcrumb, el título, el badge con el código del periodo y el botón "Regresar" con `buildPayrollProcessHref`.

   *Verificación:* abrir la URL a mano con un empleado calculado muestra el encabezado. Un `periodo` de otra sucursal o un `id_empleado` inexistente dan 404. Con el rol 2, la ruta redirige a `/dashboard`.

5. **Tarjetas del detalle** (usando el skill `frontend-design`, con base en `nomina_detalle.html`). Los componentes van en `app/dashboard/nomina/procesar/[id_empleado]/componentes/` y todos son de servidor:
   - `PayrollEmployeeProfileCard`: `EmployeeAvatar`, nombre, código, puesto, `EmployeeStatusBadge`, salario diario (o "—") y rango y fecha de pago del periodo, con `formatPeriodRange` y `formatPeriodDate`;
   - `PayrollPerceptionsCard`: encabezado con el total y el conteo de conceptos, y una fila por `IPayrollPerceptionLine` con `key={line.key}`;
   - montos con `formatPayrollCurrency`.

   *Verificación:* con un periodo en estatus 2, el detalle de un empleado muestra "Sueldo base" con el importe igual al de la tabla de Procesar.

6. **Toggle y navegación** (usando el skill `frontend-design`), en componentes de servidor hechos con `<Link>`, sin `"use client"`:
   - `PayrollTypeToggle`: Operativa | Fiscal, conservando `periodo`, `puesto` y `q`;
   - `PayrollEmployeeNavigation`: Anterior / Siguiente con `buildPayrollEmployeeDetailHref`, y en los extremos un `<span aria-disabled="true">` con estilo deshabilitado.

   *Verificación:* Anterior / Siguiente recorren a los empleados en el orden de la tabla. Con `puesto` en la URL solo recorren ese puesto. El toggle cambia la línea y el salario diario.

7. **Estados.** En `page.tsx`:
   - periodo en estatus 1: aviso "Esta nómina aún no se calcula" con enlace a Procesar, sin tarjeta de percepciones ni navegación;
   - `snapshot === null` en estatus 2: aviso "Este empleado no está en la nómina {operativa|fiscal} de este periodo", con el toggle y la tarjeta del empleado visibles y sin Anterior / Siguiente.

   *Verificación:* un empleado sin `salario_diario_fiscal` muestra el aviso con `tipo=fiscal` y su detalle normal con `tipo=operativa`.

8. **Enlace desde la tabla de Procesar.**
   - `PayrollEmployeesTable` recibe `idPeriod`, `idPuesto` y `search` (además del `payrollType` que ya recibe).
   - El nombre del empleado se vuelve un `<Link>` con `buildPayrollEmployeeDetailHref`.
   - Se agrega una columna final sin título visible (`<span className="sr-only">Acciones</span>`) con un ícono "Ver detalle" (`aria-label`). El `colSpan` de la fila vacía y del pie se ajusta.
   - `procesar/page.tsx` le pasa los filtros.

   *Verificación:* desde Procesar con filtros, abrir un empleado y pulsar "Regresar" vuelve a la misma vista filtrada.

9. **Documentación.** En `docs/nomina.md`, agregar una sección "Detalle por empleado": ruta, parámetros, qué muestra, estados, orden de Anterior / Siguiente y `buildPerceptionLines` como el lugar donde se agregan conceptos nuevos.

   *Verificación:* `npm run build` sin errores.

Cada paso deja el sistema compilando y funcional.

## Criterios de aceptación

**Permisos y rutas**

- [x] Los roles 1 y 4 pueden abrir `/dashboard/nomina/procesar/{id_empleado}?periodo={id}`. Con los roles 2, 3, 5 y 6, la URL redirige a `/dashboard`.
- [x] Si un rol distinto de 1 o 4 llama a `getPayrollEmployeeDetail`, recibe `{ ok: false }` y no se lee nada.
- [x] Sin `periodo`, con un `periodo` de otra sucursal o inexistente, o con un `id_empleado` inexistente o no numérico, la página responde 404.
- [x] Un empleado que cambió de sucursal después del cálculo sigue abriendo su detalle en ese periodo.

**Entrada y salida**

- [x] En la tabla de Procesar, el nombre de cada empleado y el ícono "Ver detalle" abren su detalle con el mismo `periodo` y `tipo`.
- [x] Si Procesar tenía `puesto` y `q`, el detalle los conserva, y "Regresar" vuelve a `/dashboard/nomina/procesar` con los mismos `periodo`, `tipo`, `puesto` y `q`.
- [x] La tabla de Procesar mantiene su fila de totales y su mensaje de "sin resultados" alineados después de agregar la columna.

**Contenido**

- [x] La tarjeta del empleado muestra foto (o iniciales si no hay `foto_url`), nombre, código, puesto, badge Activo/Inactivo, salario diario del tipo seleccionado, rango del periodo y fecha de pago.
- [x] Un empleado quincenal con `salario_diario = 333.33` en el periodo `2026-09-16 – 2026-09-30` muestra una línea "Sueldo base" con "15 días × $333.33 diarios" y `$4,999.95`. El encabezado dice "1 concepto" y "Percepciones totales $4,999.95".
- [x] Un empleado que ingresó el `2026-09-22` en ese periodo muestra "9 días × …" y la nota "Ingresó el 22/09/2026, proporcional". Uno con ingreso anterior al periodo no muestra nota.
- [x] El importe de "Sueldo base" en el detalle es idéntico al de la columna Sueldo de Procesar, para el mismo periodo y tipo.
- [x] No aparecen deducciones, neto, transferencia/efectivo, clave SAT, botones de exportar, firmar o dispersar, ni ninguna tarjeta o columna vacía.

**Operativa | Fiscal**

- [x] El toggle cambia el salario diario, la línea de sueldo y el total, y queda en la URL (`tipo`).
- [x] Un empleado con `salario_diario_fiscal` `NULL` o `0` muestra, con `tipo=fiscal`, el aviso "Este empleado no está en la nómina fiscal de este periodo", la tarjeta del empleado con salario "—" y sin Anterior / Siguiente. Con `tipo=operativa` muestra su detalle normal.

**Anterior / Siguiente**

- [x] Anterior / Siguiente recorren a los empleados en el mismo orden que la tabla de Procesar para ese periodo y tipo.
- [x] Con `puesto` o `q` en la URL, solo se recorren los empleados que cumplen esos filtros.
- [x] En el primer empleado "Anterior" se ve deshabilitado y no es un enlace. En el último pasa lo mismo con "Siguiente".

**Estados**

- [x] Con el periodo en estatus 1, el detalle muestra "Esta nómina aún no se calcula" con un enlace a Procesar, sin tarjeta de percepciones ni navegación.
- [x] Después de "Recalcular" con un salario nuevo en la ficha, el detalle muestra el importe nuevo. Antes de recalcular, muestra el del snapshot.

**Técnico**

- [x] `page.tsx` y todos los componentes de `procesar/[id_empleado]/componentes/` son Server Components: ninguno lleva `"use client"`.
- [x] La ficha `/dashboard/empleados/[id]` usa `EmployeeAvatar` y se ve igual que antes.
- [x] Ninguna query de `getPayrollEmployeeDetail` devuelve un `Date` de JS, y las fechas mostradas coinciden con la BD, sin corrimiento de un día.
- [x] `docs/nomina.md` tiene la sección "Detalle por empleado".
- [x] `npm run build` compila sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Sí: el detalle muestra solo las percepciones que ya existen (hoy, "Sueldo base").** La nómina solo calcula el salario (spec 53). Inventar bonos o comisiones sin su regla de cálculo produciría montos que nadie validó.
- **No: capturar a mano bonos y comisiones en esta spec.** Requiere una tabla de conceptos por empleado, permisos de edición y auditoría. Es otra spec.
- **No: calcular bonos y comisiones con las reglas del reglamento.** Dependen de asistencias, tratamientos vendidos y parámetros configurables, que son dominios propios. Cada uno merece su spec.
- **Sí: las líneas salen de `buildPerceptionLines` como lista de conceptos.** La pantalla ya itera una lista. Agregar un bono en el futuro es agregar una línea en `lib/payroll/perceptionLines.ts`, sin tocar el layout.
- **Sí: ruta `/dashboard/nomina/procesar/[id_empleado]?periodo=ID&tipo=…`.** Es la que la spec 53 dejó reservada, se lee bien y el toggle y los filtros viven en la URL, igual que en Procesar.
- **No: `/procesar/detalle/[id_period_employee]`.** El id cambia en cada Recalcular (el snapshot se borra y se reinserta), así que un enlace guardado dejaría de funcionar. Además, el toggle O/F apuntaría a otra fila.
- **Sí: `periodo` obligatorio, con `notFound()` si falta.** El detalle no tiene sentido sin periodo, y adivinar el "actual" podría mostrar otro periodo distinto al que venía viendo el usuario.
- **Sí: el toggle Operativa | Fiscal dentro del detalle.** Es el mismo modelo mental de Procesar.
- **No: operativa y fiscal lado a lado.** Duplicaría cada concepto futuro y crecería mal cuando cada tipo tenga conceptos propios.
- **Sí: el empleado cuenta como encontrado si es de la sucursal del periodo o si tiene snapshot en el periodo.** Si alguien cambia de sucursal después del cálculo, su nómina ya calculada debe seguir visible.
- **Sí: Anterior / Siguiente siguen el orden de la tabla y respetan `puesto` y `q`.** Es lo que el usuario ve antes de entrar. Así puede revisar "todos los podólogos" uno por uno sin volver a la tabla.
- **Sí: `LAG`/`LEAD` en SQL para Anterior / Siguiente.** Es una sola query y no trae toda la lista de empleados al servidor de Next.
- **Sí: se comparte el armado de filtros de puesto y búsqueda entre `getPayrollProcessPage` y `getPayrollEmployeeDetail`.** Si divergen, Anterior / Siguiente recorrería un conjunto distinto al de la tabla.
- **Sí: sin componentes cliente; el toggle y la navegación son `<Link>`.** No hay estado local que justifique `"use client"`, y la URL ya es la fuente de verdad.
- **Sí: el enlace desde la tabla va en el nombre y en una columna de ícono, no en toda la fila.** Mantiene la tabla como Server Component y es accesible por teclado y lector de pantalla.
- **No: fila clickeable completa.** Requiere JS en el cliente o trucos de CSS, y no se anuncia como enlace.
- **Sí: extraer `EmployeeAvatar` a `empleados/componentes/`.** La ficha de empleado y el detalle de nómina muestran el mismo avatar con iniciales. Copiar `getInitials` duplicaría la lógica.
- **No: mostrar la clave SAT (`001`) de la percepción.** `payroll.perceptions` no tiene PK ni se consume en ningún lado, y la clave importa hasta que exista el CFDI.
- **No: deducciones, neto, transferencia/efectivo, recibo, firma y dispersión.** No existen en la BD. Mostrar columnas vacías o con "próximamente" repite lo que las specs 52 y 53 ya descartaron.
- **No: la vista del propio empleado.** El reglamento lo contempla, pero cambia el modelo de permisos (roles 2 y 3 dentro de `/dashboard/nomina`) y merece su propia spec.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Anterior / Siguiente recorre un conjunto o un orden distinto al de la tabla de Procesar. | El filtro de puesto y búsqueda sale de un helper compartido, y el `ORDER BY` es el mismo (`apellido_paterno, apellido_materno, nombre, id_empleado`, que es determinista gracias al `id`). Hay un criterio de aceptación dedicado. |
| El detalle muestra un importe distinto al de la tabla. | Ambos leen `importe_salario` del snapshot, sin recalcular en TS. `buildPerceptionLines` usa el `amount` tal cual. |
| La nota de ingreso proporcional se desfasa un día por UTC. | Se comparan strings `"YYYY-MM-DD"` (`fecha_ingreso > fecha_inicio`) sin `new Date()`, y la fecha se formatea con los helpers de `lib/payroll/periodFormat.ts`. |
| Un enlace guardado apunta a un periodo que después se revirtió a estatus 1. | Se muestra el aviso "Esta nómina aún no se calcula" con enlace a Procesar, en lugar de un error o un 404. |
| Al agregar la columna "Ver detalle" se desalinean la fila vacía y el pie de `PayrollEmployeesTable`. | El paso 8 ajusta los `colSpan`, y hay un criterio de aceptación para eso. |
| Extraer `EmployeeAvatar` cambia el aspecto de la ficha de empleado. | Es un paso propio (paso 1), con verificación visual antes de seguir. El tamaño se pasa por `sizeClassName` para conservar el `w-40 h-40` actual. |

## Qué **no** incluye esta spec

- Bonos, comisiones, horas extra, prima vacacional, aguinaldo y despensa (ni calculados ni capturados a mano).
- La clave SAT de las percepciones.
- Deducciones, retenciones y neto.
- La separación transferencia/efectivo y los datos bancarios.
- Recibo imprimible, exportar, firma digital y dispersión.
- La vista del propio empleado de su nómina.
- La edición de montos desde el detalle.

Cada uno de esos, si se hace, va en su propia spec.

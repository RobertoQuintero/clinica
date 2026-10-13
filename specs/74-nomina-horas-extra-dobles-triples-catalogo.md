# 74 — Nómina: horas extra dobles y triples separadas en el catálogo

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [69 — Parámetros fiscales](69-nomina-parametros-fiscales-isr.md): el catálogo `payroll.perceptions` con `CK_perceptions_exencion`, `getPerceptions` y la pestaña Percepciones.
  - [73 — Motor gravado/exento](73-nomina-motor-gravado-exento.md): `PERCEPTION_LINE_KEY_BY_ID`, `SALARY_PERCEPTION_ID` y el aviso "Recalcula", que compara contra el catálogo.
  - [61 — Pago de horas extra](61-nomina-horas-extra-pago.md): las claves `horas_extra_dobles` y `horas_extra_triples` de `buildPerceptionLines`.
- **Modifica base de datos:** Sí, solo datos (no cambia el esquema).
  - `payroll.perceptions`: la percepción 5 se renombra a "Horas extra dobles".
  - `payroll.perceptions`: fila nueva 13, "Horas extra triples", clave `019`, tipo `'N'`.
- **Fecha:** 2026-10-13
- **Objetivo:** Separar en el catálogo `payroll.perceptions` las horas extra dobles (id 5, 50% exento con tope de 5 UMA por semana) de las triples (id 13 nuevo, 100% gravadas). Así, la spec de horas extra fiscales solo tendrá que generar sus líneas.
- **Reglas de origen:** LISR art. 93 fr. I (solo las horas dentro del límite legal, que son las dobles, tienen exención), el catálogo `c_TipoPercepcion` (clave `019`) y `references/nomina/reglas_modulo_nomina.md` (2.4).

## Alcance

**Incluye:**

- **Datos del catálogo.** El script se documenta en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 73. Es idempotente: se puede correr dos veces sin duplicar ni fallar.
  - `UPDATE` de `id_perception = 5`: `description` pasa de "Horas extras" a "Horas extra dobles". Su regla (`'M'`, 50%, 5 UMA, `'S'`) no cambia.
  - `INSERT` de `id_perception = 13`, solo si no existe:
    - `clave_sat = '019'`, `description = 'Horas extra triples'`, `tipo_limite_exencion = 'N'` y las demás columnas de la regla en `NULL`;
    - `is_billed` y `status` copiados de la percepción 5;
    - `id_taxed_exempt` = el id de "Gravado" en `payroll.cat_taxed_exempt`, verificado antes de correr el script.
  - Antes del `INSERT` se verifica que el id 13 esté libre. Si está ocupado por otra percepción, el script se detiene y el id se decide a mano: nunca se pisa una fila.
- **Constantes** (`lib/payroll/constants.ts`):
  - `OVERTIME_DOUBLE_PERCEPTION_ID = 5` y `OVERTIME_TRIPLE_PERCEPTION_ID = 13`.
  - `PERCEPTION_LINE_KEY_BY_ID` gana `5: "horas_extra_dobles"` y `13: "horas_extra_triples"` (las claves que ya usa `buildPerceptionLines` desde la spec 61). Hoy no tienen efecto, porque ningún renglón `'F'` lleva horas extra.
- **Orden del catálogo.** `getPerceptions` ordena por `clave_sat, id_perception`, para que las dobles y las triples (las dos `019`) salgan juntas en la pestaña Percepciones.
- **Edición.** La percepción 13 se edita con el `PerceptionModal` existente, como cualquier otra. No se bloquea su regla.
- **Documentación:**
  - `docs/nomina.md`: en la sección de la spec 69, la lista "Captured so far" pasa a dobles `'M'` (id 5) y triples `'N'` (id 13). En la sección de la spec 73, se quita la separación de dobles y triples de los pendientes.
  - `references/nomina/reglas_modulo_nomina.md` (2.4): se anota qué id del catálogo corresponde a cada tipo de hora.

**No incluye (para otras specs):**

- **Horas extra en la nómina fiscal:** pagarlas en los renglones `'F'`, generar sus líneas en `#fiscal_perception_lines` y repartir dobles y triples por semana sobre el periodo fiscal.
- **El nodo `HorasExtra` del CFDI** (`Dias`, `TipoHoras`, `HorasExtra`, `ImportePagado`) y el timbrado.
- **Horas extra simples** (`TipoHoras = 03`) y la exención del trabajador de salario mínimo.
- **Pantalla de alta de percepciones.** El catálogo sigue sin botón "Nueva"; las filas nuevas entran por script.
- **Bloquear la regla** de una percepción con regla legal fija.
- **Cambios en la nómina operativa:** las etiquetas "Horas extra dobles" y "Horas extra triples" del Detalle no cambian.

## Modelo de datos

**Sin cambios de esquema.** No hay tablas, columnas ni restricciones nuevas. Solo cambian dos filas de `payroll.perceptions`.

**Script de datos.** Se documenta en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 73. `@id_gravado` se resuelve en el paso 1 del plan, leyendo `payroll.cat_taxed_exempt`; no se adivina.

```sql
-- Spec 74: horas extra dobles (5) y triples (13) separadas en el catálogo. Idempotente.
SET XACT_ABORT ON;
BEGIN TRAN;

DECLARE @id_gravado smallint = /* id de "Gravado" en payroll.cat_taxed_exempt, verificado en el paso 1 */;

-- La 5 tiene que ser la de horas extra; si no, nada de esto aplica.
IF NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[perceptions]
                WHERE [id_perception] = 5 AND [clave_sat] = '019' AND [tipo_limite_exencion] = 'M')
    THROW 50074, 'La percepción 5 no es la de horas extra (019, M). Revisa el catálogo antes de seguir.', 1;

-- El 13 está libre o ya es la de horas extra triples (segunda corrida); nunca se pisa otra fila.
IF EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[perceptions]
            WHERE [id_perception] = 13
              AND NOT ([clave_sat] = '019' AND [description] = 'Horas extra triples'))
    THROW 50074, 'id_perception 13 ya está ocupado por otra percepción. Decide el id a mano.', 1;

UPDATE [CentroPodologico].[payroll].[perceptions]
   SET [description] = 'Horas extra dobles'
 WHERE [id_perception] = 5;

IF NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[perceptions] WHERE [id_perception] = 13)
    INSERT INTO [CentroPodologico].[payroll].[perceptions]
           ([id_perception], [clave_sat], [description], [id_taxed_exempt], [exempt_limit],
            [is_billed], [status],
            [tipo_limite_exencion], [umas_limite], [porcentaje_exento], [periodicidad_limite])
    SELECT 13, '019', 'Horas extra triples', @id_gravado, NULL,
           doubles.[is_billed], doubles.[status],
           'N', NULL, NULL, NULL
      FROM [CentroPodologico].[payroll].[perceptions] doubles
     WHERE doubles.[id_perception] = 5;

COMMIT;
GO
```

- **`CK_perceptions_exencion`** ya acepta la fila nueva (`'N'` con las tres columnas de la regla en `NULL`). No hay que tocarla.
- **`exempt_limit`** queda en `NULL`. El texto libre no se lee desde la spec 69.
- **Renglones guardados.** Hoy ninguna fila de `period_employee_perceptions` tiene `id_perception = 5`, porque las horas extra no entran a la nómina fiscal. Por eso el cambio de nombre no altera ningún Detalle calculado. La descripción no se congela en el renglón: el Detalle la lee del catálogo.

**Constantes** (`lib/payroll/constants.ts`):

```ts
// Spec 74: horas extra en el catálogo payroll.perceptions. Las dos son clave SAT 019;
// las dobles llevan exención ('M' 50%, 5 UMA por semana) y las triples son 100% gravadas ('N').
export const OVERTIME_DOUBLE_PERCEPTION_ID = 5;
export const OVERTIME_TRIPLE_PERCEPTION_ID = 13;

export const PERCEPTION_LINE_KEY_BY_ID: Record<number, string> = {
  [SALARY_PERCEPTION_ID]:          "sueldo_base",
  [OVERTIME_DOUBLE_PERCEPTION_ID]: "horas_extra_dobles",
  [OVERTIME_TRIPLE_PERCEPTION_ID]: "horas_extra_triples",
};
```

**Tipos.** Sin cambios: `IPerception` (`interfaces/payroll_tax_parameters.ts`) ya describe la fila nueva.

**Lectura.** `getPerceptions` cambia `ORDER BY id_perception` por `ORDER BY clave_sat, id_perception`.

## Plan de implementación

1. **Revisar la BD (solo lectura).**
   - Listar `payroll.perceptions` y confirmar que la 5 es `019` / `'M'` (50%, 5 UMA, `'S'`) y que el id 13 está libre.
   - Leer `payroll.cat_taxed_exempt` y anotar el id de "Gravado" para `@id_gravado`.
   - Confirmar que ninguna fila de `period_employee_perceptions` tiene `id_perception = 5`.
   - Anotar los hallazgos en el Registro. Si algo no coincide (la 5 no es horas extra o el 13 está ocupado), detenerse y decidir con el usuario antes de seguir.

2. **Script de datos.**
   - Correr el script del Modelo de datos y documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 73. Sin cambios de código: la app sigue igual, con una fila más en el catálogo.
   - Verificación:
     - la 5 dice "Horas extra dobles" y conserva su regla;
     - la 13 existe con `019`, `'N'`, la regla en `NULL`, `id_taxed_exempt` = Gravado, y `is_billed` y `status` iguales a los de la 5;
     - una segunda corrida termina sin error y sin cambios (sigue habiendo una sola fila 13).
   - Verificación con rollback: con el id 13 ocupado por otra descripción, el script lanza el `THROW` y no cambia nada.

3. **Constantes y orden del catálogo.**
   - En `lib/payroll/constants.ts`, agregar `OVERTIME_DOUBLE_PERCEPTION_ID` y `OVERTIME_TRIPLE_PERCEPTION_ID`, y las dos entradas de `PERCEPTION_LINE_KEY_BY_ID`.
   - En `getPerceptions` (`app/dashboard/nomina/parametros-fiscales/actions.ts`), cambiar a `ORDER BY clave_sat, id_perception`.
   - Verificación: `tsc --noEmit` sin errores. En el navegador con rol 4, la pestaña Percepciones muestra "Horas extra dobles" (50% con tope de 5 UMA por semana) y justo debajo "Horas extra triples" (sin exención), y la 13 se edita y se guarda con `PerceptionModal` (después se devuelve a `'N'`).

4. **Sin efecto en la nómina calculada.**
   - Recalcular `NOM-2026-S01` y comparar contra antes del cambio: las 18 columnas del ISR, las filas de `period_employee_deductions` y los renglones de `period_employee_perceptions` son idénticos (salvo `calculated_at` y `calculated_by`).
   - El aviso "Recalcula" de gravado/exento no aparece antes ni después de recalcular.
   - El Detalle operativo y el fiscal del empleado 2 se ven igual que antes.

5. **Documentación.**
   - `docs/nomina.md`:
     - en la sección de la spec 69, "Captured so far" pasa a dobles `'M'` (id 5) y triples `'N'` (id 13);
     - en la sección de la spec 73, quitar la separación de dobles y triples de lo pendiente.
   - `references/nomina/reglas_modulo_nomina.md` (2.4): anotar que las dobles son la percepción 5 y las triples la 13.

Cada paso deja el sistema compilando y funcionando.

## Criterios de aceptación

**Base de datos**

- [x] `payroll.perceptions` tiene la 5 como "Horas extra dobles", `019`, `'M'` 50%, 5 UMA, `'S'`, con su regla sin cambios.
- [x] `payroll.perceptions` tiene la 13 como "Horas extra triples":
  - `019`, `'N'`, con `umas_limite`, `porcentaje_exento`, `periodicidad_limite` y `exempt_limit` en `NULL`;
  - `id_taxed_exempt` = el id de "Gravado" de `cat_taxed_exempt`;
  - `is_billed` y `status` iguales a los de la 5.
- [x] Correr el script dos veces deja exactamente una fila 13 y no lanza error.
- [x] Con el id 13 ocupado por otra percepción, o con la 5 distinta de `019` / `'M'`, el script lanza `THROW 50074` y no cambia ninguna fila (verificado con rollback).
- [x] El script está en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 73.

**Código**

- [x] `lib/payroll/constants.ts` exporta `OVERTIME_DOUBLE_PERCEPTION_ID = 5` y `OVERTIME_TRIPLE_PERCEPTION_ID = 13`.
- [x] `PERCEPTION_LINE_KEY_BY_ID` tiene exactamente tres entradas: `1 → "sueldo_base"`, `5 → "horas_extra_dobles"` y `13 → "horas_extra_triples"`. Las tres claves existen en `buildPerceptionLines`.
- [x] `getPerceptions` ordena por `clave_sat, id_perception`.
- [x] `tsc --noEmit` termina sin errores.

**Pestaña Percepciones** (navegador, rol 4)

- [x] "Horas extra dobles" aparece con "50% con tope de 5 UMA por semana", y en la fila siguiente aparece "Horas extra triples" con el tope de tipo `'N'`.
- [x] La 13 se abre en `PerceptionModal`, acepta un cambio de regla y lo guarda. Al devolverla a `'N'`, el catálogo queda como al terminar el paso 2.
- [x] Ninguna otra percepción cambia de regla ni de descripción.

**Sin efecto en la nómina**

- [x] Al recalcular `NOM-2026-S01` son idénticos antes y después, salvo `calculated_at` y `calculated_by`:
  - las 18 columnas del ISR (empleado 2: base 2,275.00, retenido 41.54; empleado 6: base 3,900.00, retenido 402.95);
  - las filas de `period_employee_deductions`;
  - los renglones de `period_employee_perceptions`.
- [x] Ningún renglón de `period_employee_perceptions` tiene `id_perception` 5 o 13.
- [x] El aviso "Recalcula" de gravado/exento no aparece en `NOM-2026-S01`.
- [x] El Detalle operativo y el fiscal del empleado 2 en `NOM-2026-S01` se ven igual que antes de la spec.

**Documentación**

- [x] `docs/nomina.md` lista dobles `'M'` (id 5) y triples `'N'` (id 13) en la sección de la spec 69, y ya no lista la separación como pendiente en la sección de la spec 73.
- [x] `references/nomina/reglas_modulo_nomina.md` (2.4) dice qué id corresponde a cada tipo de hora.

## Decisiones tomadas y descartadas

- **Sí:** solo catálogo y constantes. Pagar horas extra en la nómina fiscal obliga a decidir otra vez el reparto por semana sobre los renglones `'F'`, y eso merece su propia spec. **No:** generar en esta spec las líneas de horas extra en `#fiscal_perception_lines`.
- **Sí:** dos percepciones con la misma clave `019`. `c_TipoPercepcion` tiene una sola clave para horas extra; el tipo de hora se reporta en el nodo `HorasExtra` (`TipoHoras` 01 dobles, 02 triples). Las comisiones ya repiten la clave `028` en tres filas. **No:** una sola percepción con lógica "si es triple" en el motor. Rompería la regla de la spec 73: ninguna línea de código dice qué concepto es.
- **Sí:** la 5 se queda como dobles y solo cambia su nombre. Su regla (`'M'` 50%, 5 UMA, `'S'`) ya es la de las dobles, y ningún renglón calculado la usa. **No:** crear dos filas nuevas y desactivar la 5, que dejaría un id muerto en el catálogo.
- **Sí:** las triples son `'N'`, 100% gravadas (LISR art. 93 fr. I: solo exenta lo que no excede el límite legal, que son las dobles).
- **Sí:** el id 13 va fijo en el script y en la constante, con un `THROW` si está ocupado. Es el mismo patrón que `SALARY_PERCEPTION_ID = 1`. **No:** `MAX + 1` al correr el script. La constante dependería del orden en que se corran los scripts en cada BD.
- **Sí:** el script es idempotente y valida antes de escribir; nunca pisa una fila ajena.
- **Sí:** `is_billed` y `status` se copian de la 5, e `id_taxed_exempt` apunta a "Gravado". El motor no los lee, pero la fila queda coherente con el resto del catálogo. **No:** dejarlos en `NULL`.
- **Sí:** agregar ya las constantes y las entradas de `PERCEPTION_LINE_KEY_BY_ID`. Hoy son inertes, y la spec de horas extra fiscales solo tendrá que generar sus líneas. **No:** dejarlas para esa spec.
- **Sí:** el catálogo se ordena por `clave_sat, id_perception`, para que dobles y triples salgan juntas. **No:** seguir ordenando por id, que dejaría las triples al final.
- **Sí:** la 13 se edita con el `PerceptionModal` existente. El catálogo manda, como en la spec 73. **No:** bloquear su regla en la pantalla.
- **No:** pantalla de alta de percepciones. Las filas nuevas del catálogo entran por script, como hasta ahora.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| **El id 13 está ocupado o la 5 no es la de horas extra** en alguna BD (la lectura de este análisis viene del registro de la spec 73, no de una consulta directa). | El paso 1 revisa la BD antes de escribir, y el script lanza `THROW 50074` sin cambiar nada si algo no coincide. |
| **Cambiar el orden del catálogo** podría mover algo que dependa de `ORDER BY id_perception`. | Solo la pestaña Percepciones usa `getPerceptions`. El Detalle tiene su propio `ORDER BY r.id_perception` y no cambia. |
| **El renombre de la 5 no se congela:** si ya existieran renglones fiscales con horas extra, su Detalle cambiaría de nombre. | Hoy ninguno existe (lo verifican el paso 1 y un criterio). La spec 73 ya decidió que la descripción se lee del catálogo. |
| **Alguien cambia la regla de las triples** en la pantalla y las exenta por error. | La nota fija de la pestaña avisa que el cambio aplica al recalcular, y la spec 73 congela la regla en cada renglón y avisa con "Recalcula". Bloquear la edición quedó fuera de alcance. |
| **El CFDI podría agrupar dobles y triples** en una sola `Percepcion` `019` con varios nodos `HorasExtra`, en lugar de dos percepciones. | Es una decisión de la spec de timbrado: puede agrupar por `clave_sat` al armar el XML sin tocar el catálogo. Se anota como pendiente para esa spec. |

## Registro

- **2026-10-13 — Análisis y especificación.** Se revisaron las specs 61, 69 y 73, `docs/nomina.md`, `references/nomina/reglas_modulo_nomina.md` (2.4), `lib/payroll/constants.ts`, `getPerceptions`/`savePerception` y `PerceptionsTable`. Hallazgos:
  - `payroll.perceptions.id_perception` es `smallint` sin `IDENTITY`; el catálogo no tiene pantalla de alta, solo la edición del tope (`PerceptionModal`).
  - Según el registro de la spec 73 hay 12 filas (ids 1 a 12) y la 5 "Horas extras" es `019` / `'M'` 50%, 5 UMA, `'S'`. **No se consultó la BD directamente** durante el análisis; el paso 1 lo confirma.
  - Las horas extra solo se pagan en la nómina operativa (spec 61); los renglones `'F'` las tienen en 0 y `#fiscal_perception_lines` solo lleva el sueldo.
- **2026-10-13 — Paso 1: revisión de la BD (solo lectura).** Todo coincide con lo esperado:
  - `payroll.perceptions` tiene 12 filas (ids 1 a 12). La 5 es `019` / "Horas extras" / `'M'`, 5 UMA, 50%, `'S'`, `id_taxed_exempt = 3` (Gravado y Exento), `is_billed = 0`, `status = 1`.
  - El id 13 está libre.
  - `payroll.cat_taxed_exempt`: 1 = Gravado, 2 = Exento, 3 = Gravado y Exento. `@id_gravado = 1`.
  - Ninguna fila de `period_employee_perceptions` tiene `id_perception` 5 o 13.
  - `CK_perceptions_exencion` acepta `'N'` con las tres columnas de la regla en `NULL`.
- **2026-10-13 — Paso 2: script de datos.** Corrido contra la BD y documentado en `queries.txt` (después de la spec 73):
  - Primera corrida: la 5 queda "Horas extra dobles" con su regla intacta; la 13 existe con `019`, `'N'`, regla en `NULL`, `id_taxed_exempt = 1` (Gravado), `is_billed = 0` y `status = 1` (copiados de la 5). El catálogo pasa a 13 filas.
  - Segunda corrida: sin error y sin cambios; una sola fila 13.
  - Rollback: con la 13 ocupada por otra descripción y con la 5 en `020`, el script lanza `THROW 50074` y el estado queda intacto.
- **2026-10-13 — Paso 3: constantes y orden del catálogo.** `lib/payroll/constants.ts` exporta las dos constantes y `PERCEPTION_LINE_KEY_BY_ID` tiene tres entradas; `getPerceptions` ordena por `clave_sat, id_perception`. `tsc --noEmit` sin errores.
  - Navegador (rol 4): dobles "50% con tope de 5 UMA por semana" y, justo debajo, triples "Sin exención". El usuario guardó la 13 como "Totalmente exenta" desde `PerceptionModal` y la devolvió a "Sin exención".
  - BD tras la prueba: la 13 volvió a `'N'` con la regla en `NULL`; las demás percepciones conservan descripción y regla del Paso 1.
- **2026-10-13 — Paso 4: sin efecto en la nómina calculada.** Se tomó una foto de `NOM-2026-S01` (periodo 38) antes y después de recalcular:
  - `period_employees` (18 columnas del ISR incluidas), `period_employee_deductions` y `period_employee_perceptions` son idénticos, salvo `calculated_at`/`calculated_by` y los ids sustitutos (el recálculo reemplaza las filas). Empleado 2: base 2,275.00, retenido 41.54; empleado 6: base 3,900.00, retenido 402.95.
  - Ningún renglón tiene `id_perception` 5 o 13.
  - El aviso "Recalcula" no aparece antes ni después. El Detalle fiscal del empleado 2 muestra el mismo desglose (sueldo $2,275.00, ISR $41.54, neto $2,233.46).
- **2026-10-13 — Paso 5: documentación.** `docs/nomina.md`: "Captured so far" lista dobles `'M'` (id 5) y triples `'N'` (id 13); se quitó la separación de dobles y triples de los pendientes de la spec 73; se anotó que `PERCEPTION_LINE_KEY_BY_ID` ya mapea 5 y 13. `references/nomina/reglas_modulo_nomina.md` (2.4): id 5 dobles, id 13 triples, ambas `019`.
- Al terminar cada paso, marcar sus criterios de aceptación; al cerrar la spec, cambiar el estado a "Implementado".

## Lo que no incluye esta spec

- Horas extra en la nómina fiscal (líneas en `#fiscal_perception_lines` y reparto semanal sobre los renglones `'F'`).
- El nodo `HorasExtra` del CFDI y el timbrado.
- Horas extra simples y la exención del trabajador de salario mínimo.
- Pantalla de alta de percepciones.
- Bloquear la regla de una percepción con regla legal fija.
- Cambios en la nómina operativa.

Cada uno de estos puntos, si se llega a hacer, va en su propia spec.

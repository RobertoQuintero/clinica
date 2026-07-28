# Detalle de dedo infectado por onicomicosis en TabPatologia

**Estado:** Aprobado
**Dependencias:** ninguna
**Fecha:** 2026-07-28

## Objetivo

Al marcar "Onicomicosis Grado 1" y/o "Onicomicosis Grado 2" en `TabPatologia.tsx`, mostrar una imagen interactiva de ambos pies (`pie-zen-onico.jpeg`) donde se puede seleccionar cuál(es) de los 10 dedos está(n) infectado(s), guardando esa selección en una tabla nueva asociada a la consulta actual.

## Alcance

**Dentro de alcance:**
- Al marcar el checkbox "Onicomicosis Grado 1" y/o "Onicomicosis Grado 2" en `TabPatologia.tsx`, se revela una única sección con la imagen `public/pie-zen-onico.jpeg`, mostrada dos veces (pie izquierdo y pie derecho) para representar los 10 dedos, siguiendo el patrón de posicionamiento de `OnicocriptosisPies.tsx`.
- Por cada uno de los 10 dedos, un control tipo botón/check para marcarlo como infectado (toggle simple, sin grado, sin lado, sin dolor).
- La selección de dedos es compartida entre Grado 1 y Grado 2: no se distingue qué dedos corresponden a cada grado: si ambos checkboxes están activos, es la misma lista de dedos marcados.
- La sección se muestra si `onicomicosis_grado_1 === true` **o** `onicomicosis_grado_2 === true` (basta con uno de los dos).
- El detalle se guarda en una tabla nueva (`onicomicosis_detalle`), con una fila por cada dedo marcado como infectado, asociada al `id_consulta` actual.
- El guardado ocurre junto con el submit existente de `TabPatologia` (mismo botón "Registrar patología" / "Guardar cambios"), en la misma acción de servidor.
- Al abrir una consulta que ya tiene filas guardadas en `onicomicosis_detalle`, el formulario se precarga con esos dedos marcados.
- Validación: si `onicomicosis_grado_1` o `onicomicosis_grado_2` está marcado, se exige al menos un dedo seleccionado antes de guardar (si no hay ninguno, error de validación y no se guarda).
- Si ninguno de los dos checkboxes de onicomicosis está marcado, no se exige ningún dedo y no se guarda ninguna fila en `onicomicosis_detalle`.
- En modo `locked` (solo lectura), todos los controles de esta sección quedan `disabled`, mostrando únicamente lo que ya está guardado.
- Los checkboxes existentes "Onicomicosis Grado 1" / "Onicomicosis Grado 2" en `patologia_ungueal` no cambian de comportamiento: siguen siendo los que activan/desactivan la visibilidad de esta sección.

**Fuera de alcance:**
- Distinguir en la base de datos o en la UI qué dedos corresponden a Grado 1 vs Grado 2 (la selección de dedos es una sola, compartida).
- Modificar o derivar automáticamente el valor de los checkboxes "Onicomicosis Grado 1/2" a partir del detalle de dedos (se mantienen como campos independientes controlados manualmente por el usuario).
- Mostrar este detalle en `ConsultaFila.tsx` (spec 01) o en la columna "Patologias" de `PacienteFila.tsx` (spec 02) — queda para un spec futuro si se requiere.
- Editar/eliminar filas individuales de `onicomicosis_detalle` fuera del flujo normal de guardado de `TabPatologia` (se resuelve reemplazando el set completo al guardar, igual que onicocriptosis).
- Captura de lado medial/lateral, nivel de dolor, o cualquier otro atributo por dedo (solo se marca cuál dedo está infectado).
- Captura de otras patologías del pie más allá de onicomicosis (el resto de checkboxes en `PATOLOGIAS` no cambia).
- Diseño responsivo pixel-perfect del overlay sobre la imagen en todos los tamaños de pantalla (se implementa razonablemente para desktop, siguiendo el mismo criterio que onicocriptosis).

## Modelo de datos

**Tabla nueva `[CentroPodologico].[dbo].[onicomicosis_detalle]`:**

```sql
CREATE TABLE [CentroPodologico].[dbo].[onicomicosis_detalle] (
  [id_detalle]   INT           NOT NULL PRIMARY KEY,
  [id_consulta]  INT           NOT NULL,
  [pie]          VARCHAR(10)   NOT NULL,   -- 'izquierdo' | 'derecho'
  [dedo]         TINYINT       NOT NULL    -- 1 (hallux/gordo) .. 5 (meñique)
);
```

Sigue el mismo patrón de PK manual (`MAX(id)+1`) usado en `patologia_ungueal` y `onicocriptosis_detalle`. Una fila por dedo marcado como infectado; sin columna de grado, lado ni dolor.

**Nueva interfaz `interfaces/onicomicosis_detalle.ts`:**

```ts
export interface IOnicomicosisDetalle {
  id_detalle:  number;
  id_consulta: number;
  pie:         "izquierdo" | "derecho";
  dedo:        number; // 1-5
}
```

**Server actions nuevas en `app/dashboard/pacientes/[id]/consultas/[id_consulta]/actions.ts`:**

```ts
export async function getOnicomicosisDetalle(
  id_consulta: number
): Promise<IOnicomicosisDetalle[]>

export async function saveOnicomicosisDetalle(
  id_consulta: number,
  detalles: Omit<IOnicomicosisDetalle, "id_detalle" | "id_consulta">[],
): Promise<ActionResult<IOnicomicosisDetalle[]>>
```

- `getOnicomicosisDetalle`: `SELECT` simple por `id_consulta`, usado para precargar el formulario al abrir una consulta existente (agregado a la carga inicial de datos junto al resto, igual que `onicocriptosisDetalle`).
- `saveOnicomicosisDetalle`: reemplaza el set completo — `DELETE FROM onicomicosis_detalle WHERE id_consulta = @id_consulta` seguido de un `INSERT` por cada dedo marcado (si el arreglo viene vacío, solo se ejecuta el `DELETE`). Se invoca desde el mismo handler de submit de `page.tsx`, justo como `saveOnicocriptosisDetalle`.

**Modificación a `TabPatologia.tsx`:**
- Nuevo estado/prop para el arreglo de `IOnicomicosisDetalle` (o su forma parcial sin id) que se muestra/edita cuando `form.onicomicosis_grado_1 === true || form.onicomicosis_grado_2 === true`.
- Nuevo componente hijo `OnicomicosisPies.tsx` que renderiza `pie-zen-onico.jpeg` (dos veces, una por pie) con los controles de toggle superpuestos por dedo, siguiendo el patrón de `componentes/` y la estructura de `OnicocriptosisPies.tsx`.

## Plan de implementación

1. Crear la tabla `[CentroPodologico].[dbo].[onicomicosis_detalle]` en la base de datos (script agregado a `queries.txt`), con las columnas descritas en el modelo de datos.
2. Crear `interfaces/onicomicosis_detalle.ts` con `IOnicomicosisDetalle`.
3. Agregar `getOnicomicosisDetalle(id_consulta)` y `saveOnicomicosisDetalle(id_consulta, detalles)` en `app/dashboard/pacientes/[id]/consultas/[id_consulta]/actions.ts`, siguiendo el patrón `queryParams` usado en `saveOnicocriptosisDetalle`.
4. Incluir la carga de `onicomicosis_detalle` en la carga inicial de datos de `page.tsx` (junto a `getOnicocriptosisDetalle`/`getConsultaData`), agregando estado `onicomicosisDetalle` (`IOnicomicosisDetalle[]`) inicializado desde ahí.
5. Crear `componentes/OnicomicosisPies.tsx`: recibe el arreglo de detalle actual (10 posiciones fijas, 2 pies x 5 dedos) y un `onChange`, renderiza `pie-zen-onico.jpeg` dos veces (pie izquierdo y derecho) con los 10 controles de toggle superpuestos (marcado/no marcado, sin grado ni lado); recibe `disabled` para el modo `locked`.
6. Modificar `TabPatologia.tsx` para: renderizar `OnicomicosisPies` condicionalmente cuando `form.onicomicosis_grado_1 === true || form.onicomicosis_grado_2 === true`, y exponer el estado del detalle vía props (`detalleOnicomicosis`, `onDetalleOnicomicosisChange`) desde el padre.
7. Modificar `handlePatologiaSubmit` en `page.tsx` para, tras el `savePatologia` exitoso, llamar `saveOnicomicosisDetalle(id_consulta, detalle)` con los dedos marcados, validando antes que si `onicomicosis_grado_1` o `onicomicosis_grado_2` está activo, haya al menos un dedo seleccionado (si no, `setPatologiaError` y no continuar).
8. Prueba manual: marcar solo Grado 1 y marcar dedos, marcar solo Grado 2 y marcar dedos, marcar ambos grados a la vez y verificar que comparten la misma selección de dedos, intentar guardar con algún grado marcado y ningún dedo seleccionado (debe fallar validación), desmarcar ambos checkboxes de onicomicosis después de tener dedos guardados y volver a marcar uno (debe seguir mostrando los datos precargados), abrir una consulta ya guardada y verificar precarga correcta, y verificar que en modo `locked` los controles están deshabilitados y solo muestran lo guardado.

## Criterios de aceptación

- [ ] Al marcar "Onicomicosis Grado 1" y/o "Onicomicosis Grado 2" en `TabPatologia.tsx` se muestra la imagen `pie-zen-onico.jpeg` (dos veces, pie izquierdo y derecho) con controles por cada uno de los 10 dedos.
- [ ] Cada dedo permite marcarse/desmarcarse como infectado mediante un toggle simple (sin grado, sin lado, sin dolor por dedo).
- [ ] La selección de dedos es única y compartida: si ambos checkboxes de grado están activos, no hay distinción de qué dedos pertenecen a cada uno.
- [ ] Si ningún checkbox de onicomicosis está marcado, no se exige ningún dedo y no se guarda ninguna fila en `onicomicosis_detalle`.
- [ ] Si `onicomicosis_grado_1` o `onicomicosis_grado_2` está marcado y no se seleccionó ningún dedo, se muestra un error de validación y no se guarda.
- [ ] Al hacer clic en "Registrar patología"/"Guardar cambios", se guardan en la misma acción tanto `patologia_ungueal` como las filas correspondientes en `onicomicosis_detalle` (reemplazando el set completo previo de esa consulta).
- [ ] Al abrir una consulta que ya tiene filas guardadas en `onicomicosis_detalle`, el formulario se precarga con los dedos marcados.
- [ ] En modo `locked`, todos los controles de esta sección aparecen deshabilitados y muestran únicamente los dedos guardados.
- [ ] Desmarcar y volver a marcar los checkboxes de onicomicosis sin guardar no borra los dedos capturados en el estado local del formulario.
- [ ] Los checkboxes "Onicomicosis Grado 1"/"Grado 2" en `patologia_ungueal` conservan su comportamiento actual (controlados manualmente, no derivados del detalle).
- [ ] No se modifica el comportamiento del resto de checkboxes de `PATOLOGIAS`, de `onicocriptosis`/`OnicocriptosisPies`, ni de otros tabs.

## Decisiones tomadas y descartadas

- **Reusar `pie-zen-onico.jpeg` dos veces (una por pie) vs. buscar/crear una imagen con ambos pies:** se decidió reutilizar la misma imagen dos veces, siguiendo el patrón visual de `OnicocriptosisPies.tsx` (10 dedos, 2 pies), en lugar de conseguir una imagen distinta que ya muestre ambos pies juntos.
- **Grado compartido entre dedos vs. grado por dedo (como onicocriptosis):** se decidió que la selección de dedos sea única y compartida entre Grado 1 y Grado 2, sin distinguir en la tabla ni en la UI qué dedos corresponden a cada grado, simplificando el modelo dado que el grado global ya está representado por los checkboxes existentes en `patologia_ungueal`.
- **Sin lado medial/lateral ni dolor por dedo:** a diferencia de onicocriptosis, se decidió no capturar estos atributos porque el objetivo es únicamente identificar visualmente qué dedo(s) están infectados por hongos, sin necesidad clínica adicional reportada.
- **Un registro por dedo afectado vs. una fila única con JSON/columnas fijas:** se eligió una fila por dedo en `onicomicosis_detalle`, manteniendo el mismo patrón relacional que `onicocriptosis_detalle`.
- **Validación obligatoria (al menos un dedo) vs. opcional:** a diferencia de onicocriptosis (donde el dolor era obligatorio solo si había un dedo con grado, pero el dedo en sí era opcional), aquí se decidió exigir al menos un dedo marcado en cuanto algún checkbox de grado esté activo, ya que sin lado ni dolor que capturar, el dedo es el único dato relevante y no debería quedar vacío si el usuario indicó que hay onicomicosis.
- **Guardado junto con `TabPatologia` vs. botón independiente:** se integra en el mismo submit, consistente con `onicocriptosis_detalle` y el resto del formulario.
- **Checkboxes "Onicomicosis Grado 1/2" independientes del detalle vs. derivados:** se mantienen como campos manuales, igual que `onicocriptosis`, evitando lógica implícita que sorprenda al usuario.
- **Reemplazo completo (`DELETE` + `INSERT`) vs. `UPDATE` incremental por dedo:** se eligió reemplazo completo por simplicidad, igual que `onicocriptosis_detalle`.
- **Precarga de datos existentes al editar vs. captura siempre desde cero:** se decidió precargar para mantener consistencia con el resto de `TabPatologia`.

No se identificaron riesgos relevantes que ameriten una sección aparte.

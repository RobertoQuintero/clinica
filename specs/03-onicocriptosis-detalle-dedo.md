# Detalle de onicocriptosis por dedo en TabPatologia

**Estado:** Aprobado
**Dependencias:** ninguna
**Fecha:** 2026-07-27

## Objetivo

Al marcar "Onicocriptosis" en `TabPatologia.tsx`, mostrar una imagen interactiva de ambos pies (`piezen-pain.jpeg`) donde, para cada uno de los 10 dedos, se puede seleccionar un grado (1/2/3, excluyentes entre sí), el borde afectado (medial y/o lateral), y un nivel de dolor general (1-10) para toda la valoración, guardando el detalle en una tabla nueva asociada a la consulta actual.

## Alcance

**Dentro de alcance:**
- Al marcar el checkbox "Onicocriptosis" en `TabPatologia.tsx`, se revela una sección con la imagen `public/piezen-pain.jpeg` (ambos pies) y controles superpuestos sobre cada uno de los 10 dedos.
- Por cada dedo (pie izquierdo/derecho × dedo 1-5), un control tipo check button para seleccionar Grado 1, 2 o 3 (mutuamente excluyentes: solo uno de los tres por dedo, o ninguno).
- Por cada dedo con grado seleccionado, dos checkboxes independientes (no excluyentes) para marcar el borde afectado: medial y/o lateral.
- Un único selector de nivel de dolor (1-10) general para toda la valoración de onicocriptosis de la consulta (no por dedo).
- El detalle se guarda en una tabla nueva (`onicocriptosis_detalle`), con una fila por cada dedo que tenga grado seleccionado, asociada al `id_consulta` actual.
- El guardado ocurre junto con el submit existente de `TabPatologia` (mismo botón "Registrar patología" / "Guardar cambios"), en la misma acción de servidor.
- Al abrir una consulta que ya tiene filas guardadas en `onicocriptosis_detalle`, el formulario se precarga con esos datos (grado, lado(s) por dedo, dolor general).
- Validación: un dedo solo se guarda si tiene grado seleccionado (el lado es opcional). El dolor (1-10) es obligatorio únicamente si hay al menos un dedo con grado seleccionado; si ningún dedo tiene grado, no se guarda ninguna fila y el dolor no se pide.
- En modo `locked` (solo lectura), todos los controles de esta sección quedan `disabled`, mostrando únicamente lo que ya está guardado (igual que el resto del formulario).
- El checkbox existente "Onicocriptosis" en `patologia_ungueal` no cambia de comportamiento: sigue siendo el que activa/desactiva la visibilidad de esta sección.

**Fuera de alcance:**
- Modificar o derivar automáticamente el valor del checkbox "Onicocriptosis" a partir del detalle de dedos (se mantiene como campo independiente controlado manualmente por el usuario).
- Mostrar este detalle en `ConsultaFila.tsx` (fila expandible de spec 01) o en la columna "Patologias" de `PacienteFila.tsx` (spec 02) — queda para un spec futuro si se requiere.
- Editar/eliminar filas individuales de `onicocriptosis_detalle` fuera del flujo normal de guardado de `TabPatologia` (no hay borrado selectivo de un solo dedo vía API; se resuelve reemplazando el set completo al guardar).
- Captura de otras patologías del pie más allá de onicocriptosis (el resto de checkboxes en `PATOLOGIAS` no cambia).
- Diseño responsivo pixel-perfect del overlay sobre la imagen en todos los tamaños de pantalla (se implementa razonablemente para desktop; ajustes finos de posicionamiento quedan a criterio de implementación).

## Modelo de datos

**Tabla nueva `[CentroPodologico].[dbo].[onicocriptosis_detalle]`:**

```sql
CREATE TABLE [CentroPodologico].[dbo].[onicocriptosis_detalle] (
  [id_detalle]   INT           NOT NULL PRIMARY KEY,
  [id_consulta]  INT           NOT NULL,
  [pie]          VARCHAR(10)   NOT NULL,   -- 'izquierdo' | 'derecho'
  [dedo]         TINYINT       NOT NULL,   -- 1 (hallux/gordo) .. 5 (meñique)
  [grado]        TINYINT       NOT NULL,   -- 1 | 2 | 3
  [lado_medial]  BIT           NOT NULL DEFAULT 0,
  [lado_lateral] BIT           NOT NULL DEFAULT 0,
  [dolor]        TINYINT       NOT NULL    -- 1..10, mismo valor repetido en todas las filas de una misma consulta
);
```

Sigue el mismo patrón de PK manual (`MAX(id)+1`) usado en `patologia_ungueal`. Una fila por dedo afectado; `dolor` es el valor general de la consulta y se repite igual en cada fila (no hay columna de dolor por dedo).

**Nueva interfaz `interfaces/onicocriptosis_detalle.ts`:**

```ts
export interface IOnicocriptosisDetalle {
  id_detalle:   number;
  id_consulta:  number;
  pie:          "izquierdo" | "derecho";
  dedo:         number;       // 1-5
  grado:        1 | 2 | 3;
  lado_medial:  boolean;
  lado_lateral: boolean;
  dolor:        number;       // 1-10
}
```

**Server actions nuevas en `app/dashboard/pacientes/[id]/consultas/[id_consulta]/actions.ts`:**

```ts
export async function getOnicocriptosisDetalle(
  id_consulta: number
): Promise<IOnicocriptosisDetalle[]>

export async function saveOnicocriptosisDetalle(
  id_consulta: number,
  detalles: Omit<IOnicocriptosisDetalle, "id_detalle" | "id_consulta">[],
): Promise<ActionResult<IOnicocriptosisDetalle[]>>
```

- `getOnicocriptosisDetalle`: `SELECT` simple por `id_consulta`, usado para precargar el formulario al abrir una consulta existente (junto al resto de datos que ya carga `page.tsx`, agregándolo a `getConsultaData`/estructura equivalente).
- `saveOnicocriptosisDetalle`: reemplaza el set completo — `DELETE FROM onicocriptosis_detalle WHERE id_consulta = @id_consulta` seguido de un `INSERT` por cada dedo con grado seleccionado (si el arreglo viene vacío, solo se ejecuta el `DELETE`, quedando sin filas). Se invoca desde `savePatologia` (o inmediatamente después, en el mismo handler de submit de `page.tsx`) para que ambos guardados ocurran en el mismo flujo de "Guardar cambios".

**Modificación a `TabPatologia.tsx`:**
- Nuevo estado/prop para el arreglo de `IOnicocriptosisDetalle` (o su forma parcial sin id) que se muestra/edita cuando `form.onicocriptosis === true`.
- Nuevo componente hijo (p.ej. `OnicocriptosisPies.tsx`) que renderiza `piezen-pain.jpeg` con los controles superpuestos por dedo, siguiendo el patrón `componentes/` existente.

## Plan de implementación

1. Crear la tabla `[CentroPodologico].[dbo].[onicocriptosis_detalle]` en la base de datos (script agregado a `queries.txt`), con las columnas descritas en el modelo de datos.
2. Crear `interfaces/onicocriptosis_detalle.ts` con `IOnicocriptosisDetalle`.
3. Agregar `getOnicocriptosisDetalle(id_consulta)` y `saveOnicocriptosisDetalle(id_consulta, detalles)` en `app/dashboard/pacientes/[id]/consultas/[id_consulta]/actions.ts`, siguiendo el patrón `queryParams` + `CONVERT` (no aplica aquí, sin fechas) usado en `savePatologia`.
4. Incluir la carga de `onicocriptosis_detalle` en la carga inicial de datos de `page.tsx` (junto a `getPatologia`/`getConsultaData`), agregando estado `onicocriptosisDetalle` (`IOnicocriptosisDetalle[]`) inicializado desde ahí.
5. Crear `componentes/OnicocriptosisPies.tsx`: recibe el arreglo de detalle actual y un `onChange`, renderiza `piezen-pain.jpeg` con los 10 controles superpuestos (grado 1/2/3 excluyente, lado medial/lateral) y el selector de dolor general (1-10); recibe `disabled` para el modo `locked`.
6. Modificar `TabPatologia.tsx` para: renderizar `OnicocriptosisPies` condicionalmente cuando `form.onicocriptosis === true`, y exponer el estado del detalle vía props (`detalle`, `onDetalleChange`) desde el padre.
7. Modificar `handlePatologiaSubmit` en `page.tsx` para, tras el `savePatologia` exitoso, llamar `saveOnicocriptosisDetalle(id_consulta, detalle)` con las filas de dedos que tengan grado seleccionado (filtrando los que no), validando antes que si hay ≥1 dedo con grado, el dolor general esté en 1-10 (si no, `setPatologiaError` y no continuar).
8. Prueba manual: marcar onicocriptosis y capturar 1 dedo, capturar varios dedos en ambos pies, intentar guardar sin dolor teniendo un dedo marcado (debe fallar validación), desmarcar onicocriptosis después de tener dedos guardados y volver a marcarla (debe seguir mostrando los datos precargados), abrir una consulta ya guardada y verificar precarga correcta, y verificar que en modo `locked` los controles están deshabilitados y solo muestran lo guardado.

## Criterios de aceptación

- [ ] Al marcar el checkbox "Onicocriptosis" en `TabPatologia.tsx` se muestra la imagen `piezen-pain.jpeg` con controles por cada uno de los 10 dedos (2 pies × 5 dedos).
- [ ] Cada dedo permite seleccionar Grado 1, 2 o 3, mutuamente excluyentes entre sí (solo uno activo por dedo).
- [ ] Cada dedo permite marcar el borde medial y/o lateral de forma independiente (no excluyente entre sí).
- [ ] Existe un único selector de dolor (1-10) para toda la valoración de onicocriptosis, no uno por dedo.
- [ ] Si ningún dedo tiene grado seleccionado, no se exige el dolor y no se guarda ninguna fila en `onicocriptosis_detalle`.
- [ ] Si al menos un dedo tiene grado seleccionado y no se eligió dolor, se muestra un error de validación y no se guarda.
- [ ] Al hacer clic en "Registrar patología"/"Guardar cambios", se guardan en la misma acción tanto `patologia_ungueal` como las filas correspondientes en `onicocriptosis_detalle` (reemplazando el set completo previo de esa consulta).
- [ ] Al abrir una consulta que ya tiene filas guardadas en `onicocriptosis_detalle`, el formulario se precarga con el grado, lado(s) y dolor general guardados.
- [ ] En modo `locked`, todos los controles de esta sección aparecen deshabilitados y muestran únicamente los datos guardados.
- [ ] Desmarcar y volver a marcar el checkbox "Onicocriptosis" sin guardar no borra los datos capturados en el estado local del formulario.
- [ ] El checkbox "Onicocriptosis" en `patologia_ungueal` conserva su comportamiento actual (controlado manualmente, no derivado del detalle).
- [ ] No se modifica el comportamiento del resto de checkboxes de `PATOLOGIAS` ni de otros tabs (`TabGeneral`, `TabValoracion`, etc.).

## Decisiones tomadas y descartadas

- **Overlay de controles sobre la imagen vs. lista/tabla debajo:** se eligió overlay posicionado sobre `piezen-pain.jpeg` por fidelidad al mockup de referencia, aunque implica coordenadas CSS por dedo y mayor complejidad de construcción/mantenimiento que una lista simple.
- **10 dedos (ambos pies) vs. solo halux:** se decidió capturar los 10 dedos porque la onicocriptosis puede afectar cualquier dedo, no solo el gordo, aunque el mockup de referencia solo mostraba checkboxes en un subconjunto.
- **"Lado" como borde medial/lateral de la uña vs. pie derecho/izquierdo:** se interpretó como el borde de la uña afectado (medial/lateral), ya que es el dato clínicamente relevante en onicocriptosis; el pie ya queda identificado por la columna `pie` independiente de esta selección.
- **Un registro por dedo afectado vs. una fila única con JSON/columnas fijas:** se eligió una fila por dedo en `onicocriptosis_detalle` para mantener el patrón relacional del resto del esquema (sin columnas dinámicas ni JSON) y permitir queries simples por dedo si se necesitan a futuro.
- **Dolor general (1) vs. dolor por dedo:** se confirmó un solo valor de dolor por consulta, no por dedo, simplificando la UI a un selector; se repite el mismo valor en cada fila de `onicocriptosis_detalle` en vez de crear una tabla/columna separada para no fragmentar el modelo en dos tablas relacionadas 1:1.
- **Guardado junto con `TabPatologia` vs. botón independiente:** se integra en el mismo submit para mantener una sola acción de guardado por tab, consistente con el resto del formulario, evitando estados parcialmente guardados (patología guardada pero detalle de dedos no, o viceversa).
- **Checkbox "Onicocriptosis" independiente del detalle vs. derivado:** se mantiene como campo manual para no introducir lógica implícita que sorprenda al usuario (p. ej. que se desmarque solo al borrar el último dedo), y porque el checkbox ya forma parte de un flujo existente (spec 01 y 02) que no debe verse afectado.
- **Reemplazo completo (`DELETE` + `INSERT`) vs. `UPDATE` incremental por dedo:** se eligió reemplazo completo por simplicidad, evitando lógica de diff entre el set anterior y el nuevo; el volumen de filas por consulta es pequeño (máximo 10).
- **Precarga de datos existentes al editar vs. captura siempre desde cero:** se decidió precargar para mantener consistencia con el resto de `TabPatologia`, que sí permite editar datos ya guardados de una consulta.

No se identificaron riesgos relevantes que ameriten una sección aparte.

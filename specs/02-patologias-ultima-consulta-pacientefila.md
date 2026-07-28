# Columna Patologias en PacienteFila

**Estado:** Aprobado
**Dependencias:** ninguna
**Fecha:** 2026-07-27

## Objetivo

Agregar una columna "Patologias" en `PacienteFila.tsx` que muestre, con badges
verdes, si la última consulta no cancelada del paciente tiene onicomicosis
y/o onicocriptosis marcadas.

## Alcance

**Dentro de alcance:**
- Nueva columna "Patologias" al final de `PacienteFila.tsx`, ubicada justo
  después de la columna `Onicomicosis` y antes de la columna de Acciones.
- Un badge verde independiente por cada patología presente en la última
  consulta no cancelada del paciente: "Onicomicosis" (si
  `onicomicosis_grado_1` y/o `onicomicosis_grado_2` es `true`) y/o
  "Onicocriptosis" (si `onicocriptosis` es `true`). Pueden mostrarse ambos
  badges a la vez.
- Cambios en las 3 queries que alimentan `PacienteFila` en
  `app/dashboard/pacientes/actions.ts`: `getPacientes`,
  `buscarPacientesExternos`, `buscarPacientesPorSucursal`.
- Nuevos campos opcionales en `IPaciente` (`interfaces/paciente.ts`).
- Nuevo `<th>Patologias</th>` en ambos `<thead>` de
  `app/dashboard/pacientes/page.tsx` (tabla de búsqueda externa y tabla
  principal).
- Celda vacía cuando el paciente no tiene consultas, o su última consulta no
  cancelada no tiene ni onicomicosis ni onicocriptosis marcadas.

**Fuera de alcance:**
- Edición de patología ungueal desde esta vista (sigue siendo de solo
  lectura; la edición ya existe en `TabPatologia.tsx`).
- Cambios a la tabla `patologia_ungueal` o a `TabPatologia.tsx`.
- Mostrar otras patologías distintas de onicomicosis/onicocriptosis
  (anoniquia, microniquia, onicolisis, etc.).
- Cambios al color, lógica o significado de la columna `Onicomicosis`
  existente (que refleja estado de *tratamiento* activo, un dato distinto).
- Cualquier lógica de "última consulta" que considere citas, no solo
  consultas.

## Modelo de datos

**`interfaces/paciente.ts`** — se agregan dos campos opcionales calculados a
`IPaciente`, siguiendo el mismo patrón que `en_tratamiento_onicomicosis`:

```ts
onicomicosis_ultima_consulta?:   boolean;
onicocriptosis_ultima_consulta?: boolean;
```

**`app/dashboard/pacientes/actions.ts`** — en las 3 queries (`getPacientes`,
`buscarPacientesExternos`, `buscarPacientesPorSucursal`), se agrega un
`OUTER APPLY` que obtiene la última consulta no eliminada y no cancelada del
paciente, y de ahí sus datos de `patologia_ungueal`:

```sql
OUTER APPLY (
  SELECT TOP 1 pu.[onicomicosis_grado_1], pu.[onicomicosis_grado_2], pu.[onicocriptosis]
    FROM [CentroPodologico].[dbo].[consultas] c
    LEFT JOIN [CentroPodologico].[dbo].[patologia_ungueal] pu
      ON pu.[id_consulta] = c.[id_consulta]
   WHERE c.[id_paciente] = p.[id_paciente]
     AND c.[deleted_at] IS NULL
     AND ISNULL(c.[cancelada], 0) = 0
   ORDER BY c.[fecha] DESC
) uc
```

Y se exponen los dos booleanos en el `SELECT`. Conceptualmente:
`onicomicosis_ultima_consulta = (onicomicosis_grado_1 = 1 OR
onicomicosis_grado_2 = 1)`, `onicocriptosis_ultima_consulta = (onicocriptosis
= 1)`. La expresión SQL exacta (`CASE WHEN ... THEN 1 ELSE 0 END` u
equivalente) se resuelve en implementación.

Se usa `OUTER APPLY` (no `CROSS APPLY`) para que pacientes sin ninguna
consulta calificada no queden excluidos del resultado. No se introducen
tablas ni columnas nuevas en la base de datos — se reutiliza
`patologia_ungueal` existente.

## Plan de implementación

1. Modificar las 3 queries en `app/dashboard/pacientes/actions.ts`
   (`getPacientes`, `buscarPacientesExternos`, `buscarPacientesPorSucursal`)
   agregando el `OUTER APPLY` descrito y los 2 campos booleanos calculados al
   `SELECT`.
2. Extender `IPaciente` (`interfaces/paciente.ts`) con
   `onicomicosis_ultima_consulta?: boolean` y
   `onicocriptosis_ultima_consulta?: boolean`.
3. Modificar `PacienteFila.tsx` agregando un `<td>` después del `<td>` de
   `Onicomicosis` y antes del `<td>` de acciones, con un badge verde
   condicional por cada flag `true` (etiquetas "Onicomicosis" y
   "Onicocriptosis"), reutilizando el estilo de badge existente pero con
   clases verdes (`bg-green-100 ... text-green-700 dark:bg-green-900/40
   dark:text-green-300`).
4. Agregar `<th className="...">Patologias</th>` en ambos `<thead>` de
   `app/dashboard/pacientes/page.tsx`, justo después del
   `<th>Onicomicosis</th>` existente en cada uno.
5. Prueba manual: paciente cuya última consulta no cancelada tiene solo
   onicomicosis, uno con solo onicocriptosis, uno con ambas, uno sin
   ninguna, y uno sin consultas — verificando que la celda se muestra vacía
   cuando corresponde y que una consulta cancelada no cuenta como "última".

## Criterios de aceptación

- [ ] `PacienteFila.tsx` muestra una nueva columna "Patologias" después de
      la columna "Onicomicosis" y antes de la columna de Acciones.
- [ ] Si la última consulta no cancelada del paciente tiene
      `onicomicosis_grado_1` y/o `onicomicosis_grado_2` en `true`, se
      muestra un badge verde "Onicomicosis".
- [ ] Si la última consulta no cancelada del paciente tiene `onicocriptosis`
      en `true`, se muestra un badge verde "Onicocriptosis".
- [ ] Ambos badges pueden mostrarse simultáneamente cuando ambas condiciones
      aplican.
- [ ] La celda se muestra vacía si el paciente no tiene consultas, o si su
      última consulta no cancelada no tiene ninguna de las dos patologías
      marcadas.
- [ ] Una consulta con `cancelada = 1` nunca se considera como la "última
      consulta" para este cálculo, aunque sea la más reciente por fecha.
- [ ] El nuevo `<th>Patologias</th>` aparece en la tabla principal de
      pacientes y en la tabla de resultados de búsqueda externa, en la
      misma posición relativa que la columna de datos.
- [ ] No se modifica el comportamiento ni la apariencia de la columna
      "Onicomicosis" (tratamiento) existente.
- [ ] `buscarPacientesPorSucursal` y `getPacientes` (listado principal)
      muestran el dato correctamente para el mismo paciente de forma
      consistente.

## Decisiones tomadas y descartadas

- **`OUTER APPLY` único vs. dos subqueries correlacionadas independientes:**
  se eligió `OUTER APPLY` para garantizar que `onicomicosis_ultima_consulta`
  y `onicocriptosis_ultima_consulta` provienen siempre de la misma fila (la
  última consulta), evitando inconsistencias si dos subqueries
  independientes resolvieran empates de fecha de forma distinta. También se
  usa `OUTER APPLY` en vez de `CROSS APPLY` para no excluir del listado a
  pacientes sin consultas calificadas.
- **Verde uniforme para ambos badges vs. diferenciar por color:** se
  confirmó con el usuario usar el mismo verde para "Onicomicosis" y
  "Onicocriptosis" en esta columna, distinguiéndose solo por el texto.
- **Un badge por patología vs. un badge combinado:** se eligió un badge
  independiente por patología presente (igual que el patrón ya usado en la
  columna de tratamiento), en vez de concatenar texto en un solo badge.
- **No reutilizar `en_tratamiento_onicomicosis`:** ese campo refleja el
  estado de un *tratamiento* de onicomicosis activo (tabla
  `Tratamiento_onicomicosis`), un concepto distinto a si la última consulta
  capturó las patologías onicomicosis/onicocriptosis en `patologia_ungueal`.
  Se mantienen como campos separados.
- **Aplicar a las 3 queries de pacientes vs. solo la principal:** se aplica
  a las 3 (`getPacientes`, `buscarPacientesExternos`,
  `buscarPacientesPorSucursal`) para que el dato sea consistente en todos
  los listados que renderizan `PacienteFila`, evitando que la columna
  aparezca vacía solo por venir de una ruta de búsqueda distinta.
- **"Última consulta" excluye canceladas:** se descartó incluir consultas
  canceladas en el cálculo, ya que una consulta cancelada no representa una
  valoración clínica válida del paciente.

No se identificaron riesgos relevantes que ameriten una sección aparte
(cambio aditivo, de solo lectura, sin impacto en flujos de escritura
existentes).

# Mostrar patología ungueal y valoración de piel en ConsultaFila

**Estado:** Implementado
**Dependencias:** ninguna
**Fecha:** 2026-07-27

## Objetivo

Agregar una fila expandible en `ConsultaFila.tsx` que muestre, bajo demanda, las
patologías ungueales y condiciones de valoración de piel (solo las activas)
registradas para el `id_consulta` correspondiente, con mensaje explícito cuando
no hay datos.

## Alcance

**Dentro de alcance:**
- Botón "Ver detalles" (o ícono expandir) en cada fila de `ConsultaFila.tsx`.
- Al expandir por primera vez, fetch bajo demanda (server action) de
  `patologia_ungueal` y `valoracion_piel` por `id_consulta`.
- Sub-fila expandida muestra dos bloques: "Patologías" y "Valoración de piel",
  cada uno listando solo los campos booleanos en `true`, con las mismas
  etiquetas en español usadas en `TabPatologia.tsx` / `TabValoracion.tsx`.
- Si no existe registro en la tabla correspondiente para ese `id_consulta`,
  el bloque muestra "Sin datos registrados".
- Aplica en los dos consumidores existentes de `ConsultaFila`: `ConsultasTable.tsx`
  (expediente de paciente) y `AccordionConsultas.tsx` (detalle de tratamiento).
- Estado de expansión/carga es local a cada fila (no persiste entre renders).

**Fuera de alcance:**
- Edición de patología/valoración desde esta vista (sigue siendo solo lectura;
  la edición ya existe en `TabPatologia`/`TabValoracion` dentro del detalle de
  consulta).
- Mostrar `fecha_valoracion` u `observaciones` de `valoracion_piel` (solo los
  booleanos activos, según lo confirmado).
- Cambios a `getConsultasByPaciente` / `getConsultasByTratamiento` (no se
  precarga; se mantiene el fetch bajo demanda).
- Caché o invalidación entre expansiones repetidas de la misma fila (se puede
  re-fetchear cada vez que se abre, o cachear en estado local del componente —
  detalle de implementación, no de spec).

## Modelo de datos

No se introducen tablas ni columnas nuevas. Se reutilizan las interfaces
existentes:

- `IPatologiaUngueal` (`interfaces/patologia_ungueal.ts`)
- `IValoracionPiel` (`interfaces/valoracion_piel.ts`)

Nueva función server action en `app/dashboard/pacientes/[id]/expediente/actions.ts`:

```ts
export async function getPatologiaValoracionByConsulta(
  id_consulta: number
): Promise<{
  patologia:  IPatologiaUngueal | null;
  valoracion: IValoracionPiel  | null;
}>
```

- Ejecuta dos `queryParams` (o `Promise.all`) contra
  `[CentroPodologico].[dbo].[patologia_ungueal]` y
  `[CentroPodologico].[dbo].[valoracion_piel]` filtrando por `id_consulta`,
  siguiendo el mismo patrón de `CONVERT(varchar(...), ..., 120)` para columnas
  de fecha usado en `getConsultaData` (aunque aquí no se muestra la fecha, se
  mantiene el patrón por si se requiere a futuro).
- Devuelve `null` en cada campo si no hay fila para ese `id_consulta`.

Reutilización de etiquetas: extraer (o duplicar, a decidir en implementación)
los arrays `PATOLOGIAS` de `TabPatologia.tsx` y `CONDITIONS` de
`TabValoracion.tsx` como fuente de las etiquetas en español mostradas en la
fila expandida.

## Plan de implementación

1. Agregar `getPatologiaValoracionByConsulta(id_consulta)` en
   `app/dashboard/pacientes/[id]/expediente/actions.ts`.
2. Modificar `ConsultaFila.tsx` para agregar estado local de expansión
   (`expanded`, `loading`, `data`) y un botón/ícono que, al primer click,
   llama a la nueva server action y despliega una sub-fila (`<tr>` adicional)
   con los dos bloques de solo los campos activos, o "Sin datos registrados"
   si corresponde.
3. Verificar que `ConsultasTable.tsx` (expediente) y `AccordionConsultas.tsx`
   (tratamiento) siguen funcionando sin cambios propios, ya que la lógica vive
   encapsulada en `ConsultaFila.tsx`.
4. Probar manualmente: una consulta con patología/valoración capturada, una
   sin ninguna de las dos, y una con solo una de las dos tablas capturada.

## Criterios de aceptación

- [ ] `ConsultaFila.tsx` muestra un control para expandir detalles de
      patología/valoración en cada fila.
- [ ] Al expandir una fila por primera vez, se dispara el fetch de
      `getPatologiaValoracionByConsulta(id_consulta)` y se muestra un estado
      de carga mientras responde.
- [ ] Los bloques "Patologías" y "Valoración de piel" muestran únicamente las
      etiquetas cuyos campos booleanos son `true`.
- [ ] Si no existe registro de `patologia_ungueal` (o `valoracion_piel`) para
      el `id_consulta`, se muestra el texto "Sin datos registrados" en ese
      bloque.
- [ ] La funcionalidad se ve y funciona igual en la tabla de expediente del
      paciente y en el accordion de consultas del tratamiento.
- [ ] No se modifica el comportamiento de edición existente en
      `TabPatologia.tsx` / `TabValoracion.tsx`.

## Decisiones tomadas y descartadas

- **Fila expandible vs. tooltip vs. modal:** se eligió fila expandible por ser
  consistente con el patrón de tabla ya usado y no requerir overlay/z-index.
- **Carga bajo demanda vs. precargada en la lista:** se eligió bajo demanda
  para no agregar 2 queries extra por cada consulta listada cuando la mayoría
  de las filas nunca se expanden.
- **Reutilizar `getConsultaData` vs. nueva función liviana:** se descartó
  reutilizar `getConsultaData` por traer datos innecesarios (paciente,
  archivos, productos, pagos, proceso); se crea una función dedicada y más
  liviana.
- **Mostrar solo campos activos vs. todos con check/x:** se eligió mostrar
  solo los activos por ser más compacto en el contexto de una fila de tabla
  (a diferencia de los formularios de edición, que sí muestran todos).

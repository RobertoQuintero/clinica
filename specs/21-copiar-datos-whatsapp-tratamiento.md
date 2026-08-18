# 21 — Copiar datos al portapapeles para WhatsApp en tratamiento

## Header

- **Estado:** Implementado
- **Depende de:** ninguno de los specs numerados existentes (toca `tratamientos/[id_tratamiento]/page.tsx`, `AccordionPagos.tsx`, `AccordionRecetas.tsx`, ya existentes desde antes del sistema de specs numerados)
- **Fecha:** 2026-08-18
- **Objetivo:** Agregar botones "Copiar" en el detalle del tratamiento (`/dashboard/tratamientos/[id_tratamiento]`) que copien al portapapeles, en tres puntos distintos, el texto ya usado o pensado para WhatsApp — el aviso de nueva solicitud al especialista, el recibo de un pago individual, y el mensaje de una receta — para que el usuario los pegue manualmente en cualquier conversación de WhatsApp que ya tenga abierta.

## Alcance

**Incluye:**
- Nuevo componente compartido `app/dashboard/componentes/CopyButton.tsx` (client component leaf): recibe `text: string` (o `getText: () => string`), copia al portapapeles con `navigator.clipboard.writeText`, y cambia su propio label/ícono a "¡Copiado!" por ~2 segundos antes de volver al estado normal. Se reutiliza en los tres puntos siguientes en vez de triplicar la lógica de copiado/feedback.
- **Punto 1 — Aviso de solicitud al especialista:** botón "Copiar solicitud" en el header de `tratamientos/[id_tratamiento]/page.tsx`, junto al título "Detalle del Tratamiento #X". Copia el mismo texto que hoy se manda automáticamente por wa.me al guardar el tratamiento (`handleConfirmSave` en `tratamiento/page.tsx`): saludo al especialista, nombre del paciente, fecha y sucursal, cierre invitando a revisar Piezen — mismo formato, reconstruido a partir del registro ya guardado (`DetailRow`), no del estado efímero del formulario de creación.
- **Nuevo campo `nombre_sucursal`** en `getTratamientoDetalle` (`app/dashboard/tratamientos/actions.ts`), vía `LEFT JOIN [dbo].[sucursales]` sobre `c.[id_sucursal]` — necesario porque el aviso actual incluye la sucursal y `DetailRow` hoy no la trae.
- **Punto 2 — Recibo de pago individual:** botón "Copiar" por fila en la tabla "Pagos (Ingresos)" de `AccordionPagos.tsx`, en una columna visible para todos los que ven la tabla (no solo `canEdit`). Copia un recibo con paciente, fecha, tipo, total, método de pago y referencia (formato de etiquetas en negritas, mismo estilo que ya usa `AccordionRecetas`). Requiere pasar `nombre_paciente` como prop nueva a `AccordionPagos` (hoy no lo recibe).
- **Punto 3 — Mensaje de receta:** botón "Copiar" junto al botón "WhatsApp" existente en cada fila de `AccordionRecetas.tsx`, con la misma visibilidad (`id_role !== 5`). Copia exactamente el mismo texto que ya arma `buildWhatsAppUrl` (se extrae el armado de líneas a una función que retorne el texto plano, reutilizada tanto por el enlace `wa.me` como por el nuevo botón de copiar).
- Feedback visual: cambio momentáneo del propio botón a "¡Copiado!" (sin `window.alert`, sin sistema de toasts nuevo).

**No incluye:**
- Ningún cambio a los enlaces `wa.me` existentes (auto-open al especialista en `handleConfirmSave`, botón "WhatsApp" en `AccordionRecetas`) — los botones de copiar son adicionales, no un reemplazo.
- Copiar al portapapeles en ningún otro lugar del sistema (ventas, citas, consultas) fuera de estos tres puntos del detalle de tratamiento.
- Un botón para copiar *todos* los pagos de la tabla a la vez, ni un resumen consolidado — solo copiado por fila individual, como se pidió.
- Cambios al contenido o formato del mensaje de aviso al especialista ni al de receta — se reutiliza tal cual el texto ya usado en `wa.me`, solo se hace copiable.
- Manejo de `id_sucursal` nulo/histórico distinto al ya usado en otras partes del sistema — si `nombre_sucursal` resulta `null` (consulta sin sucursal asignada), se muestra igual que hoy se maneja: `"Desconocida"` (mismo fallback que ya usa `handleConfirmSave` con `sucursal?.nombre ?? "Desconocida"`).

## Modelo de datos

No se crean tablas nuevas. Cambios a interfaces/consultas existentes:

**`app/dashboard/tratamientos/actions.ts` — `getTratamientoDetalle`:** agregar `LEFT JOIN` y campo al `SELECT`:

```sql
SELECT ...,
       ISNULL(suc.[nombre], NULL) AS nombre_sucursal
  FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis] t
  ...
  LEFT JOIN [CentroPodologico].[dbo].[sucursales] suc
         ON suc.[id_sucursal] = c.[id_sucursal]
 WHERE t.[id_tratamiento] = @id_tratamiento
```

Tipo de retorno extendido con `nombre_sucursal: string | null`.

**`app/dashboard/tratamientos/[id_tratamiento]/page.tsx` — `DetailRow`:**

```ts
type DetailRow = ITratamientoOnicomicosis & {
  nombre_paciente:     string;
  nombre_especialista: string;
  nombre_usuario:      string;
  nombre_stage:        string;
  nombre_sucursal:     string | null; // nuevo
  id_paciente:         number;
  id_podologo:         number;
  whatsapp:            string | null;
  phone_code:          string | null;
  edad_paciente:       number | null;
};
```

**Nuevo componente `app/dashboard/componentes/CopyButton.tsx`:**

```ts
interface CopyButtonProps {
  text:      string;
  label?:    string;      // default: "Copiar"
  copiedLabel?: string;   // default: "¡Copiado!"
  className?:  string;
  disabled?:   boolean;
}
```

Client component leaf, sin dependencias de contexto; usa `useState` local para el estado "copiado" y un `setTimeout` de 2s para revertirlo.

**`AccordionPagos.tsx` — nueva prop:**

```ts
interface Props {
  id_tratamiento:  number;
  nombre_paciente: string; // nuevo — necesario para el recibo copiable
  onFirstPago?:    () => void;
  stage?:          number;
}
```

Pasada desde `page.tsx`: `<AccordionPagos ... nombre_paciente={detalle.nombre_paciente} />`.

**`AccordionRecetas.tsx` — refactor interno (sin cambio de props):** extraer de `buildWhatsAppUrl` una función `buildRecetaMessage(...)` que retorna el texto plano (las mismas `lines.join("\n")`), reutilizada tanto por `buildWhatsAppUrl` (que la envuelve en `https://wa.me/...?text=${encodeURIComponent(...)}`) como por el nuevo `<CopyButton text={buildRecetaMessage(...)} />`.

## Plan de implementación

1. **`CopyButton.tsx`.** Crear `app/dashboard/componentes/CopyButton.tsx`: botón que copia `text` con `navigator.clipboard.writeText(text)`, cambia su contenido a `copiedLabel` (default "¡Copiado!") por 2s vía `setTimeout`, y respeta `disabled`/`className`. *Verificación:* `npm run build` compila (nada lo usa aún).

2. **`getTratamientoDetalle`.** Agregar el `LEFT JOIN [dbo].[sucursales]` y el campo `nombre_sucursal` al `SELECT` y al tipo de retorno (`app/dashboard/tratamientos/actions.ts`). *Verificación:* la función sigue retornando el resto de campos sin error; `nombre_sucursal` aparece en la respuesta.

3. **`DetailRow` en `page.tsx`.** Agregar `nombre_sucursal: string | null` al tipo `DetailRow`.

4. **Punto 1 — botón "Copiar solicitud".** En el header de `tratamientos/[id_tratamiento]/page.tsx`, junto al título, agregar `<CopyButton text={buildSolicitudMessage(detalle)} label="Copiar solicitud" />`, donde `buildSolicitudMessage` es una función local que arma el mismo texto que hoy construye `handleConfirmSave` en `tratamiento/page.tsx` (saludo al especialista, paciente, fecha formateada `dd-mm-yyyy hh:mm` desde `detalle.created_at`, `Sucursal: {detalle.nombre_sucursal ?? "Desconocida"}`, cierre invitando a revisar Piezen). *Verificación:* el botón aparece siempre (sin restricción de rol), y el texto copiado coincide campo a campo con el que hoy abre `wa.me` al guardar un tratamiento nuevo.

5. **Punto 2 — `AccordionPagos.tsx`.** Agregar prop `nombre_paciente` a `Props` y recibirla del `page.tsx` (paso ya cubierto en "Modelo de datos"). Agregar una función `buildPagoReceiptMessage(pago, nombre_paciente)` que arme el recibo (etiquetas en negritas: Paciente, Fecha, Tipo, Total, Método de pago, Referencia o "—"). Agregar una nueva columna en la tabla (visible siempre, no solo si `canEdit`) con `<CopyButton text={buildPagoReceiptMessage(p, nombre_paciente)} />` por fila. *Verificación:* el botón aparece para todos los roles que ya ven `AccordionPagos` (no se altera qué roles ven el accordion completo, sigue oculto para `id_role === 5` desde `page.tsx`); el texto copiado refleja los datos exactos de esa fila.

6. **Punto 3 — `AccordionRecetas.tsx`.** Extraer de `buildWhatsAppUrl` la función `buildRecetaMessage(...)` que retorna el texto plano (sin envolver en URL). `buildWhatsAppUrl` pasa a usarla internamente. Agregar `<CopyButton text={buildRecetaMessage(...)} />` junto al botón "WhatsApp" existente en cada fila, misma condición de visibilidad (`id_role !== 5`). *Verificación:* el texto copiado es idéntico, carácter a carácter, al que ya se manda por `wa.me` (antes de `encodeURIComponent`).

7. **Verificación manual completa:**
   - Abrir el detalle de un tratamiento y copiar la solicitud; pegar en un editor de texto y comparar contra el mensaje que hoy abre `wa.me` al crear un tratamiento nuevo (mismo paciente/especialista/fecha/sucursal).
   - Copiar el recibo de un pago individual y confirmar que los campos coinciden con la fila.
   - Copiar el mensaje de una receta y confirmar que coincide con el que abriría el botón "WhatsApp" de esa misma fila.
   - Confirmar que cada botón "Copiar" muestra "¡Copiado!" ~2 segundos y vuelve a su estado normal.
   - Revisar que ningún botón nuevo aparece para `id_role === 5` donde antes no había acceso (Pagos sigue oculto completo; Recetas mantiene su regla existente).
   - Revisar modo claro y oscuro.

8. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [x] `app/dashboard/componentes/CopyButton.tsx` existe, copia el `text` recibido al portapapeles, y muestra un estado "¡Copiado!" (o equivalente) por ~2 segundos antes de volver a su label normal.
- [x] `getTratamientoDetalle` retorna `nombre_sucursal` (nombre de la sucursal de la consulta asociada, o `null` si no tiene), sin romper ningún otro campo ya retornado.
- [x] En `/dashboard/tratamientos/[id_tratamiento]`, el botón "Copiar solicitud" copia un texto idéntico en contenido al que hoy abre `wa.me` automáticamente al guardar un tratamiento nuevo (saludo, paciente, fecha, sucursal, cierre), usando `"Desconocida"` si `nombre_sucursal` es `null`.
- [x] En la tabla "Pagos (Ingresos)" (`AccordionPagos`), cada fila tiene un botón "Copiar" visible para todos los roles que ya ven la tabla, que copia un recibo con paciente, fecha, tipo, total, método de pago y referencia de esa fila específica.
- [x] En `AccordionRecetas`, cada fila con receta tiene un botón "Copiar" junto al botón "WhatsApp" existente (misma visibilidad, `id_role !== 5`), que copia exactamente el mismo texto que ya arma el enlace `wa.me`.
- [x] Ninguno de los tres enlaces/acciones `wa.me` existentes (aviso al especialista, botón WhatsApp de recetas) fue modificado ni eliminado — los botones de copiar son adicionales.
- [x] `AccordionPagos` sigue oculto para `id_role === 5` (sin cambios a esa regla existente en `page.tsx`).
- [x] Los nombres de funciones, variables, componentes y tipos nuevos están en inglés y son descriptivos, conforme a `CLAUDE.md`.
- [x] Las pantallas se ven correctamente en modo claro y oscuro.
- [x] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Copiar es adicional, no reemplaza los enlaces `wa.me` existentes.** El enlace `wa.me` sigue siendo útil cuando se conoce el número de destino (abre la conversación directamente); "Copiar" cubre el caso en que el usuario ya tiene una conversación de WhatsApp abierta (por ejemplo, en otro dispositivo o ventana) y solo necesita pegar el texto ahí. Quitar `wa.me` habría sido una regresión no pedida.
- **Componente compartido `CopyButton` en vez de repetir la lógica en los tres puntos.** Los tres botones necesitan el mismo comportamiento (copiar + feedback momentáneo); centralizarlo evita triplicar `useState`/`setTimeout` y mantiene consistente el look & feel, siguiendo el criterio de reuso de `CLAUDE.md`.
- **Punto 1 reconstruye el texto desde `DetailRow` (registro guardado), no desde el estado del formulario de creación.** El formulario de creación (`tratamiento/page.tsx`) vive en otra ruta y su estado no sobrevive a la navegación; reconstruir desde lo ya persistido es la única opción viable para un botón que vive en el detalle, y da el mismo resultado porque los campos usados en el mensaje (paciente, especialista, fecha, sucursal) ya están en BD.
- **Texto del punto 1 igual al aviso corto actual, sin agregar los datos clínicos (peso/talla/antecedentes).** Se evaluó incluir los datos clínicos completos, pero se decidió mantener el mismo contenido que ya se envía hoy para no cambiar el comportamiento existente sin que se haya pedido explícitamente; agregar los datos clínicos al mensaje de WhatsApp queda fuera de este spec.
- **Botón "Copiar" del recibo de pago visible para todos los que ven la tabla, no solo `canEdit`.** El recibo es información de lectura (no una acción de edición), así que no tiene sentido restringirlo a los mismos roles que pueden editar/eliminar pagos; se limita únicamente por la visibilidad ya existente del accordion completo (`id_role !== 5`).
- **`nombre_sucursal` vía `LEFT JOIN`, no `INNER JOIN`.** Se usa `LEFT JOIN` para no ocultar el tratamiento completo si la consulta asociada no tiene `id_sucursal` asignado (dato histórico o incompleto); en ese caso el mensaje usa el fallback `"Desconocida"`, igual que ya hace `handleConfirmSave`.
- **Sin botón para copiar todos los pagos a la vez.** No se pidió y agregarlo introduciría una decisión de formato (¿lista? ¿suma total?) fuera del alcance pedido, que fue explícitamente "individual al paciente".

## Riesgos identificados

- **`navigator.clipboard.writeText` requiere contexto seguro (HTTPS) y puede fallar/no existir en navegadores muy antiguos o en `iframe`s sin permiso.** Si la promesa rechaza, `CopyButton` debe capturarlo y no dejar la UI en un estado roto (por ejemplo, mostrar el error brevemente en vez de fallar en silencio o lanzar una excepción no capturada). Se acepta el riesgo residual de navegadores no soportados porque el resto del sistema ya asume navegadores modernos (usa `fetch`, `URL.createObjectURL`, etc.).
- **Duplicación del texto del aviso al especialista en dos lugares (`handleConfirmSave` en `tratamiento/page.tsx` y `buildSolicitudMessage` en `page.tsx` del detalle).** Ambos arman el mismo formato de mensaje de forma independiente porque viven en páginas distintas con datos de origen distintos (formulario efímero vs. registro guardado); si el formato del aviso cambia en el futuro, hay que actualizar ambos lugares. No se centraliza en un helper compartido en este spec porque uno recibe `TratamientoFormData`/`sucursal` del contexto y el otro `DetailRow`, y forzar una firma común no aporta claridad proporcional al esfuerzo.
- **`nombre_sucursal` nulo en tratamientos históricos sin `id_sucursal` en su consulta.** El fallback `"Desconocida"` evita que el botón falle, pero el texto copiado no será útil para identificar la sucursal real en esos casos; es el mismo comportamiento que ya tiene `handleConfirmSave` hoy, no una regresión introducida por este spec.

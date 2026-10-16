# 83 — Cloudinary: `remotePatterns` para cualquier cuenta en `ImageSliderModal`

## Header

- **Estado:** Implementado
- **Depende de:** 81 (`lint-limpieza-errores-warnings`), que pasó el slider a `next/image` y restringió `remotePatterns` a la cuenta de `CLOUDINARY_URL`. Corrige la deuda que anotó la 82 (`lint-set-state-in-effect-portales-navegador-derivado`).
- **Modifica base de datos:** No.
- **Fecha:** 2026-10-15
- **Objetivo:** Hacer que `ImageSliderModal` muestre fotos de tratamientos de cualquier cuenta de Cloudinary, cambiando el patrón de `res.cloudinary.com` en `next.config.ts` a `/*/image/upload/**` y quitando su dependencia de `CLOUDINARY_URL`.

## Alcance

**Entra:**

- **`next.config.ts`:** el patrón de Cloudinary en `images.remotePatterns` queda fijo, sin condición:
  - `protocol: "https"`;
  - `hostname: "res.cloudinary.com"`;
  - `pathname: "/*/image/upload/**"`.
- **`next.config.ts`:** se borran la constante `cloudinaryCloudName`, la lectura de `CLOUDINARY_URL` y el JSDoc que la explica. Se reemplazan con un comentario corto: por qué se acepta cualquier cuenta y por qué solo `image/upload`.
- **`specs/82-lint-set-state-in-effect-portales-navegador-derivado.md`:** las referencias a "la 83" / "spec 83" (fetch de datos en effects) pasan a "84".
  - En la sección de deuda, la línea de `next.config.ts` remite a esta spec 83.
- **`specs/81-lint-limpieza-errores-warnings.md`:** una nota en sus Decisiones dice que la restricción a una sola cuenta la reemplazó la spec 83. El texto original no se toca.

**Fuera de alcance (para otras specs):**

- **Migrar las fotos de `dmq9e2wuv` a la cuenta actual** (`ds7odsbwv`), con copia de assets y UPDATE de `ruta` en la base.
- **Cualquier cambio a `ImageSliderModal`**, como `unoptimized` o volver a `<img>`.
- **Cambios a `app/api/upload`.** Sigue subiendo a la cuenta de `CLOUDINARY_URL`.
- **Otros tipos de entrega de Cloudinary:** `image/fetch`, `video/upload`, `raw/upload` y URLs con firma o *private*.
- **Pasar a `next/image` otros lugares que muestran rutas de Cloudinary** (`TabFotos` y `AccordionRecetas` solo las enlazan).
- **Los effects de fetch** (la nueva spec 84).

## Modelo de datos

Esta spec no agrega estructuras de datos ni toca la base. Solo cambia un objeto de configuración en `next.config.ts`.

**Antes** (spec 81, condicionado a `CLOUDINARY_URL`):

```ts
{ protocol: "https", hostname: "res.cloudinary.com", pathname: `/${cloudinaryCloudName}/**` }
```

**Después** (fijo, sin variable de entorno):

```ts
{ protocol: "https", hostname: "res.cloudinary.com", pathname: "/*/image/upload/**" }
```

Cómo se leen los comodines de `remotePatterns` en Next:

- `*` es **un solo** segmento de ruta: el cloud name, por ejemplo `dmq9e2wuv`.
- `**` es cualquier número de segmentos: la versión (`v1780612187`), las carpetas (`clinica/consultas/...`), las transformaciones y el archivo.
- Ejemplo que pasa: `https://res.cloudinary.com/dmq9e2wuv/image/upload/v1780612187/clinica/consultas/rene_garibay_consulta87_VALORACION_U_1.jpg`.
- Ejemplo que **no** pasa: `https://res.cloudinary.com/<cuenta>/image/fetch/https://otro-sitio.com/x.jpg`.

## Plan de implementación

1. **`next.config.ts`: cambiar el patrón de Cloudinary.**
   - Borrar la constante `cloudinaryCloudName` y su JSDoc.
   - Cambiar el spread condicional `...(cloudinaryCloudName ? [...] : [])` por el objeto fijo `{ protocol: "https", hostname: "res.cloudinary.com", pathname: "/*/image/upload/**" }`.
   - Encima del objeto, un comentario de 2–3 líneas: se acepta cualquier cuenta porque hay fotos guardadas en más de una, y solo `image/upload` para que `image/fetch` no convierta el optimizador en un proxy abierto. Mantener la referencia a "spec 81" del comentario actual y agregar "spec 83".
   - Verificar con `npx eslint next.config.ts` (sin errores) y `npx tsc --noEmit` (sin errores nuevos).
   - Prueba manual:
     - reiniciar el dev server;
     - abrir un tratamiento con fotos de `dmq9e2wuv` en Solicitud o Consultas;
     - abrir el slider y recorrer las fotos.
2. **`specs/82-…`: renumerar las referencias a la spec de fetch.**
   - Las menciones de "83" con el sentido de fetch (líneas 6, 14, 34, 72, 367, 368, 369, 379 y 380) pasan a "84".
   - A la línea de deuda de `next.config.ts` se le agrega "Resuelto en la spec 83".
3. **`specs/81-…`: nota en Decisiones.**
   - Debajo de la decisión "El cloud name se deriva de `CLOUDINARY_URL`…", agregar: "*Reemplazada por la spec 83: el patrón acepta cualquier cuenta con `/*/image/upload/**`.*"
   - No se modifica ninguna otra línea.

Cada paso se puede commitear solo. El paso 1 ya corrige el error, y los pasos 2 y 3 son solo documentación.

## Criterios de aceptación

- [ ] `next.config.ts` tiene exactamente un patrón con `hostname: "res.cloudinary.com"`, y su `pathname` es `"/*/image/upload/**"`.
- [ ] `next.config.ts` ya no menciona `CLOUDINARY_URL` ni `cloudinaryCloudName`.
- [ ] `npx eslint next.config.ts` no reporta errores.
- [ ] `npx tsc --noEmit` no reporta errores nuevos en `next.config.ts`.
- [ ] Con el dev server reiniciado, el slider de un tratamiento con fotos de `dmq9e2wuv` abre sin el error "Invalid src prop … hostname "res.cloudinary.com" is not configured".
- [ ] En ese slider, las imágenes se piden a `/_next/image?url=https%3A%2F%2Fres.cloudinary.com%2Fdmq9e2wuv%2F…` (se ve en la pestaña Network) y se muestran.
- [ ] "Anterior", "Siguiente" y los puntos cambian de foto sin errores en la consola.
- [ ] Al hacer clic en la foto se abre la URL original de Cloudinary en otra pestaña.
- [ ] `ImageSliderModal.tsx` y `app/api/upload/route.ts` no tienen cambios en el diff.
- [ ] En `specs/82-…` ya no queda ninguna mención a la spec de fetch como "83", y la línea de deuda de `next.config.ts` remite a la spec 83.
- [ ] `specs/81-…` tiene la nota de reemplazo en Decisiones y ninguna otra línea cambiada.

## Decisiones

**Tomadas:**

- **Cualquier cuenta de Cloudinary, con `pathname: "/*/image/upload/**"`.** En la base hay fotos de tratamientos guardadas en `dmq9e2wuv`, que no es la cuenta de hoy (`ds7odsbwv`). Además puede llegar otra cuenta sin que nadie se acuerde de reconstruir. Limitarlo a `image/upload` bloquea `image/fetch`, con el que Cloudinary trae URLs externas cualquiera. Así nuestro optimizador no sirve imágenes de otros sitios.
- **El patrón ya no depende de `CLOUDINARY_URL`.** Con el comodín de cuenta, el cloud name ya no se usa. Además desaparecen dos riesgos de la spec 81: que falte la variable al hacer el build y que la cuenta cambie sin reconstruir.
- **No se toca `ImageSliderModal`.** El error viene de la configuración, no del componente. El componente sigue usando `next/image`, como decidió la 81.
- **Esta spec toma el número 83 y la de fetch pasa a 84.** Esta es más chica y más urgente. Las referencias de la 82 se corrigen en esta misma spec para que el historial quede coherente.
- **La decisión de la 81 se marca como reemplazada sin borrarla.** Así queda la historia de por qué antes se restringía.

**Descartadas:**

- *`pathname: "/**"` (todo `res.cloudinary.com`):* deja pasar `image/fetch`, `video` y `raw`, que esta app no usa. Abre más superficie sin ganar nada.
- *Una lista de cuentas en una variable nueva (`CLOUDINARY_ALLOWED_CLOUDS`):* sigue restringido, pero obliga a editar el entorno y reconstruir con cada cuenta nueva. Es el mismo modo de falla que esta spec corrige.
- *`unoptimized` en el `<Image>` del slider:* esquiva la validación del host, pero pierde la optimización (tamaño y formato) en el único `next/image` que carga fotos de pacientes.
- *Volver a `<img>`:* revierte una decisión de la 81 y vuelve a encender `@next/next/no-img-element`.
- *Migrar las fotos de `dmq9e2wuv` a la cuenta actual:* mueve assets y hace UPDATE de `ruta` en la base. Merece su propia spec, y con este patrón ya no hace falta para que se vean.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| **Cualquiera puede usar nuestro `/_next/image` para optimizar fotos de *otras* cuentas de Cloudinary** (gasto de CPU y caché del servidor). | Solo se aceptan `image/upload`, nunca `image/fetch` ni hosts externos. Next guarda en caché cada variante optimizada. Si se ve abuso, se vuelve a la lista de cuentas que se descartó en Decisiones. |
| **Hay `ruta` guardadas con otro formato** (`http://`, `image/private`, `image/authenticated` o una URL que no es de Cloudinary). Esas fotos seguirían tronando el slider. | Antes del paso 1, buscar en la base los archivos de tratamiento cuya `ruta` no empiece con `https://res.cloudinary.com/` y no tenga `/image/upload/` en el segundo segmento. Si aparece alguno, se anota como deuda y no se amplía el patrón en esta spec. |
| **El dev server no se reinicia** y parece que el arreglo no funcionó. | `next.config.ts` solo se lee al arrancar. El reinicio está explícito en el paso 1 y en los criterios. |

## Lo que **no** entra en esta spec

- Migrar fotos de `dmq9e2wuv` a la cuenta actual, o hacer UPDATE de `ruta` en la base.
- Cambios a `ImageSliderModal`, a `app/api/upload` o a los componentes que solo enlazan rutas (`TabFotos`, `AccordionRecetas`).
- Aceptar `image/fetch`, `video`, `raw` o URLs privadas o autenticadas de Cloudinary.
- Los effects de fetch con `set-state-in-effect`, que ahora son la spec 84.

Si alguna de estas llega a hacerse, va en su propia spec.

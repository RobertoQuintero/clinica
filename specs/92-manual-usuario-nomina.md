# 92 — Sección de Ayuda y manual de usuario de Nómina

## Header

- **Estado:** Aprobado
- **Depende de:**
  - Ninguna spec técnica. El contenido del manual describe lo que ya construyeron las specs 51 a 91 (nómina) y las pestañas del expediente que la alimentan: 55 (usuarios vinculados), 59 (horario), 71 (datos fiscales), 76 (vacaciones), 79 (días económicos) y 91 (IMSS/SBC).
  - La spec **93** (Sucursal Demo y capturas del manual) depende de esta.
- **Modifica base de datos:** No.
- **Dependencias nuevas (npm):** `react-markdown`, `remark-gfm` (tablas) y `gray-matter` (encabezado YAML de cada página).
- **Fecha:** 2026-10-21
- **Objetivo:** Agregar una sección "Ayuda" con manuales por módulo, escritos en Markdown y visibles según el rol, y estrenarla con el manual de Nómina en lenguaje no técnico, enlazado desde cada pantalla de nómina y del expediente con un ícono "?".

### Contexto (2026-10-21)

- Hoy la app no tiene ninguna sección de ayuda. Lo que se sabe del módulo está en `docs/nomina.md`, que está escrito para desarrolladores en inglés y con nombres de tablas.
- El manual va dirigido a los roles 1 (Admin) y 4 (Admin/supervisor), que son los únicos que entran a nómina.
- Nómina seguirá creciendo (finiquito, cuotas patronales, timbrado) y después llegarán los manuales de otros módulos. La estructura tiene que permitir agregar un módulo sin tocar código, salvo registrarlo.
- Las capturas de pantalla se dejan para la spec 93. Esta spec deja marcado en el texto el lugar de cada una.
- Las pestañas del expediente con "?" son **Datos Personales** (frecuencia, salarios, datos fiscales), **Asistencia** (checadas), **Horario**, **Vacaciones**, **Días económicos**, **IMSS** y **Usuarios**.

## Alcance

**Entra:**

- **Infraestructura de Ayuda (sirve para cualquier módulo).**
  - Contenido en `content/manual/<modulo>/<tema>.md`. Cada archivo lleva un encabezado YAML con título, descripción, sección, orden y fecha de actualización.
  - Registro de módulos en `lib/manual/modules.ts`, con slug, título, descripción y roles permitidos. Agregar un manual nuevo es crear su carpeta y su entrada en el registro.
  - Rutas (todas Server Components):
    - `/dashboard/ayuda`: índice con los módulos que el rol puede ver.
    - `/dashboard/ayuda/[modulo]`: índice del manual, agrupado por sección.
    - `/dashboard/ayuda/[modulo]/[tema]`: la página, con un índice lateral del módulo, "Anterior / Siguiente" y "Actualizado: {fecha}".
  - Renderer de Markdown en el servidor, sin JavaScript extra en el navegador:
    - tablas (GFM);
    - anclas automáticas en los títulos;
    - **cajas de aviso** con la sintaxis de GitHub `> [!NOTE]`, `> [!TIP]` y `> [!WARNING]`, que se muestran como "Nota", "Consejo" y "Atención";
    - **marcador de captura** `![descripción](captura:nombre)`, que en desarrollo se ve como un recuadro punteado con la descripción y fuera de desarrollo no se muestra. La spec 93 lo reemplaza por la imagen real.
  - Enlaces internos entre páginas del manual y hacia las pantallas de la app.
  - Un tema que no existe, o un módulo desconocido, responde 404 (`notFound()`).
- **Acceso por rol.**
  - Cada manual tiene los mismos roles que su módulo. Nómina: roles 1 y 4 (`PAYROLL_ALLOWED_ROLE_IDS`).
  - "Ayuda" aparece en el sidebar, al final, solo para los roles que tienen al menos un manual. Hoy son los roles 1 y 4.
  - Se valida en tres lugares, como en nómina:
    - `proxy.ts`: sin manuales → `/dashboard`; un manual que el rol no tiene → `/dashboard/ayuda`;
    - el filtro del índice;
    - una revisión con la sesión dentro de la página.
- **Ícono "?" contextual.** Un componente compartido `ManualHelpLink` junto al título de:
  - las pantallas de nómina: Periodos, Procesar, Detalle por empleado, Comisiones, Horas extra, Faltas, Retardos, Bonos, PTU (lista y reparto) y Parámetros fiscales;
  - las pestañas del expediente Datos Personales, Asistencia, Horario, Vacaciones, Días económicos, IMSS y Usuarios, que llevan a su ancla en "Preparar al empleado para nómina".
- **Manual de Nómina (17 páginas, en español y sin lenguaje técnico).**
  - *Primeros pasos:* Conceptos básicos · Preparar al empleado para nómina.
  - *Pantallas:* Periodos · Procesar nómina · Detalle por empleado · Comisiones · Horas extra · Faltas · Retardos · Bonos · PTU (reparto) · Parámetros fiscales.
  - *Tutoriales:* Pagar una nómina ordinaria de principio a fin · Pagar el aguinaldo · Repartir y pagar la PTU · Inicio de año: UMA, salario mínimo y tarifas de ISR.
  - *Avisos y preguntas frecuentes:* qué significa cada aviso ("Recalcula", "No calculado", "Sin horario definido", "Checada incompleta", empleados excluidos, fechas límite de aguinaldo y PTU) y qué hacer con cada uno.
  - Botones, columnas y avisos se nombran **exactamente como aparecen en pantalla**.
  - Cada lugar donde va una captura queda marcado con `captura:`.
  - El manual describe lo que existe hoy. Lo que aún no está (Aprobada/Pagada, timbrado, cuotas patronales, finiquito) se menciona una sola vez en "Conceptos básicos" como "todavía no disponible".
- **Mantenimiento.**
  - `docs/manual-usuario.md` explica la estructura, el encabezado YAML, las cajas de aviso, los marcadores de captura y cómo agregar el manual de otro módulo.
  - Una regla en `CLAUDE.md`: toda spec que cambie una pantalla con manual debe actualizar su página y su fecha de "Actualizado". También se agrega `content/manual/` a las convenciones de carpetas.

**No entra (para specs futuras):**

- Capturas de pantalla y la Sucursal Demo con datos ficticios (**spec 93**).
- Manuales de otros módulos (Citas, Pacientes, Inventario, Facturación, Empleados completo…). Cada uno, en su spec.
- Abrir "Ayuda" a los roles 2, 3, 5 y 6. Llega con el primer manual que les corresponda, y para los roles 5 y 6 eso implica tocar sus excepciones en `proxy.ts`.
- Buscador dentro del manual.
- Índice "En esta página" con los subtítulos de cada página.
- Versión imprimible o exportación a PDF.
- Videos o GIFs.
- Editar el manual desde la app (se edita en el repo).
- Ayuda en ventanas emergentes (tooltips) dentro de los formularios.
- Traducción a otros idiomas.

## Modelo de datos

No se toca la base de datos. Todo lo nuevo son archivos de contenido y estructuras de TypeScript.

### Archivos de contenido

```
content/manual/
  nomina/
    conceptos-basicos.md            (primeros-pasos, 1)
    preparar-empleado.md            (primeros-pasos, 2)
    periodos.md                     (pantallas, 1)
    procesar-nomina.md              (pantallas, 2)
    detalle-empleado.md             (pantallas, 3)
    comisiones.md                   (pantallas, 4)
    horas-extra.md                  (pantallas, 5)
    faltas.md                       (pantallas, 6)
    retardos.md                     (pantallas, 7)
    bonos.md                        (pantallas, 8)
    ptu.md                          (pantallas, 9)
    parametros-fiscales.md          (pantallas, 10)
    tutorial-nomina-ordinaria.md    (tutoriales, 1)
    tutorial-aguinaldo.md           (tutoriales, 2)
    tutorial-ptu.md                 (tutoriales, 3)
    tutorial-inicio-de-anio.md      (tutoriales, 4)
    avisos-y-preguntas.md           (avisos, 1)
```

- El slug del tema es el nombre del archivo sin `.md` y solo admite `^[a-z0-9-]+$`.
- `preparar-empleado.md` tiene un `##` por pestaña del expediente, con estos títulos: "Datos personales", "Asistencia", "Horario", "Vacaciones", "Días económicos", "IMSS" y "Usuarios".

### Encabezado YAML de cada página

```yaml
---
title: "Periodos"
description: "Crear, editar y eliminar los periodos de pago de la sucursal."
section: "pantallas"
order: 1
updated: "2026-10-21"   # entre comillas: sin ellas, gray-matter lo convierte en Date
---
```

```ts
// lib/manual/schemas.ts
export const manualPageFrontmatterSchema = z.object({
  title:       z.string().min(1),
  description: z.string().min(1),
  section:     z.enum(["primeros-pasos", "pantallas", "tutoriales", "avisos"]),
  order:       z.number().int().positive(),
  updated:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),   // nunca Date
});

// Slugs que llegan por la URL: se validan antes de tocar el disco (evita ../).
export const manualSlugSchema = z.string().regex(/^[a-z0-9-]+$/);
```

Un encabezado inválido hace fallar la carga con el nombre del archivo y el campo. No hay valores por omisión.

### Tipos (`interfaces/manual.ts`)

```ts
export type ManualSection = "primeros-pasos" | "pantallas" | "tutoriales" | "avisos";

export interface IManualModule {
  slug: string;                       // "nomina"; coincide con la carpeta de content/manual/
  title: string;                      // "Nómina"
  description: string;
  allowedRoleIds: readonly number[];  // nómina: PAYROLL_ALLOWED_ROLE_IDS
}

export interface IManualPageSummary {
  moduleSlug: string;
  slug: string;
  title: string;
  description: string;
  section: ManualSection;
  order: number;
  updated: string;                    // "YYYY-MM-DD"
}

export interface IManualPage extends IManualPageSummary {
  body: string;                       // Markdown sin el encabezado YAML
  previous: IManualPageSummary | null;
  next: IManualPageSummary | null;
}
```

### Registro y constantes (`lib/manual/modules.ts`, puro y sin imports de servidor, porque lo usa `proxy.ts`)

```ts
export const MANUAL_MODULES: readonly IManualModule[] = [
  {
    slug: "nomina",
    title: "Nómina",
    description: "Periodos, cálculo, incidencias, bonos, aguinaldo, PTU e impuestos.",
    allowedRoleIds: PAYROLL_ALLOWED_ROLE_IDS,
  },
];

export const MANUAL_SECTION_LABELS: Record<ManualSection, string> = {
  "primeros-pasos": "Primeros pasos",
  pantallas: "Pantallas",
  tutoriales: "Tutoriales",
  avisos: "Avisos y preguntas frecuentes",
};
export const MANUAL_SECTION_ORDER: readonly ManualSection[] =
  ["primeros-pasos", "pantallas", "tutoriales", "avisos"];

export const MANUAL_CALLOUT_LABELS = { NOTE: "Nota", TIP: "Consejo", WARNING: "Atención" } as const;

// Funciones: getVisibleManualModules(roleId), canViewManualModule(roleId, moduleSlug)
// y MANUAL_VISIBLE_ROLE_IDS (unión de allowedRoleIds; hoy [1, 4]).
```

- **Íconos:** el registro no importa `lucide-react`, para no meterlo al bundle de `proxy.ts`. El ícono de cada módulo vive en `app/dashboard/ayuda/componentes/manualModuleIcons.ts` (`nomina` → `Banknote`). El ícono de "Ayuda" en el sidebar es `BookOpen`.
- **Sidebar:** "Ayuda" lleva `excludeRoles: [2, 3, 5, 6]` con el comentario "complemento de `MANUAL_VISIBLE_ROLE_IDS`", igual que hoy se hace con nómina.

### Carga del contenido (`lib/manual/content.ts`, `server-only`)

- `loadManualPages(moduleSlug): Promise<IManualPageSummary[]>`: lee la carpeta, valida cada encabezado y ordena por `MANUAL_SECTION_ORDER` y luego por `order`. Usa `cache()` de React para leer una sola vez por request.
- `loadManualPage(moduleSlug, pageSlug): Promise<IManualPage | null>`: valida los dos slugs con `manualSlugSchema`, devuelve `null` si el archivo no existe y calcula `previous` y `next` en el orden de arriba.

### Enlaces (`lib/manual/links.ts`)

```ts
export const PAYROLL_MANUAL_TOPICS = {
  basicConcepts: "conceptos-basicos",
  employeeSetup: "preparar-empleado",
  periods: "periodos",
  processPayroll: "procesar-nomina",
  employeeDetail: "detalle-empleado",
  commissions: "comisiones",
  overtime: "horas-extra",
  absences: "faltas",
  lateness: "retardos",
  bonuses: "bonos",
  profitSharing: "ptu",
  taxParameters: "parametros-fiscales",
  // …tutoriales y avisos
} as const;

export const EMPLOYEE_SETUP_ANCHORS = {
  personalData: "datos-personales",
  attendance: "asistencia",
  schedule: "horario",
  vacations: "vacaciones",
  economicDays: "dias-economicos",
  imss: "imss",
  users: "usuarios",
} as const;

// buildManualHref("nomina", "periodos") → "/dashboard/ayuda/nomina/periodos"
// buildManualHref("nomina", "preparar-empleado", "horario") → "…/preparar-empleado#horario"
```

### Convenciones del Markdown

- **Anclas sin acentos.** Cada `##` y `###` recibe un `id` sin acentos ni mayúsculas ("Días económicos" → `dias-economicos`), con un plugin propio de rehype en `lib/manual/rehypeHeadingIds.ts`. No se usa `rehype-slug` porque deja acentos en el ancla (`#días-económicos`).
- **Cajas de aviso:** un blockquote cuya primera línea es `[!NOTE]`, `[!TIP]` o `[!WARNING]`. Cualquier otro blockquote se muestra normal.
- **Marcador de captura:** `![Descripción de la captura](captura:periodos-listado)`. El nombre sigue `^[a-z0-9-]+$` y es el nombre que tendrá el archivo de la spec 93 (`public/manual/nomina/periodos-listado.png`). En esta spec, el marcador se ve como un recuadro punteado en desarrollo (`NODE_ENV === "development"`) y no se muestra fuera de desarrollo.
- **Enlaces:** a otra página del manual con ruta relativa (`[Periodos](./periodos)`) y a una pantalla de la app con ruta absoluta (`[Procesar nómina](/dashboard/nomina/procesar)`). Los enlaces internos usan `next/link`.
- **Fechas:** `updated` se muestra como "21 de octubre de 2026", normalizada con `"T00:00:00"` antes de formatear (regla 4 de fechas de `CLAUDE.md`).

## Plan de implementación

1. **Cimientos sin UI.**
   - Instalar `react-markdown`, `remark-gfm` y `gray-matter`.
   - Crear `interfaces/manual.ts`, `lib/manual/schemas.ts`, `lib/manual/modules.ts` (registro, etiquetas, `getVisibleManualModules`, `canViewManualModule` y `MANUAL_VISIBLE_ROLE_IDS`), `lib/manual/content.ts` (`loadManualPages` y `loadManualPage`) y `lib/manual/links.ts`.
   - En `next.config`, `outputFileTracingIncludes` para que `content/manual/**` se empaquete con las rutas de `/dashboard/ayuda`. Así el manual funciona en un despliegue serverless, donde el disco solo trae lo que Next rastrea.
   - Crear `content/manual/nomina/conceptos-basicos.md` con su encabezado y un texto de una línea.
   - *Verificación:* `npx tsc --noEmit` y `npm run lint` quedan limpios.

2. **Rutas y renderer.**
   - `lib/manual/rehypeHeadingIds.ts` (anclas sin acentos).
   - `app/dashboard/ayuda/componentes/` con:
     - `ManualMarkdown`: `react-markdown` + `remark-gfm`, cajas de aviso, marcador de captura, `next/link` para enlaces internos y tablas con scroll horizontal en móvil;
     - `ManualPageIndex`: índice lateral agrupado por sección y marcando la página actual; en móvil se colapsa en un `<details>`;
     - `ManualPagerLinks`: Anterior / Siguiente;
     - `manualModuleIcons.ts`.
   - `app/dashboard/ayuda/page.tsx`, `[modulo]/page.tsx` y `[modulo]/[tema]/page.tsx`. Todos son Server Components, leen la sesión, responden `notFound()` con un módulo o tema desconocido y redirigen a `/dashboard/ayuda` si el rol no puede ver el módulo.
   - Se usa `frontend-design` para las tres pantallas.
   - *Verificación:* en `conceptos-basicos.md` pongo temporalmente una tabla, las tres cajas de aviso, un marcador `captura:` y un enlace interno, y todos se ven bien en claro, oscuro y a 375 px. `/dashboard/ayuda/nomina/no-existe` y `/dashboard/ayuda/otro/x` dan 404. Al terminar se quita el contenido temporal.

3. **Acceso y sidebar.**
   - En `proxy.ts`, la regla de `/dashboard/ayuda`: si el rol no tiene ningún manual, a `/dashboard`; si no tiene el módulo de la URL, a `/dashboard/ayuda`. Usa `MANUAL_MODULES`.
   - En `navConfig.tsx`, la entrada "Ayuda" (`BookOpen`) al final, con `excludeRoles: [2, 3, 5, 6]` y su comentario.
   - *Verificación:* con los roles 1 y 4 se ve "Ayuda" y se abre el manual. Con los roles 2 y 3 no aparece, y escribir la URL a mano los manda a `/dashboard`. Los roles 5 y 6 siguen yendo a Tratamientos y a Inventario.

4. **Esqueleto completo del manual de nómina.**
   - Crear las 17 páginas con su encabezado YAML definitivo, los títulos `##` de cada una y los marcadores `captura:`. El cuerpo todavía puede ser breve.
   - Las páginas de pantalla siguen esta plantilla:
     - Para qué sirve
     - Antes de empezar
     - Qué ves en la pantalla
     - Cómo… (una subsección por tarea)
     - Cómo calcula (reglas en lenguaje llano, con un ejemplo con números)
     - Avisos de esta pantalla
     - Relacionado
   - Los tutoriales siguen esta otra:
     - Qué vas a lograr
     - Antes de empezar
     - Pasos (numerados, con enlace a cada pantalla)
     - Cómo saber que quedó bien
     - Errores comunes
   - `preparar-empleado.md` tiene los 7 `##` que corresponden a `EMPLOYEE_SETUP_ANCHORS`.
   - *Verificación:* el índice del módulo muestra las 17 páginas en 4 secciones y en el orden del modelo de datos, y Anterior / Siguiente recorre las 17 sin saltos.

5. **Ícono "?" contextual.**
   - `app/dashboard/componentes/ManualHelpLink.tsx`, un Server Component con `topicSlug`, `anchor` opcional y `aria-label="Ver ayuda de esta pantalla"`. Usa `buildManualHref`.
   - Se coloca junto al `<h2>` de las 12 pantallas de nómina (Periodos, Procesar, Detalle, Comisiones, Horas extra, Faltas, Retardos, Bonos, PTU lista, PTU reparto y Parámetros fiscales) y en las 7 pestañas del expediente, cada una con su ancla.
   - *Verificación:* cada uno de los 19 íconos abre la página correcta, y los del expediente bajan a su sección.

6. **Contenido: Primeros pasos.** Redactar `conceptos-basicos.md` y `preparar-empleado.md` a partir de `docs/nomina.md`, `docs/rh-empleados.md` y las pantallas reales.
   - *Verificación:* cada botón, pestaña, columna y aviso que se nombra existe con ese texto exacto en el código (búsqueda con Grep), y no aparecen nombres de tablas, números de spec ni SQL.

7. **Contenido: Periodos, Procesar nómina y Detalle por empleado.** Misma fuente y misma verificación que el paso 6.

8. **Contenido: Comisiones, Horas extra, Faltas, Retardos y Bonos.** Misma fuente y misma verificación.

9. **Contenido: PTU y Parámetros fiscales.** Misma fuente y misma verificación.

10. **Contenido: los 4 tutoriales y Avisos y preguntas frecuentes.**
    - Los pasos de cada tutorial se ejecutan contra la app en la base de desarrollo para confirmar que el orden y los textos coinciden.
    - "Avisos y preguntas frecuentes" cubre cada aviso que existe en `nomina/componentes/` y en `procesar/componentes/`.
    - *Verificación:* igual que el paso 6. Además, cada componente de aviso tiene su entrada.

11. **Documentación y regla de mantenimiento.**
    - `docs/manual-usuario.md`: estructura, encabezado YAML, plantillas de página, cajas de aviso, marcadores de captura, reglas de redacción (no técnico y con los textos exactos de pantalla) y cómo agregar el manual de otro módulo (carpeta, entrada en `MANUAL_MODULES`, ícono, ajuste de `excludeRoles` en "Ayuda" y, si aplica, la excepción del rol en `proxy.ts`).
    - En `CLAUDE.md`: la sección "Manual de usuario" con la regla "toda spec que cambie una pantalla con manual actualiza su página y su `updated`", y `content/manual/` en las convenciones de carpetas.

## Criterios de aceptación

**Infraestructura**

- [ ] `/dashboard/ayuda` muestra una tarjeta por módulo visible para el rol. Hoy, con los roles 1 y 4, solo "Nómina".
- [ ] `/dashboard/ayuda/nomina` muestra las 17 páginas agrupadas en "Primeros pasos", "Pantallas", "Tutoriales" y "Avisos y preguntas frecuentes", en el orden del modelo de datos.
- [ ] Cada página muestra su título, "Actualizado: {fecha en español}", el índice lateral con la página actual marcada, y "Anterior / Siguiente". La primera página no tiene "Anterior" y la última no tiene "Siguiente".
- [ ] `/dashboard/ayuda/nomina/no-existe`, `/dashboard/ayuda/otro/periodos` y `/dashboard/ayuda/nomina/..%2F..%2Fpackage` responden 404 y no leen nada fuera de `content/manual/`.
- [ ] Un encabezado YAML sin `updated`, con `updated` sin comillas o con una `section` desconocida hace fallar la carga con un mensaje que nombra el archivo y el campo.
- [ ] Las tablas Markdown se ven como tablas y tienen scroll horizontal propio a 375 px, sin scroll horizontal en la página.
- [ ] `> [!NOTE]`, `> [!TIP]` y `> [!WARNING]` se muestran como cajas "Nota", "Consejo" y "Atención" con su color, legibles en tema claro y oscuro.
- [ ] Un marcador `captura:` se ve como un recuadro punteado con su descripción en `npm run dev` y no aparece en `npm run build && npm start`.
- [ ] Un título "## Días económicos" genera el ancla `#dias-economicos`.
- [ ] Los enlaces entre páginas del manual y hacia las pantallas de la app navegan sin recargar la página completa (`next/link`).
- [ ] Las tres rutas de Ayuda y sus componentes son Server Components: ninguno lleva `"use client"`.

**Acceso**

- [ ] Los roles 1 y 4 ven "Ayuda" al final del sidebar y pueden abrir todas las páginas del manual de nómina.
- [ ] Los roles 2 y 3 no ven "Ayuda" en el sidebar, y al escribir `/dashboard/ayuda` o `/dashboard/ayuda/nomina/periodos` en la URL terminan en `/dashboard`.
- [ ] Los roles 5 y 6 se siguen redirigiendo a Tratamientos y a Inventario, como antes de la spec.

**Ícono "?"**

- [ ] Las 12 pantallas de nómina (Periodos, Procesar nómina, Detalle por empleado, Comisiones, Horas extra, Faltas, Retardos, Bonos, PTU lista, PTU reparto y Parámetros fiscales) muestran el "?" junto a su título, y cada uno abre su página del manual.
- [ ] Las 7 pestañas del expediente (Datos Personales, Asistencia, Horario, Vacaciones, Días económicos, IMSS y Usuarios) muestran el "?", y cada uno abre "Preparar al empleado para nómina" en su sección.
- [ ] Cada "?" tiene `aria-label="Ver ayuda de esta pantalla"` y se puede activar con el teclado.

**Contenido**

- [ ] Existen las 17 páginas del modelo de datos, cada una con contenido en todos sus títulos `##` y sin "en construcción".
- [ ] Las páginas de pantalla tienen las secciones de su plantilla (Para qué sirve, Antes de empezar, Qué ves en la pantalla, Cómo…, Cómo calcula, Avisos de esta pantalla, Relacionado). Las de tutorial tienen las suyas (Qué vas a lograr, Antes de empezar, Pasos, Cómo saber que quedó bien, Errores comunes).
- [ ] Cada "Cómo calcula" de Procesar, Comisiones, Horas extra, Faltas, Retardos, Bonos y PTU incluye al menos un ejemplo con números.
- [ ] Cada botón, pestaña, columna, tarjeta y aviso nombrado entre comillas en el manual existe con ese texto exacto en el código de la app.
- [ ] El manual no contiene nombres de tablas o columnas de la base, números de spec, SQL ni números de `id_role`. Los roles se nombran por su función.
- [ ] Cada componente de aviso de `app/dashboard/nomina/componentes/` y `app/dashboard/nomina/procesar/componentes/` (por ejemplo `PayrollRecalculationNotice`, `ImssNotCalculatedNotice`, `IsrNotCalculatedNotice`, `EmployeesWithoutScheduleNotice`, `ExcludedEmployeesNotice`, `ChristmasBonusDeadlineNotice` y `PtuPaymentDeadlineNotice`) tiene su entrada en "Avisos y preguntas frecuentes", con qué significa y qué hacer.
- [ ] Los pasos de los 4 tutoriales se ejecutaron en la base de desarrollo y llegan al resultado que describen.
- [ ] "Conceptos básicos" menciona, en un solo lugar, lo que todavía no existe: Aprobada/Pagada, timbrado, cuotas patronales y finiquito.
- [ ] Cada página lleva al menos un marcador `captura:` donde la spec 93 pondrá su imagen.

**Calidad y mantenimiento**

- [ ] `npx tsc --noEmit` termina sin errores y `npm run lint` no agrega errores ni warnings nuevos.
- [ ] `npm run build` termina sin errores y, con `npm start`, las páginas del manual cargan.
- [ ] `docs/manual-usuario.md` explica la estructura, el encabezado YAML, las plantillas, las cajas de aviso, los marcadores de captura, las reglas de redacción y los pasos para agregar el manual de otro módulo.
- [ ] `CLAUDE.md` tiene la sección "Manual de usuario" con la regla de mantenimiento, y lista `content/manual/` en las convenciones de carpetas.

## Decisiones

**Dónde vive y para quién**

| Decisión | Por qué |
|---|---|
| **Sí:** manual dentro de la app (`/dashboard/ayuda`) | El usuario lo encuentra donde trabaja, y cada módulo nuevo es una carpeta más. |
| **No:** solo archivos `.md` en el repo | Solo los leerían los desarrolladores. |
| **No:** documento externo (Word, PDF o Claude Docs) | Se desactualiza fuera del flujo de las specs, y nadie lo revisa cuando cambia una pantalla. |
| **Sí:** escrito para los roles 1 y 4, en lenguaje no técnico y con los textos exactos de pantalla | Son quienes operan la nómina. Lo técnico ya está en `docs/nomina.md`. |
| **Sí:** referencia por pantalla más 4 tutoriales y una página de avisos | La referencia contesta "¿qué significa esto?", y los tutoriales enseñan el flujo completo, que ninguna pantalla muestra sola. |
| **Sí:** incluir "Preparar al empleado para nómina" con las 7 pestañas del expediente | La mayoría de los "No calculado" y de los empleados excluidos vienen de datos que faltan en el expediente. |

**Formato y renderer**

| Decisión | Por qué |
|---|---|
| **Sí:** Markdown con encabezado YAML, renderizado en el servidor con `react-markdown` + `remark-gfm` | Lo edita cualquiera, se ve bien en GitHub y no agrega JavaScript al navegador. |
| **No:** MDX | Requiere configurar `next.config` y mezclar React con el texto. No hace falta: las cajas de aviso se resuelven con una convención. |
| **No:** páginas `.tsx` escritas a mano | Cada cambio de texto se volvería un cambio de código. |
| **Sí:** cajas de aviso con la sintaxis de GitHub (`[!NOTE]`, `[!TIP]`, `[!WARNING]`) | Se ven igual en la app y en la vista previa del repo, y no inventan sintaxis. |
| **Sí:** plugin propio para las anclas, sin acentos | `rehype-slug` deja `#días-económicos`. Un ancla sin acentos es estable y se escribe fácil en los enlaces del "?". |
| **No:** `rehype-slug` | Por lo anterior. |
| **Sí:** `updated` como string entre comillas, validado con `zod` | `gray-matter` convierte una fecha sin comillas en `Date`, y el proyecto prohíbe `Date` para fechas. Si falla la validación, el error es visible y no pasa en silencio. |
| **Sí:** validar los slugs de la URL con `^[a-z0-9-]+$` antes de leer el disco | Los slugs llegan del usuario. Sin esa validación, `../` podría leer archivos fuera de `content/manual/`. |
| **Sí:** `outputFileTracingIncludes` para `content/manual/**` | En un despliegue serverless, el disco solo trae lo que Next rastrea, y el manual daría 404 en producción. |

**Acceso y navegación**

| Decisión | Por qué |
|---|---|
| **Sí:** cada manual con los roles de su módulo, validado en `proxy.ts`, en el índice y en la página | Es el mismo patrón de tres candados que nómina, y nadie lee cómo usar una pantalla a la que no entra. |
| **Sí:** ocultar "Ayuda" a los roles sin manuales (hoy 2, 3, 5 y 6) | Nadie ve una entrada vacía. |
| **No:** abrir ya `/dashboard/ayuda` a los roles 5 y 6 | Tocaría sus excepciones de `proxy.ts` para mostrar un índice vacío. Se hace cuando llegue su primer manual. |
| **Sí:** el registro de módulos sin `lucide-react` y con los íconos aparte | `proxy.ts` importa el registro, y un ícono metería la librería al bundle del middleware. |
| **Sí:** "Ayuda" en el sidebar **y** un "?" contextual | El sidebar sirve para explorar, y el "?" contesta la duda en el momento en que surge. |
| **Sí:** "?" también en Datos Personales y Asistencia, además de Horario, Vacaciones, Días económicos, IMSS y Usuarios | Salarios, frecuencia, datos fiscales y checadas también alimentan la nómina. |

**Capturas y alcance**

| Decisión | Por qué |
|---|---|
| **Sí:** dividir en spec 92 (Ayuda + texto) y spec 93 (Sucursal Demo + capturas) | Eran cuatro áreas en una spec. Los datos demo tienen decisiones propias (empresa, acceso del admin, reparto de PTU de prueba) que no deben frenar el manual. |
| **Sí:** marcadores `captura:<nombre>` desde esta spec | La spec 93 sabe exactamente qué capturas tomar y dónde van, sin releer el manual completo. |
| **Sí:** el marcador solo se ve en desarrollo | En producción, un recuadro "Captura pendiente" se vería como un error. |
| **Sí:** la Sucursal Demo se queda en la base de desarrollo (para la spec 93) | Permite volver a tomar las capturas cuando el módulo crezca. |
| **No:** buscador, índice "En esta página", PDF, videos o edición desde la app | No hacen falta para 17 páginas. Cada uno puede llegar en su spec. |
| **Sí:** el manual describe solo lo que existe hoy y menciona lo pendiente una vez | Un manual que promete funciones inexistentes pierde la confianza del usuario. |

**Mantenimiento**

| Decisión | Por qué |
|---|---|
| **Sí:** regla en `CLAUDE.md`: toda spec que cambie una pantalla con manual actualiza su página y `updated` | Nómina sigue creciendo (finiquito, cuotas patronales, timbrado). Sin la regla, el manual se desactualiza en la siguiente spec. |
| **Sí:** `docs/manual-usuario.md` con los pasos para agregar el manual de otro módulo | El siguiente manual (Citas, Inventario…) debe salir sin tener que reconstruir las convenciones. |

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| **El manual se desactualiza** cuando una spec futura cambia una pantalla y nadie toca su página. | La regla en `CLAUDE.md` y la fecha "Actualizado" en cada página, que deja ver cuándo se revisó por última vez. Cada spec nueva de nómina puede incluir en sus criterios "la página del manual está actualizada". |
| **El manual explica mal una regla de cálculo** (por ejemplo, días de IMSS o exento de PTU) y el usuario toma decisiones con esa información. | El texto se redacta desde `docs/nomina.md` y las pantallas reales, y los tutoriales se ejecutan en la base de desarrollo. Antes de aprobar, el contador lee "Cómo calcula" de Procesar, Parámetros fiscales y PTU. |
| **Nombres de botones o avisos que cambian** y dejan el manual con textos que ya no existen. | Criterio de aceptación con búsqueda en el código. `docs/manual-usuario.md` pide repetir esa búsqueda al cambiar un texto de pantalla. |
| **`content/manual/` no llega al servidor** en un despliegue serverless y el manual da 404 en producción. | `outputFileTracingIncludes` en `next.config`, y el criterio de `npm run build && npm start`. |
| **Lectura de archivos fuera de la carpeta** con un slug manipulado en la URL. | `manualSlugSchema` antes de construir la ruta, y el criterio de 404 con `..%2F`. |
| **Un encabezado YAML mal escrito** rompe la página de ayuda. | La validación con `zod` falla con el nombre del archivo y el campo, así que se detecta en desarrollo o en `build` y no en silencio. |
| **`react-markdown` agrega peso o rompe el bundle** si algún componente cliente lo importa. | Solo `ManualMarkdown` lo importa, y es un Server Component. El criterio exige que las rutas de Ayuda no lleven `"use client"`. |
| **El "?" apunta a un ancla que cambió** porque alguien renombró un `##` de "Preparar al empleado". | Las anclas viven en `EMPLOYEE_SETUP_ANCHORS`, y `docs/manual-usuario.md` dice que renombrar uno de esos títulos obliga a actualizar la constante. |
| **Los roles nuevos o los cambios de acceso a nómina** no se reflejan en Ayuda. | El manual de nómina usa `PAYROLL_ALLOWED_ROLE_IDS` directamente, así que se mueve con nómina. Solo el `excludeRoles` del sidebar es manual, igual que hoy en nómina, y lleva su comentario. |

## Lo que **no** entra en esta spec

- Capturas de pantalla y la Sucursal Demo con datos ficticios (spec 93).
- Manuales de otros módulos.
- Abrir "Ayuda" a los roles 2, 3, 5 y 6.
- Buscador, índice "En esta página", versión imprimible o PDF, videos y GIFs.
- Editar el manual desde la app.
- Ayuda en ventanas emergentes dentro de los formularios.
- Traducción a otros idiomas.

Cada uno, si llega, va en su propia spec.

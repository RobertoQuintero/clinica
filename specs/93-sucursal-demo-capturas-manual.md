# 93 — Sucursal Demo y capturas de pantalla del manual de Nómina

## Header

- **Estado:** Implementado
- **Depende de:**
  - 92 (`manual-usuario-nomina`): los 16 marcadores `captura:` de `content/manual/nomina/`, `ManualMarkdown` y `docs/manual-usuario.md`.
  - Las specs de nómina 51 a 91. La demo alimenta sus pantallas con datos ficticios y las calcula con su motor, sin cambiar ninguna regla.
  - 55 (`empleado-vincular-usuarios`): las comisiones llegan al empleado a través de `users.id_empleado`.
- **Modifica base de datos:** No cambia el esquema. Solo inserta y borra filas de la Empresa Demo, y únicamente en la base de desarrollo.
- **Dependencias nuevas (npm, solo desarrollo):** `tsx` (correr scripts TypeScript con el alias `@/`) y `@playwright/test` (navegador para preparar y capturar).
- **Fecha:** 2026-10-21
- **Objetivo:** Sembrar en la base de desarrollo una Empresa Demo aislada, con empleados y movimientos ficticios, y generar con Playwright las 16 capturas del manual de Nómina, que `ManualMarkdown` muestra en lugar de los marcadores.

### Contexto (2026-10-21)

- La spec 92 dejó 16 marcadores `![…](captura:<nombre>)`. Hoy se ven como "Captura pendiente" en desarrollo y no se muestran en producción.
- Las capturas no pueden salir de datos reales: llevan nombres, salarios y RFC de empleados.
- Varias partes de nómina se separan **por empresa** y no por sucursal: los rangos de comisión, la configuración de comisión por tratamientos, el reparto de PTU y los productos. Una sucursal demo dentro de la empresa real se mezclaría con ellos. Por eso la demo es una empresa propia, con su sucursal y su usuario.
- **Parámetros fiscales es global** (no se separa por empresa). La demo no lo escribe: usa lo que ya tenga la base de desarrollo para el año en curso.
- Las server actions exigen sesión (`assertPayrollAccess()` lee la cookie), así que la semilla no puede calcular nada. Siembra solo **entradas**, y los cálculos los hace la app real, manejada por Playwright con el usuario demo.
- La base de desarrollo es distinta de la de producción, pero `.env.local` puede apuntar a cualquiera de las dos. La semilla lleva candado.

## Alcance

**Entra:**

- **Semilla de la Empresa Demo** (`npm run seed:demo`, script `scripts/seed-demo-nomina.ts` corrido con `tsx`).
  - **Candado:**
    - no corre sin `ALLOW_DEMO_SEED=true` en `.env.local`;
    - muestra `DB_HOST` y `DB_NAME`;
    - pide escribir `demo` para continuar.
  - **Requisitos previos:** antes de escribir, revisa que la base tenga, para el año en curso, UMA, salario mínimo, tarifa ISR semanal, tarifa ISR mensual y subsidio al empleo. Si falta alguno, aborta y lista lo que falta. No escribe parámetros fiscales.
  - **Idempotente por reconstrucción:**
    - cada corrida borra toda la Empresa Demo y la vuelve a crear con fechas relativas a hoy;
    - `npm run seed:demo -- --remove` solo la borra;
    - la demo se identifica por el nombre exacto `"Empresa Demo"` **y** por el usuario `demo@centropodologico.test`. Si no coinciden los dos, no se borra nada.
  - **Qué crea:**
    - "Empresa Demo" y "Sucursal Demo".
    - El usuario "Usuario Demo", con rol 1, `sucursales_string` igual a la Sucursal Demo, aprobado y con la contraseña de `DEMO_USER_PASSWORD` (obligatoria).
    - **7 empleados ficticios**, todos con frecuencia semanal, régimen 02, SBC vigente, horario semanal y RFC, CURP y NSS ficticios de formato válido. Los nombres salen de una lista fija:
      - 3 podólogos, cada uno con un usuario rol 2 vinculado (contraseña aleatoria, sin uso);
      - 1 recepcionista;
      - 1 gerente de sucursal, categoría PTU "confianza";
      - 1 auxiliar que ingresó a mitad de año;
      - 1 director, categoría PTU "excluido".
    - **Entradas de nómina**, desde la primera semana del año en curso hasta hoy:
      - checadas, con horas extra, faltas, retardos y una checada incompleta;
      - pacientes y consultas atendidas de los podólogos;
      - tratamientos de onicomicosis con pagos que llegan al umbral de liquidación;
      - productos demo con `bono_venta`, vendidos en consultas y en mostrador;
      - rangos de comisión, configuración de comisión por tratamientos, horas extra, retardos, bonos de puntualidad y asistencia, y una asignación de extensión de jornada.
    - **Periodos:**
      - uno semanal por cada semana del año en curso, hasta la última semana terminada, todos en "Abierto";
      - la semana en curso, abierta;
      - el periodo de aguinaldo del año en curso.
    - **Reparto de PTU** del año en curso, en borrador y con sus parámetros (`renta_gravable` ficticia).
- **Preparación y capturas** (`npm run capture:manual`, script `scripts/capture-manual-screenshots.ts` con Playwright y Chromium).
  - Corre contra un `npm run dev` ya levantado (`MANUAL_CAPTURE_BASE_URL`, por omisión `http://localhost:3000`) y entra por `/login` como el usuario demo.
  - **Fase de preparación**, siempre por la interfaz real:
    - autoriza las horas extra sembradas;
    - calcula todos los periodos semanales terminados y el aguinaldo;
    - precarga y cierra el reparto de PTU;
    - deja un periodo con el aviso "Recalcula" pendiente.
  - **Fase de captura:**
    - recorre la lista de capturas de `scripts/manual-captures/nomina.ts` (nombre, ruta, elemento a recortar y estado previo);
    - toma cada captura en tema claro, con ventana de 1440 px y `deviceScaleFactor: 2`;
    - recorta el área de contenido, o el elemento puntual (tabla o aviso);
    - oculta el indicador de desarrollo de Next con CSS inyectado.
  - Guarda `public/manual/nomina/<nombre>.png` y `public/manual/nomina/manifest.json`, con ancho y alto de cada captura.
  - **Falla** si un marcador `captura:` de `content/manual/nomina/` no tiene definición, o si una definición no tiene marcador.
  - Los PNG y el `manifest.json` se suben al repo.
- **Mostrar las capturas en el manual** (`ManualMarkdown`).
  - Si la captura está en el `manifest.json`:
    - se ve con `next/image` y el ancho y alto del manifiesto;
    - lleva un `<figure>` con la descripción del marcador como `<figcaption>`;
    - va dentro de un `<a>` que abre el PNG completo en otra pestaña (sin JavaScript).
  - Si no está, se mantiene lo de hoy: recuadro "Captura pendiente" en desarrollo y nada fuera de desarrollo.
  - Todo sigue siendo Server Component.
- **Documentación.**
  - `docs/sucursal-demo.md`: qué contiene la demo, el candado, las variables de entorno, cómo sembrar, preparar y capturar, cómo borrar y cómo agregar una captura nueva.
  - En `docs/manual-usuario.md`: la sección de marcadores explica las imágenes reales y el manifiesto.
  - En `.env.template`: `ALLOW_DEMO_SEED`, `DEMO_USER_PASSWORD` y `MANUAL_CAPTURE_BASE_URL`.
  - En `CLAUDE.md`: el puntero a `docs/sucursal-demo.md` en la lista de módulos con documentación.

**No entra (para specs futuras):**

- Capturas de otros módulos (Citas, Pacientes, Inventario…). Llegan con sus manuales, reutilizando la semilla y el script.
- Capturas en tema oscuro.
- El periodo de pago de PTU (exige el reparto del año anterior, cerrado) y cualquier dato del año anterior.
- Escribir parámetros fiscales desde la semilla.
- Correr la semilla o las capturas en producción, o en CI.
- Comparar capturas (regresión visual) o detectar capturas viejas automáticamente.
- Ampliar la imagen dentro de la página (lightbox con JavaScript).
- Pruebas automatizadas de la app con Playwright. Aquí Playwright solo prepara y captura.
- Cambiar el texto del manual. Solo cambia cómo se ve cada marcador.

## Modelo de datos

No cambia el esquema de la base. La semilla inserta filas en tablas que ya existen, todas colgadas de la Empresa Demo. Lo nuevo son archivos, constantes y tipos de TypeScript.

### Archivos nuevos

```
scripts/
  seed-demo-nomina.ts               (entrada de npm run seed:demo)
  capture-manual-screenshots.ts     (entrada de npm run capture:manual)
  demo/
    constants.ts                    (nombres, correo y lista fija de empleados)
    guard.ts                        (candado y requisitos previos)
    removeDemo.ts                   (borrado en orden de llaves foráneas)
    seedOrganization.ts             (empresa, sucursal, usuarios y empleados)
    seedPayrollInputs.ts            (checadas, consultas, tratamientos, ventas y configuraciones)
    seedPeriods.ts                  (periodos semanales, aguinaldo y reparto de PTU en borrador)
  manual-captures/
    types.ts
    nomina.ts                       (las 16 definiciones)
    prepare.ts                      (fase de preparación por la interfaz)
lib/manual/captures.ts              (server-only: lee el manifiesto)
public/manual/nomina/
  <nombre>.png                      (16)
  manifest.json
docs/sucursal-demo.md
```

### Variables de entorno (`.env.local`, documentadas en `.env.template`)

| Variable | Uso | Obligatoria |
|---|---|---|
| `ALLOW_DEMO_SEED` | Debe valer `true` para que `seed:demo` corra. | Sí, para sembrar |
| `DEMO_USER_PASSWORD` | Contraseña del usuario demo. La semilla la guarda con `bcrypt` y el script de capturas la usa para entrar. | Sí, para los dos scripts |
| `MANUAL_CAPTURE_BASE_URL` | URL del `npm run dev` levantado. | No (`http://localhost:3000`) |

### Constantes de la demo (`scripts/demo/constants.ts`)

```ts
export const DEMO_COMPANY_NAME = "Empresa Demo";
export const DEMO_BRANCH_NAME = "Sucursal Demo";
export const DEMO_USER_EMAIL = "demo@centropodologico.test";
export const DEMO_USER_NAME = "Usuario Demo";
export const DEMO_USER_ROLE_ID = 1;

type DemoEmployeeRole =
  | "podologist" | "receptionist" | "branchManager" | "assistant" | "director";

interface IDemoEmployeeFixture {
  key: string;                    // "podologo-1": estable entre corridas
  firstName: string;
  lastNames: string;
  role: DemoEmployeeRole;
  hireDate: "yearStart" | "midYear";   // midYear: 1 de julio del año en curso
  dailySalary: number;            // operativa
  dailyFiscalSalary: number;      // fiscal
  sbc: number;
  ptuCategory: "N" | "C" | "X";
  linkedUserRoleId: 2 | null;     // solo los podólogos
  scenarios: readonly DemoScenario[];
}

type DemoScenario =
  | "overtime"            // checadas con salida tarde, autorizadas en la preparación
  | "absences"            // faltas sin justificar
  | "lateness"            // retardos leves y graves
  | "shiftExtension"      // asignación del bono de extensión de jornada
  | "incompletePunch"     // un día con entrada y sin salida
  | "counterSales";       // ventas de mostrador

export const DEMO_EMPLOYEES: readonly IDemoEmployeeFixture[] = [ /* 7 */ ];
```

- Las fechas se calculan desde `addZeroToday(new Date())` y viajan como texto (`"YYYY-MM-DD"` o `"YYYY-MM-DD HH:mm:ss"`), siguiendo las reglas de fechas de `CLAUDE.md`. Nunca `Date` hacia `queryParams`.
- Los IDs que la app genera con `MAX + 1` se generan igual en la semilla, dentro de la misma transacción.
- Las checadas se generan de forma **determinista**: el mismo día produce la misma hora, con un generador sembrado por `key` y fecha. Así dos corridas el mismo día dan las mismas capturas.
- RFC, CURP y NSS siguen el formato que valida el expediente y usan letras y fechas que no corresponden a nadie real.

### Candado y requisitos previos (`scripts/demo/guard.ts`)

```ts
interface IDemoPrerequisite {
  label: string;     // "Tarifa ISR mensual 2026"
  present: boolean;
}
// assertDemoSeedAllowed(): lanza si ALLOW_DEMO_SEED !== "true" o la confirmación no es "demo".
// checkDemoPrerequisites(year): IDemoPrerequisite[] (UMA, salario mínimo, tarifa semanal,
// tarifa mensual y subsidio del año). Con algún present = false, aborta antes de escribir.
```

### Definición de una captura (`scripts/manual-captures/types.ts`)

```ts
type ManualCapturePreparedState =
  | "latestCalculatedPeriod"     // última semana terminada, calculada y sin avisos
  | "recalculationPending"       // periodo con "Recalcula" pendiente
  | "christmasBonusCalculated"
  | "ptuDistributionClosed"
  | "none";

interface IManualCaptureDefinition {
  name: string;                          // = nombre del marcador, ^[a-z0-9-]+$
  moduleSlug: "nomina";
  path: (context: IManualCaptureContext) => string;   // ruta de la app
  target: "content" | { locator: string };            // área de contenido o elemento puntual
  preparedState: ManualCapturePreparedState;
}

interface IManualCaptureContext {
  periodIdsByState: Record<ManualCapturePreparedState, number | null>;
  ptuDistributionId: number;
  sampleEmployeeId: number;              // para detalle-empleado y preparar-empleado
}
```

### Manifiesto (`public/manual/nomina/manifest.json`)

```json
{
  "generatedAt": "2026-10-21 10:30:00",
  "captures": {
    "periodos-listado": { "width": 2560, "height": 1340 },
    "procesar-nomina-tabla": { "width": 2560, "height": 1820 }
  }
}
```

```ts
// lib/manual/captures.ts (server-only)
export const manualCaptureManifestSchema = z.object({
  generatedAt: z.string(),
  captures: z.record(
    z.string().regex(/^[a-z0-9-]+$/),
    z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  ),
});

export interface IManualCapture {
  src: string;          // "/manual/nomina/periodos-listado.png"
  width: number;        // pixeles reales; next/image escala con sizes
  height: number;
}

// loadManualCapture(moduleSlug, captureName): IManualCapture | null
// Lee el manifiesto una vez por request con cache(). Si no hay manifiesto o falta la entrada → null.
// Un manifiesto inválido lanza con el nombre del archivo, como el encabezado YAML de la spec 92.
```

- `generatedAt` usa `buildDate(new Date())`.
- `ManualMarkdown` recibe las capturas ya resueltas del Server Component de la página. No lee el disco dentro del renderer.

## Plan de implementación

1. **Dependencias y candado, sin escribir nada.**
   - Instalar `tsx` y `@playwright/test` como devDependencies, y correr `npx playwright install chromium`.
   - En `package.json`:
     - `"seed:demo": "tsx --env-file=.env.local scripts/seed-demo-nomina.ts"`;
     - `"capture:manual": "tsx --env-file=.env.local scripts/capture-manual-screenshots.ts"`.
   - En `.env.template`: `ALLOW_DEMO_SEED`, `DEMO_USER_PASSWORD` y `MANUAL_CAPTURE_BASE_URL`, con un comentario cada una.
   - Crear `scripts/demo/constants.ts` (sin `DEMO_EMPLOYEES` todavía) y `scripts/demo/guard.ts`.
   - `seed-demo-nomina.ts` solo corre el candado y los requisitos, y termina.
   - Los scripts importan `database/connection.ts` y helpers puros (`utils/date_helpper.ts`). **Nunca** importan módulos con `server-only`, porque fallan fuera de Next.
   - *Verificación:*
     - sin `ALLOW_DEMO_SEED`, el script se niega;
     - con él, muestra `DB_HOST` y `DB_NAME` y pide `demo`;
     - con otra respuesta, termina sin escribir;
     - la lista de requisitos sale completa contra la base de desarrollo;
     - `npx tsc --noEmit` y `npm run lint` quedan limpios.

2. **Empresa, sucursal, usuarios y empleados.**
   - `scripts/demo/removeDemo.ts`: busca la empresa por `DEMO_COMPANY_NAME`, comprueba que el usuario `DEMO_USER_EMAIL` pertenece a ella (si no, aborta sin borrar) y borra en orden de llaves foráneas. En este paso solo cubre lo que crea `seedOrganization`. Los pasos 3 y 4 agregan sus tablas.
   - `scripts/demo/seedOrganization.ts`: crea empresa, sucursal, usuario demo, los 7 empleados de `DEMO_EMPLOYEES` (datos personales, laborales y fiscales), su horario semanal, su SBC y los 3 usuarios rol 2 vinculados.
   - Todo dentro de **un solo `db.transaction`**, el borrado incluido: si algo falla, la demo anterior queda intacta.
   - `--remove` corre solo el borrado.
   - *Verificación:*
     - se puede entrar como "Usuario Demo" y el selector de sucursal solo ofrece "Sucursal Demo";
     - Empleados lista los 7, y en el expediente de cada uno se ven Datos fiscales, Horario e IMSS;
     - un admin de la empresa real no ve ni la sucursal ni los empleados demo;
     - correr la semilla dos veces deja exactamente 7 empleados;
     - `--remove` deja la base sin la empresa, la sucursal, los usuarios ni los empleados demo.

3. **Entradas de nómina.**
   - `scripts/demo/seedPayrollInputs.ts`:
     - configuraciones por empresa: rangos de comisión, comisión por tratamientos, horas extra, retardos, bonos de puntualidad y asistencia, y la asignación de extensión de jornada;
     - checadas deterministas desde la primera semana del año hasta hoy, con los escenarios de cada empleado;
     - pacientes y consultas atendidas;
     - tratamientos de onicomicosis con pagos que llegan al umbral;
     - productos demo con `bono_venta`;
     - ventas en consultas y en mostrador.
   - Los inserts masivos van en bloques de varios renglones `VALUES`, respetando el límite de 2100 parámetros de SQL Server.
   - `removeDemo.ts` gana estas tablas.
   - *Verificación:*
     - la pestaña Asistencia de un podólogo muestra sus checadas, incluido el día con "Checada incompleta";
     - con un periodo creado a mano en la Sucursal Demo, Horas extra detecta días y Faltas y Retardos listan los del escenario;
     - Productos de la empresa real no muestra los productos demo.

4. **Periodos y reparto de PTU en borrador.**
   - `scripts/demo/seedPeriods.ts`:
     - un periodo semanal por cada semana del año en curso hasta la última terminada, más la semana en curso, todos en "Abierto";
     - el periodo de aguinaldo del año;
     - el reparto de PTU del año, en borrador y con sus parámetros.
   - Usa los mismos códigos (`NOM-{año}-S{NN}`, `NOM-{año}-E01`) y fechas (inicio, fin, corte y pago) que crearía la pantalla Periodos.
   - `removeDemo.ts` gana las tablas de periodos, snapshots y PTU, en orden de llaves foráneas.
   - *Verificación:*
     - Periodos lista todas las semanas y el aguinaldo;
     - calcular a mano la última semana terminada da comisiones, horas extra, bonos, ISR calculado e IMSS distintos de cero, sin "No calculado";
     - `--remove` borra también lo calculado.

5. **Definiciones de captura y validación de marcadores.**
   - `scripts/manual-captures/types.ts` y `nomina.ts`, con las 16 definiciones del modelo de datos.
   - `capture-manual-screenshots.ts`, en esta versión:
     - lee los marcadores de `content/manual/nomina/*.md` con la misma expresión `captura:` de la spec 92;
     - los compara con las definiciones y falla si sobra o falta alguno;
     - abre Chromium y entra por `/login` como el usuario demo.
     - Todavía no prepara ni captura.
   - *Verificación:*
     - con las 16 definiciones, el script entra y termina sin errores;
     - quitar una definición, o agregar un marcador falso en un `.md`, lo hace fallar con el nombre;
     - una contraseña equivocada falla con un mensaje claro.

6. **Fase de preparación.**
   - `scripts/manual-captures/prepare.ts`, todo por la interfaz real:
     - autoriza las horas extra sembradas;
     - calcula cada semana terminada (de la más vieja a la más nueva, porque el ISR acumula por año) y el aguinaldo;
     - precarga y cierra el reparto de PTU;
     - autoriza al final un día extra en la última semana calculada, para dejar "Recalcula" pendiente.
   - Si un periodo ya está calculado, lo salta, para poder repetir el paso tras un fallo a medias.
   - Devuelve el `IManualCaptureContext`.
   - *Verificación:*
     - al terminar, todas las semanas terminadas están en "En cálculo" y el aguinaldo está calculado;
     - el reparto de PTU está "Cerrado", con el gerente topado y el director como no elegible;
     - solo la última semana muestra "Recalcula".

7. **Fase de captura y manifiesto.**
   - Para cada definición:
     - abre la ruta en tema claro, con 1440 px de ancho y `deviceScaleFactor: 2`;
     - inyecta CSS que oculta el indicador de desarrollo de Next;
     - espera a que la red quede en reposo;
     - recorta el área de contenido o el `locator`;
     - guarda `public/manual/nomina/<nombre>.png`.
   - Escribe `manifest.json` con el ancho y el alto reales de cada PNG.
   - *Verificación:*
     - existen los 16 PNG y el manifiesto los lista con su tamaño;
     - ninguna captura muestra datos que no sean de la Empresa Demo;
     - ninguna muestra el indicador de Next ni un recuadro "Captura pendiente";
     - repetir el paso el mismo día da imágenes con el mismo contenido.

8. **Capturas reales en el manual.**
   - `lib/manual/captures.ts`, con `manualCaptureManifestSchema` y `loadManualCapture`.
   - La página `[modulo]/[tema]/page.tsx` resuelve las capturas de su cuerpo y se las pasa a `ManualMarkdown`.
   - En `ManualMarkdown`, el `img` de `captura:` con captura:
     - `<figure>` con `<a href target="_blank">`;
     - `next/image` con el ancho y alto del manifiesto y un `sizes` acorde al ancho del texto;
     - `<figcaption>` con el `alt`.
   - Sin captura, el comportamiento de hoy.
   - `outputFileTracingIncludes` también incluye `public/manual/**/manifest.json` en las rutas de Ayuda.
   - Se usa `frontend-design` para el `<figure>` (borde, sombra y pie de foto, en claro y oscuro).
   - *Verificación:*
     - en `npm run dev` las 16 páginas muestran su imagen con su pie;
     - con un nombre fuera del manifiesto se ve "Captura pendiente";
     - en `npm run build && npm start` las imágenes se ven y los marcadores sin captura no aparecen;
     - ningún archivo de Ayuda lleva `"use client"`.

9. **Documentación.**
   - `docs/sucursal-demo.md`:
     - qué contiene la demo (empleados y escenarios);
     - el candado y las variables de entorno;
     - la secuencia `seed:demo` → `npm run dev` → `capture:manual`;
     - `--remove`;
     - cómo agregar una captura nueva (marcador, definición y estado previo, si hace falta uno nuevo);
     - la limitación de enero y febrero.
   - En `docs/manual-usuario.md`, la sección "Capture placeholders" explica la imagen real, el manifiesto y el pie de foto.
   - En `CLAUDE.md`, el puntero a `docs/sucursal-demo.md` en "Domain modules with detailed docs".

## Criterios de aceptación

**Candado y requisitos**

- [ ] Sin `ALLOW_DEMO_SEED=true`, `npm run seed:demo` termina con un mensaje y sin escribir nada.
- [ ] Con `ALLOW_DEMO_SEED=true`, el script muestra `DB_HOST` y `DB_NAME`, y cualquier respuesta que no sea `demo` lo termina sin escribir.
- [ ] Sin `DEMO_USER_PASSWORD`, ni `seed:demo` ni `capture:manual` corren, y los dos dicen qué variable falta.
- [ ] Si a la base le falta UMA, salario mínimo, tarifa ISR semanal, tarifa ISR mensual o subsidio del año en curso, la semilla aborta antes de escribir y lista exactamente lo que falta.
- [ ] La semilla no inserta ni modifica filas de parámetros fiscales, tarifas ISR, subsidio ni catálogos globales.

**Semilla**

- [ ] Después de `seed:demo` existen "Empresa Demo", "Sucursal Demo", el usuario `demo@centropodologico.test` con rol 1 y los 7 empleados de `DEMO_EMPLOYEES`.
- [ ] El usuario demo entra con `DEMO_USER_PASSWORD` y el selector de sucursal solo ofrece "Sucursal Demo".
- [ ] Un usuario de la empresa real no ve, en ninguna pantalla, la Sucursal Demo, sus empleados, sus productos, sus periodos ni su reparto de PTU.
- [ ] Los 3 podólogos tienen un usuario rol 2 vinculado, y ninguno de esos usuarios puede entrar con `DEMO_USER_PASSWORD`.
- [ ] Correr `seed:demo` dos veces seguidas deja la misma cantidad de filas demo en cada tabla que la primera vez.
- [ ] `seed:demo -- --remove` deja cero filas que cuelguen de la Empresa Demo, en todas las tablas que la semilla escribe o que la preparación calcula.
- [ ] Si la empresa "Empresa Demo" existe pero el usuario `demo@centropodologico.test` no le pertenece, `--remove` y la semilla abortan sin borrar nada.
- [ ] Si la semilla falla a la mitad, la demo anterior queda como estaba (transacción con rollback).
- [ ] Ninguna fecha llega a `queryParams` como `Date`. Todas pasan como texto.

**Preparación**

- [ ] Después de `capture:manual`, todos los periodos semanales terminados de la Sucursal Demo están calculados, y la semana en curso sigue "Abierto".
- [ ] La última semana calculada tiene, en Procesar operativa, al menos un empleado con valor distinto de cero en cada columna: "Com. consultas", "Com. onicomicosis", "Com. Ventas", horas extra, bonos, faltas y retardos.
- [ ] Las filas fiscales de la última semana calculada tienen ISR e IMSS calculados, sin "No calculado".
- [ ] El periodo de aguinaldo del año está calculado, y el auxiliar que ingresó a mitad de año tiene aguinaldo proporcional.
- [ ] El reparto de PTU del año está "Cerrado". El gerente aparece con el tope de confianza y el director como no elegible.
- [ ] Solo la última semana calculada muestra el aviso "Recalcula".
- [ ] Volver a correr `capture:manual` sin volver a sembrar no falla y no recalcula los periodos que ya estaban calculados.

**Capturas**

- [ ] `capture:manual` falla con el nombre si un marcador `captura:` de `content/manual/nomina/` no tiene definición, o si una definición no tiene marcador.
- [ ] Existen los 16 PNG en `public/manual/nomina/`, uno por marcador y con el mismo nombre.
- [ ] `manifest.json` lista las 16 capturas con el ancho y el alto reales de su PNG, y pasa `manualCaptureManifestSchema`.
- [ ] Todas las capturas están en tema claro, a `deviceScaleFactor: 2`, sin sidebar ni encabezado (salvo que la definición recorte un elemento puntual), sin el indicador de desarrollo de Next y sin recuadros "Captura pendiente".
- [ ] Ninguna captura muestra un nombre, RFC, sucursal o empresa que no sea de la demo.

**Manual**

- [ ] En `npm run dev`, cada una de las 16 páginas con marcador muestra su imagen dentro de un `<figure>`, con la descripción del marcador como `<figcaption>`.
- [ ] Un clic en la imagen abre el PNG completo en otra pestaña.
- [ ] Las imágenes usan `next/image` con el ancho y el alto del manifiesto, y no generan saltos de diseño al cargar.
- [ ] Un marcador cuyo nombre no está en el manifiesto se ve como "Captura pendiente" en `npm run dev` y no aparece en `npm run build && npm start`.
- [ ] En `npm run build && npm start`, las 16 imágenes cargan en las páginas del manual.
- [ ] Un `manifest.json` inválido hace fallar la página con el nombre del archivo.
- [ ] El `<figure>` se ve bien en tema claro y oscuro, y a 375 px de ancho no provoca scroll horizontal en la página.
- [ ] Ningún archivo de `app/dashboard/ayuda/` lleva `"use client"`.
- [ ] El texto de las páginas de `content/manual/nomina/` no cambia.

**Calidad y documentación**

- [ ] `npx tsc --noEmit` termina sin errores y `npm run lint` no agrega errores ni warnings nuevos.
- [ ] `npm run build` termina sin errores.
- [ ] Ningún archivo de `scripts/` importa un módulo con `server-only`.
- [ ] `docs/sucursal-demo.md` explica el contenido de la demo, el candado, las variables de entorno, la secuencia de comandos, el borrado, cómo agregar una captura y la limitación de enero y febrero.
- [ ] `docs/manual-usuario.md` describe la imagen real, el manifiesto y el pie de foto.
- [ ] `.env.template` tiene `ALLOW_DEMO_SEED`, `DEMO_USER_PASSWORD` y `MANUAL_CAPTURE_BASE_URL`, y `CLAUDE.md` apunta a `docs/sucursal-demo.md`.

## Decisiones

**Dónde vive la demo**

| Decisión | Por qué |
|---|---|
| **Sí:** una Empresa Demo propia, con su sucursal y su usuario | Comisiones, tratamientos, productos y PTU se separan por empresa. Una sucursal dentro de la empresa real mezclaría los datos ficticios con los reales. |
| **No:** una Sucursal Demo dentro de la empresa real | Por lo anterior. Además, el reparto de PTU real sumaría a los empleados ficticios. |
| **Sí:** un usuario demo con rol 1 que solo ve la Sucursal Demo | Las capturas muestran su nombre y no el de una persona real, y la sesión lleva el `id_empresa` correcto sin tocar el usuario de nadie. |
| **Sí:** solo en la base de desarrollo, con candado (`ALLOW_DEMO_SEED`, muestra de `DB_HOST`/`DB_NAME` y confirmación `demo`) | `.env.local` puede apuntar a producción por error, y la semilla borra y crea miles de filas. |
| **No:** una lista fija de nombres de base permitidos | El nombre de la base puede cambiar entre equipos, y la confirmación con la base a la vista cubre el mismo riesgo. |
| **Sí:** identificar la demo por nombre de empresa **y** por correo del usuario demo | Un solo criterio podría coincidir con una empresa real renombrada. Con los dos, el borrado no toca nada ajeno. |

**Cómo se siembra**

| Decisión | Por qué |
|---|---|
| **Sí:** script TypeScript con `tsx` y `db.queryParams` | Genera un año de checadas, consultas y ventas con fechas relativas a hoy, cosa muy incómoda en T-SQL, y reutiliza la conexión y los helpers de fecha. |
| **No:** script SQL dentro de la spec, como en las specs anteriores | Sirve para cambios de esquema, no para generar miles de filas con escenarios. |
| **Sí:** borrar y recrear la demo en cada corrida, en una sola transacción | Las fechas siempre caen alrededor de hoy, y si algo falla, la demo anterior sigue entera. |
| **No:** crear solo lo que falte | Con el tiempo los periodos quedarían viejos y "hoy" caería fuera de la demo. |
| **Sí:** la semilla escribe solo entradas, y los cálculos los hace la app | Las capturas muestran números que el motor real produce. No hay una segunda copia del cálculo que pueda divergir. |
| **No:** sembrar también los snapshots con SQL | Duplicaría `calculatePayrollPeriod` y el reparto de PTU, y los números podrían no ser los que la app daría. |
| **Sí:** checadas deterministas (generador sembrado por empleado y fecha) | Dos corridas el mismo día dan las mismas capturas, y un cambio en una imagen se explica por un cambio en la app. |
| **Sí:** 7 empleados semanales que cubren todos los escenarios (comisiones, horas extra, faltas, retardos, extensión de jornada, ingreso a mitad de año, confianza y excluido) | Cada columna y aviso de las 16 capturas tiene algo que mostrar. El ISR solo se calcula en semanal. |
| **Sí:** todas las semanas del año en curso | La precarga de PTU suma los periodos ordinarios del año. Con pocas semanas el reparto saldría irreal, o con filas marcadas como "editado". |
| **No:** datos del año anterior ni periodo de pago de PTU | El pago exige el reparto del año anterior, cerrado, y eso duplicaría la semilla para una sola pantalla que no tiene captura. |
| **Sí:** no escribir parámetros fiscales y abortar si faltan | Son globales: un ejercicio de prueba lo verían todos los usuarios de la base de desarrollo. |

**Cómo se capturan**

| Decisión | Por qué |
|---|---|
| **Sí:** Playwright, con preparación y captura por la interfaz real | Es repetible cuando el módulo crezca, y la preparación pasa por la misma sesión y las mismas validaciones que usa una persona. |
| **No:** capturas a mano ni con Claude in Chrome | No son repetibles y dependen de que alguien siga la lista sin errores. |
| **Sí:** correr contra un `npm run dev` ya levantado | El script no administra procesos, y el dev server es el que ya se usa al escribir el manual. |
| **Sí:** ocultar el indicador de desarrollo de Next con CSS inyectado | No se toca la configuración de la app solo para las capturas. |
| **Sí:** la lista de capturas en código (`scripts/manual-captures/nomina.ts`), validada contra los marcadores | Un marcador nuevo sin definición, o una definición huérfana, se detecta al correr el script y no en producción. |
| **Sí:** recorte del área de contenido o de un elemento, solo tema claro, 1440 px y `deviceScaleFactor: 2` | La imagen enfoca lo que explica el texto, se ve nítida en pantallas de alta densidad y no duplica el trabajo con una versión oscura. |
| **No:** capturas en tema oscuro | Duplican archivos y tiempo de captura por un beneficio menor. Pueden llegar en otra spec. |
| **Sí:** subir PNG y manifiesto al repo | El manual funciona en cualquier despliegue sin correr Playwright, y cada cambio de imagen queda en el historial. |

**Cómo se muestran**

| Decisión | Por qué |
|---|---|
| **Sí:** `next/image` con el ancho y el alto de un `manifest.json` generado | `next/image` exige dimensiones para no generar saltos de diseño, y leerlas del PNG en cada request sería trabajo inútil. |
| **Sí:** `<figure>` con `<figcaption>` y un `<a>` al PNG completo | Las tablas anchas se leen en grande sin agregar JavaScript, y el pie de foto reusa la descripción que ya escribió la spec 92. |
| **No:** lightbox con JavaScript | Rompería la regla de la spec 92 (Ayuda sin `"use client"`). |
| **Sí:** sin captura, el comportamiento de hoy | Agregar un marcador antes de tener su imagen sigue funcionando. |
| **Sí:** la página resuelve las capturas y se las pasa a `ManualMarkdown` | El renderer no lee el disco, y el acceso a archivos queda en `lib/manual/` (`server-only`), como el contenido. |
| **Sí:** no cambiar el `updated` de las páginas | El texto no cambia, y `updated` dice cuándo se revisó el contenido contra la app, no cuándo se tomó una imagen. |

**Alcance**

| Decisión | Por qué |
|---|---|
| **Sí:** semilla y script pensados para crecer a otros módulos (`moduleSlug`, carpeta `scripts/manual-captures/`) | El siguiente manual reutiliza la demo y solo agrega sus definiciones y, si hace falta, sus entradas. |
| **No:** usar Playwright para probar la app | Es otra decisión, con su propia infraestructura. Aquí solo prepara y captura. |
| **Sí:** aceptar que en enero y febrero el PTU sale con pocas semanas | Resolverlo con datos del año anterior duplica la semilla. Queda documentado en `docs/sucursal-demo.md`. |

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| **La semilla corre contra producción** porque `.env.local` apunta ahí. | Candado triple: `ALLOW_DEMO_SEED=true`, `DB_HOST`/`DB_NAME` a la vista y confirmación `demo`. `ALLOW_DEMO_SEED` no va en el `.env` de producción, y `docs/sucursal-demo.md` lo dice. |
| **El borrado toca datos reales**, por ejemplo si alguien llama "Empresa Demo" a una empresa real. | Se borra solo si coinciden el nombre **y** el usuario `demo@centropodologico.test`, y todo filtra por el `id_empresa` resuelto así. |
| **Se olvida una tabla en `removeDemo.ts`** (una spec nueva agrega una tabla que cuelga del periodo o del empleado), y el borrado falla por llave foránea o deja huérfanos. | El borrado va en una transacción: si falla, no deja nada a medias y el error nombra la llave. El criterio "cero filas demo tras `--remove`" se revisa en cada spec que agregue tablas de nómina, y `docs/sucursal-demo.md` lo pide. |
| **La semilla se desfasa del esquema** cuando una spec futura agrega una columna `NOT NULL` o un `CHECK` nuevo. | El insert falla en la transacción, con el mensaje de SQL Server, y la demo anterior queda intacta. `docs/sucursal-demo.md` pide correr `seed:demo` en las specs que toquen tablas de RH, consultas, ventas o nómina. |
| **Los selectores de Playwright se rompen** cuando cambia el texto de un botón o una tabla. | Los `locator` usan roles y textos visibles, los mismos que el manual exige nombrar exactos. Un cambio de texto ya obliga a tocar el manual, y el script falla diciendo qué captura no encontró. |
| **La preparación tarda mucho** (unas 42 semanas calculadas una por una). | Corre sola y salta los periodos ya calculados, así que una falla a media corrida se reanuda sin empezar de nuevo. Se acepta como costo de tener un PTU realista. |
| **Faltan parámetros fiscales del año** en la base de desarrollo y el ISR sale "No calculado" en las capturas. | La semilla revisa UMA, salario mínimo, tarifas y subsidio antes de escribir, y aborta diciendo qué falta. |
| **Una captura filtra datos reales**, por ejemplo un menú o un selector que lista otra sucursal. | El usuario demo solo tiene la Sucursal Demo y su sesión lleva el `id_empresa` demo. El criterio de aceptación pide revisar las 16 imágenes. |
| **Las capturas quedan viejas** cuando cambia una pantalla y nadie vuelve a correr el script. | `manifest.json` guarda `generatedAt`. La regla de mantenimiento de la spec 92 se amplía en `docs/manual-usuario.md`: si cambia una pantalla con captura, se vuelve a correr `capture:manual`. |
| **Los PNG inflan el repo.** | Solo se recorta el área útil. Son 16 archivos y se sobrescriben con el mismo nombre. Si crecen demasiado, una spec futura puede convertirlos a WebP. |
| **El login del script choca con el limitador de intentos** (`lib/rateLimiter.ts`) por contraseñas equivocadas repetidas. | El script entra una sola vez por corrida y se detiene en el primer fallo, con un mensaje claro, sin reintentar. |
| **`manifest.json` no llega al servidor** en un despliegue serverless. | `outputFileTracingIncludes` lo incluye en las rutas de Ayuda, y el criterio de `npm run build && npm start` lo comprueba. |

## Lo que **no** entra en esta spec

- Capturas de otros módulos.
- Capturas en tema oscuro.
- El periodo de pago de PTU y cualquier dato del año anterior.
- Escribir parámetros fiscales desde la semilla.
- Correr la semilla o las capturas en producción o en CI.
- Regresión visual o detección automática de capturas viejas.
- Lightbox con JavaScript.
- Pruebas automatizadas de la app con Playwright.
- Cambios al texto del manual.

Cada uno, si llega, va en su propia spec.

# Auditoría de seguridad y optimización — módulo de Tratamientos

- **Fecha:** 2026-11-27.
- **Commit de referencia:** `36a14bb`; se revisó el árbol de trabajo, incluidos cambios locales previos en la página de detalle y sus cinco componentes Accordion. Los números de línea corresponden a ese estado local.
- **Alcance:** `app/dashboard/tratamientos/**`, con revisión de las dependencias relevantes: `proxy.ts`, emisión de sesión en `app/actions/auth.ts`, `/api/upload`, conexión SQL, consumo automático de inventario y lectura de pagos para facturación.
- **Método:** revisión estática. No se invocaron acciones contra la aplicación, no se consultó la base de datos ni se subieron archivos. Los escenarios descritos son inferencias del código, no ataques reproducidos. No se modificó código funcional.
- **Referencia de formato:** `audits/2026-11-16-auditoria-nomina.md`.

## Resumen

### Seguimiento — SPEC 108

La SPEC 108 atiende A1 en las 27 acciones exportadas de Tratamientos: cada llamada verifica el JWT y consulta `dbo.users` para exigir un usuario activo y no eliminado antes del SQL de negocio o del consumo de inventario. Listado y búsqueda usan la empresa vigente de ese registro. Los hallazgos siguientes se conservan como evidencia del estado auditado originalmente.

La parte de A3 relativa a la vigencia del usuario y la empresa actual queda cubierta en estas acciones. Siguen pendientes la autorización por recurso, sucursal, especialista y operación de A2, la evaluación de cambios de rol y los controles de sesión en `proxy.ts` y otros módulos. Los datos de recursos procedentes de formularios no se validan por esta spec.

**Verificación:** `tests/treatment-access.test.ts` ejercita directamente las 27 acciones con dependencias simuladas: cookie ausente, JWT inválido o vencido, identidades inválidas, usuario inexistente, inactivo o eliminado y fallo de consulta. Comprueba ausencia de SQL de negocio y consumo tras el rechazo, además de sesiones válidas, contratos y consulta de vigencia por llamada. Pasaron las pruebas, `tsc --noEmit` y ESLint de los archivos modificados. Estas pruebas no sustituyen la verificación HTTP ni una prueba con base de datos real.

| Severidad | Cantidad | IDs |
|---|---|---|
| Alta | 3 | A1, A2, B1 |
| Media | 10 | A3, B2, B3, B4, B5, C1, C2, D1, D2, E1 |
| Baja | 1 | D3 |

La severidad expresa impacto potencial, no explotación demostrada. A1 y A2 describen capas distintas del mismo problema de autorización; sus impactos no deben sumarse. D1–D3 incluyen rendimiento y fiabilidad.

**Orden sugerido de atención**

1. A1–A3: sesión vigente y autorización por recurso en todas las acciones.
2. B1–B3: proteger pagos facturados, validar importes y transiciones clínicas en el servidor.
3. B4–B5: claves seguras ante concurrencia, operaciones atómicas y reintentos controlados.
4. C1–C2 y E1: procedencia y privacidad de archivos, y transporte SQL.
5. D1–D3: búsqueda acotada, carga de pestañas y manejo de fallos.

---

## Grupo A — Control de acceso y sesión

### A1 · ALTA · Lecturas y escrituras exportadas sin autenticar

- **Dónde:** `app/dashboard/tratamientos/actions.ts:133`, `:158`, `:239`, `:251`, `:263`, `:287`, `:395`, `:412`, `:449`, `:467`, `:541`, `:643`, `:704`, `:726`, `:762`, `:786`.
- **Qué pasa:** las acciones de detalle, antecedentes, fotos, pagos, recetas, egresos y consultas ejecutan SQL sin llamar a un verificador de sesión. Entre las escrituras están cambiar etapa, editar/borrar pagos, editar egresos, registrar archivos y crear consultas.
- **Impacto:** quien pueda invocar esas acciones y aportar un ID válido puede leer información clínica y financiera o modificarla sin un control propio de autenticación. La creación de consultas además dispara consumo de inventario con empresa, sucursal y usuario tomados del formulario (`:838-843`).
- **Límite de la evidencia:** `proxy.ts` exige JWT en `/dashboard`, pero eso no sustituye autenticar cada acción exportada. No se comprobó en ejecución el despacho de una acción desde una ruta pública ni se demuestra aquí acceso anónimo por HTTP; sí se demuestra que las acciones carecen de esa defensa y que cualquier sesión admitida en la ruta llega a ellas sin autorización adicional.
- **Corrección:** helper de acceso obligatorio antes de consultar o escribir, comprobando usuario vigente. Aplicarlo también a catálogos exportados. No depender de botones ocultos ni de la protección de la URL.
- **Verificación propuesta:** invocación directa sin cookie, token inválido y usuario inactivo debe fallar antes de ejecutar SQL de negocio, independientemente de la ruta de despacho.

### A2 · ALTA · Sin aislamiento de recursos; el especialista y la sucursal son parámetros del cliente

- **Dónde:** `actions.ts:23-30`, `:76-84`, `:158-222`, `:340-379`, `:596-635`, `:683-695`, `:786-843`; listado en `app/dashboard/tratamientos/page.tsx:23-27`.
- **Qué pasa:** listado y búsqueda filtran por la empresa del JWT, pero aceptan sucursal y especialista del cliente. El rol 5 puede omitir `id_especialista` o enviar otro; su restricción a tratamientos propios está en React. El detalle y las operaciones por ID no enlazan el recurso con empresa, sucursal autorizada o especialista. Incluso las altas que sí leen sesión (`createPagoTratamiento`, `createEgreso`) usan solo `id_user`, sin verificar el tratamiento destinatario.
- **Impacto:** una sesión válida puede consultar tratamientos ajenos, incluidos de otra empresa por ID, y registrar/modificar información sobre ellos. Un médico externo puede saltarse las restricciones financieras que oculta la interfaz. La creación de consultas acepta también paciente, podólogo y empresa arbitrarios sin verificar su relación.
- **Corrección:** resolver el contexto en servidor y enlazar tratamiento → consulta inicial → empresa/sucursal. Para pagos, egresos y archivos resolver primero su recurso padre. Derivar el especialista del usuario cuando sea rol 5 y definir permisos por operación; validar todas las relaciones del formulario. Confirmar la política de sucursales permitidas para cada rol.
- **Verificación propuesta:** matriz de dos empresas, sucursales autorizadas/no autorizadas y dos especialistas; rechazar IDs cruzados y comprobar que omitir filtros no amplíe el acceso.

### A3 · MEDIA · JWT de siete días sin comprobar vigencia del usuario

- **Dónde:** `actions.ts:15-21`; `app/actions/auth.ts:130` y `:259`.
- **Qué pasa:** el helper verifica firma y caducidad, devuelve el payload sin consultar `users` y no comprueba `status`. Las acciones que sí lo usan conservan el contexto del token tras desactivar, eliminar o cambiar de rol al usuario.
- **Impacto:** una sesión emitida previamente puede seguir operando hasta su expiración. El filtro de `proxy.ts` también usa el estatus del token, no el actual.
- **Corrección:** consultar por PK usuario activo/no eliminado y obtener rol y empresa actuales; rechazar ante fallo de consulta. Acortar JWT no sustituye la revocación efectiva. Usar como referencia el control actualizado de Nómina, no asumir que cualquier helper compartido ya relee la base.
- **Verificación propuesta:** emitir sesión, revocar usuario o cambiar rol/empresa y comprobar rechazo o aplicación inmediata del nuevo alcance.

---

## Grupo B — Integridad clínica, financiera y concurrencia

### B1 · ALTA · Los pagos facturados se pueden modificar o eliminar

- **Dónde:** `actions.ts:395-436`; `lib/billing/billableOperations.ts:313-325`, `:373-378`; `AccordionPagos.tsx:113-145`.
- **Qué pasa:** editar y borrar solo filtran por ID del pago. No comprueban `facturado`, `uuid_cfdi` ni que siga activo. La lectura del componente tampoco devuelve esos indicadores para bloquear controles. Facturación sí utiliza el importe y marca esos mismos pagos.
- **Impacto:** se puede cambiar importe/método o desactivar el respaldo local de un CFDI ya emitido, sin cancelar ni ajustar el comprobante. Esto permanece aun después de corregir el acceso de A1/A2.
- **Corrección:** rechazar mutaciones sobre pagos vinculados a comprobantes vigentes y coordinar este bloqueo con el flujo de timbrado. Verificar dentro de una transacción; definir ajustes/cancelaciones explícitos, no edición retroactiva.
- **Verificación propuesta:** pago facturado inmutable; carrera entre editar/borrar y timbrar sin divergencia entre CFDI y registro local.

### B2 · MEDIA · Importes y catálogos sin validación de negocio en servidor

- **Dónde:** `actions.ts:340-379`, `:412-436`, `:596-635`, `:643-675`, `:786-823`.
- **Qué pasa:** los tipos TypeScript y las conversiones `Number`/`String` no validan la entrada en ejecución. No se exigen importes positivos/finitos, precisión o topes, referencias acotadas, métodos de pago activos ni tipos/etapas permitidos. Crear un egreso acepta cualquier tipo y editar permite cambiarlo. Las reglas de la base no se inspeccionaron.
- **Impacto:** solicitudes directas pueden intentar introducir importes negativos o inconsistentes y combinaciones que la UI no ofrece; su aceptación final depende de constraints de la base. No es evidencia de inyección SQL.
- **Corrección:** schemas de ejecución y comprobaciones referenciales; importes monetarios con precisión explícita y política de abonos/sobrepago. Derivar autor y fecha del servidor: `saveEgresoArchivo` hoy recibe ambos del cliente (`:726-748`).
- **Verificación propuesta:** rechazar negativos, no finitos, exceso de decimales, límites desbordados y catálogos inactivos, sin escrituras parciales.

### B3 · MEDIA · Etapas clínicas arbitrarias y avance aunque falle la receta

- **Dónde:** `actions.ts:251-260`, `:383-392`, `:786-843`; detalle `page.tsx:274-313`, `:377`, `:400`; `AccordionRecetas.tsx:145-149`.
- **Qué pasa:** `updateTratamientoStage` admite cualquier etapa sin transición, rol, estado previo ni requisitos. Las seis consultas para finalizar y la existencia de pago para crear consulta se comprueban solo en la UI; `hasPagoTipo2` solo acredita una fila activa, no que se cubra el total. Además, al cargar receta el `finally` avanza a etapa 3 para rol 5 en etapas 1/2 incluso si hubo error de formato, subida o guardado.
- **Impacto:** finalizar anticipadamente, reabrir por actualización directa, agregar consultas a tratamientos cerrados o avanzar sin receta. Dos clientes pueden sobrescribir etapas con información desactualizada.
- **Corrección:** comandos específicos con transiciones permitidas y requisitos bajo transacción; actualización condicionada al estado esperado. Avanzar por receta únicamente tras guardado exitoso. Confirmar si el requisito económico es primer abono o pago completo.
- **Verificación propuesta:** fallo de subida conserva etapa; transición inválida, tratamiento cerrado y finalización sin consultas elegibles deben rechazarse en servidor.

### B4 · MEDIA · Generación de IDs con MAX + 1 sin serialización

- **Dónde:** `actions.ts:352-354`, `:482`, `:612-613`, `:735-736`, `:806`, `:832`.
- **Qué pasa:** pagos, recetas, egresos, adjuntos, consultas y procesos calculan el próximo ID leyendo el máximo sin secuencia, identity ni bloqueo que reserve el valor.
- **Impacto:** dos solicitudes concurrentes pueden elegir el mismo ID. Con PK única una falla; sin esa garantía puede haber duplicados. No se verificaron constraints reales y no se afirma corrupción demostrada. Las tablas compartidas reciben también escrituras de otros módulos.
- **Corrección:** migrar coordinadamente todos los escritores de cada tabla a `IDENTITY`/`SEQUENCE`; si se conserva asignación manual, usar un asignador transaccional único y compatible con los demás escritores.
- **Verificación propuesta:** altas concurrentes con IDs distintos, incluyendo un escritor externo al módulo.

### B5 · MEDIA · Operaciones compuestas no atómicas y sin idempotencia

- **Dónde:** `actions.ts:474-499`, `:798-845`; `lib/inventory/consultationConsumption.ts:17-21`, `:46-78`; `EgresoArchivos.tsx:109-138`.
- **Qué pasa:** consulta y proceso se insertan por separado; si falla el segundo queda la consulta aunque se devuelva error. El consumo se ejecuta después, en otra transacción, y captura sus fallos sin propagarlos. Guardar receta y avisar se hace en dos consultas independientes. Adjuntar comprobante y avanzar egreso también son llamadas separadas; el avance reenvía monto y otros campos leídos anteriormente.
- **Impacto:** reintentar puede duplicar consultas o recetas, quedar consultas sin proceso/consumo, o adjuntos sin etapa actualizada. Un avance de egreso puede sobrescribir una edición financiera concurrente con valores antiguos.
- **Corrección:** transacción para escrituras locales relacionadas, clave de idempotencia por operación y comando exclusivo para cambiar etapa del egreso. Si el consumo debe seguir siendo best effort, registrar un pendiente durable, observable y reintentable sin duplicarlo. Para Cloudinary usar compensación/limpieza, no mantener una transacción SQL durante la subida.
- **Verificación propuesta:** fallos entre pasos, respuesta perdida y reintentos; una sola operación lógica, estado consistente y consumo recuperable.

---

## Grupo C — Archivos y privacidad

### C1 · MEDIA · Las acciones aceptan enlaces y metadatos sin acreditar una subida

- **Dónde:** `actions.ts:467-489`, `:726-748`; `AccordionRecetas.tsx:259`; `EgresoArchivos.tsx:252`.
- **Qué pasa:** guardar receta acepta `ruta`, `tipo` y fecha arbitrarios; adjuntar a egreso acepta URL, autor y fecha del cliente. No verifican un identificador de subida asociado al usuario/recurso. El enlace se guarda y se presenta para abrir o copiar.
- **Impacto:** pueden registrarse evidencias falsas o enlaces a sitios externos y suplantarse autor/fecha del adjunto. El endpoint de subida endurecido no lo evita, porque estas acciones pueden llamarse sin pasar por él. No se demuestra XSS: no se presupone que React permita esquemas peligrosos.
- **Corrección:** registrar en servidor el ID del activo subido, propietario y destino; consumirlo al adjuntar. Como defensa adicional validar HTTPS, cuenta/carpeta exacta y tipo permitido. Obtener fecha/autor del servidor.
- **Verificación propuesta:** URL de otra cuenta, host externo, activo de otro usuario y metadatos falsificados rechazados.

### C2 · MEDIA · Recetas en almacenamiento sin acceso autenticado configurado

- **Dónde:** `app/api/upload/route.ts:152-163`; `AccordionRecetas.tsx:121-140`, `:54-66`.
- **Qué pasa:** se sube con `resource_type: "auto"` y se devuelve `secure_url`, sin configurar entrega autenticada ni expiración. La receta comparte esa URL en el texto para copiar. Proteger la subida no protege la descarga.
- **Impacto:** bajo la entrega pública habitual del proveedor, quien obtenga la URL conserva acceso al documento clínico fuera de la sesión. UUID aleatorio dificulta adivinarlo, pero no revoca un enlace compartido. No se verificaron restricciones de entrega de la cuenta, en particular para PDF.
- **Corrección:** almacenamiento privado y descarga autorizada por recurso, con enlaces de corta duración y política explícita de compartición/retención. Revisar también fotos clínicas y comprobantes, cuyas URLs se exponen desde el módulo.
- **Verificación propuesta:** descarga sin sesión y enlace expirado rechazados; acceso autorizado funcional para los formatos admitidos.

---

## Grupo D — Optimización y fiabilidad de la interfaz

### D1 · MEDIA · Búsqueda sin límite y consultas correlacionadas

- **Dónde:** `actions.ts:31-69`, `:85-129`; `app/dashboard/tratamientos/page.tsx:49-58`.
- **Qué pasa:** listado inicial tiene `TOP 15`, búsqueda no tiene paginación ni límite ni longitud mínima/máxima en servidor. Acepta cadena vacía o `%`; `LIKE '%' + @q + '%'` busca sobre expresiones de nombre y otros campos. Cada fila calcula un conteo correlacionado; el listado también busca el último egreso.
- **Impacto:** búsquedas amplias aumentan trabajo SQL, transferencia y renderizado; los 15 iniciales tampoco permiten recorrer el resto sin buscar. No se midieron tiempos ni se inspeccionaron índices/planes: la magnitud del costo queda pendiente.
- **Corrección:** tamaño máximo y cursor estable `(created_at, id_tratamiento)`, normalizar y acotar término en servidor, definir tratamiento de comodines. Medir plan real antes de cambiar índices o agregaciones. Evaluar índices de consultas por tratamiento, egresos por referencia/fecha y pagos por tratamiento/tipo/estatus, según cardinalidad y planes existentes.
- **Verificación propuesta:** límites efectivos con términos vacíos/comodines y medición de lecturas lógicas, duración y tamaño de respuesta con datos representativos.

### D2 · MEDIA · Pestañas ocultas montadas y lectura duplicada de consultas

- **Dónde:** detalle `page.tsx:127-143`, `:334-362`; `AccordionConsultas.tsx:35`; `AccordionPagos.tsx:67-79`; `AccordionEgresos.tsx:50`; `AccordionRecetas.tsx:85`.
- **Qué pasa:** `hidden` conserva montados los componentes y ejecuta sus efectos aunque no se abra la pestaña. El padre descarga todas las consultas para contar y la pestaña las solicita otra vez. Catálogos se vuelven a pedir en cada montaje.
- **Impacto:** carga inicial con peticiones innecesarias y transferencia duplicada de datos clínicos. `Promise.all` en el cliente no garantiza que el transporte de server actions las ejecute simultáneamente.
- **Corrección:** cargar pestañas al primer acceso conservando su estado; usar una consulta resumen autorizada para contador/existencia de pago o compartir los datos entre padre e hijo. Cachear solo catálogos apropiados, respetando alcance y mecanismos de invalidación.
- **Verificación propuesta:** abrir detalle sin navegar pestañas no carga sus datos; Consultas se lee una sola vez y las mutaciones invalidan el resumen.

### D3 · BAJA · Errores y respuestas tardías pueden dejar estados engañosos

- **Dónde:** `app/dashboard/tratamientos/page.tsx:49-64`; `AccordionPagos.tsx:67-79`; `AccordionRecetas.tsx:85-90`; detalle `page.tsx:127-146`.
- **Qué pasa:** varios efectos no tienen `catch/finally`, de modo que un rechazo deja el indicador de carga activo. La búsqueda no identifica la solicitud vigente: si cambia sucursal o se lanzan dos búsquedas, una respuesta anterior puede reemplazar los resultados nuevos. La carga del detalle tampoco descarta respuestas del ID anterior.
- **Impacto:** bloqueos visuales o presentación de resultados que ya no corresponden al contexto seleccionado; no constituye por sí mismo una fuga entre empresas.
- **Corrección:** manejar rechazo, restablecer carga en `finally` y descartar respuestas obsoletas con identificador de solicitud o limpieza del efecto. Ofrecer reintento y reiniciar estado al cambiar recurso.
- **Verificación propuesta:** respuestas invertidas, cambio rápido de sucursal/ID y rechazo de cada carga no dejan resultados antiguos ni carga permanente.

---

## Grupo E — Infraestructura compartida

### E1 · MEDIA · Conexión SQL sin exigir cifrado ni validar certificado

- **Dónde:** `database/connection.ts:24-30`.
- **Qué pasa:** configura `encrypt: false`, `trustServerCertificate: true` y mínimo TLSv1. Afecta a antecedentes, diagnósticos, recetas y pagos. Ya estaba identificado en Nómina; es el mismo riesgo compartido, no otra falla independiente.
- **Impacto:** la aplicación no exige confidencialidad/autenticidad del transporte. La exposición efectiva depende de si SQL Server fuerza cifrado y de la topología, aspectos no verificados. No se afirma que todo tráfico real viaje en claro.
- **Corrección:** exigir cifrado, mínimo TLS 1.2 y certificado válido, comprobando compatibilidad del entorno antes del despliegue.
- **Verificación propuesta:** negociación cifrada y rechazo de certificados no válidos en un entorno representativo.

## Lo que está bien

- Los valores de entrada revisados se enlazan mediante `queryParams`; el filtro interpolado del especialista es texto fijo del servidor. No se encontró concatenación de entrada del usuario como SQL ejecutable.
- Listado y búsqueda sí filtran por empresa del token; es una defensa parcial útil que debe extenderse al detalle y escrituras.
- `/api/upload` ya comprueba JWT y usuario activo/no eliminado, limita a 5 MiB, restringe carpetas, inspecciona firmas de archivo, genera UUID y desactiva sobrescritura. No se repite el hallazgo antiguo de subida anónima de Nómina.
- El listado inicial limita a 15 registros y las fotos de consultas se solicitan al abrirlas.
- El borrado de egresos conserva fecha y usuario; falta autorización por recurso y una bitácora equivalente para otras mutaciones.

## Lo que no cubrió esta auditoría

- No hubo pruebas HTTP, navegación, concurrencia real, consultas SQL, inspección de PK/FK/checks/triggers/índices, planes de ejecución ni benchmarks. Las verificaciones propuestas no se han ejecutado.
- No se revisó en profundidad todo el módulo de facturación, el algoritmo de stock, Nómina ni los otros escritores de las tablas compartidas. Se siguieron solo las dependencias necesarias para sustentar estos hallazgos.
- No se auditó configuración efectiva de Cloudinary, permisos de infraestructura, secretos, dependencias ni TLS negociado en producción.
- No se evaluó la corrección médica de los tratamientos ni se presume una política definitiva de roles, cobro o transición: hay que confirmar esas reglas al implementar los controles.
- Se conservaron los cambios locales existentes. La revisión del documento fue de coherencia con el código y referencias; no corresponde ejecutar pruebas de aplicación para un cambio exclusivamente documental.

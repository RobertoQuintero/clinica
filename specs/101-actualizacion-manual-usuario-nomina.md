# 101 — Actualización del manual de usuario de Nómina

## Header

- **Estado:** Implementado
- **Depende de:** 92 y 95 (manual de Nómina), 93 (Empresa Demo y capturas), y 96 a 100 (funciones de Nómina pendientes de documentar).
- **Modifica base de datos:** No requiere cambios de esquema; la preparación de capturas puede usar datos de la Empresa Demo.
- **Fecha:** 2026-11-24
- **Objetivo:** Actualizar el manual de usuario de Nómina para que refleje el funcionamiento actual del módulo y sus flujos recientes.

## Alcance

### Entra

- Revisar todas las páginas de `content/manual/nomina/` contra el funcionamiento actual y corregir instrucciones, estados y avisos obsoletos.
- Documentar la reapertura de periodos pagados y sus condiciones, incluida la corrección de las afirmaciones que presentan el estado Pagada como definitivo.
- Agregar una página para la pantalla Días pendientes de pago y explicar su captura, sus restricciones y su efecto en el cálculo y el detalle del empleado.
- Documentar el timbrado y la cancelación de CFDI ordinarios en las páginas de Procesar nómina y Detalle del empleado, incluidos sus requisitos, estados, descargas y mensajes relevantes.
- Extender el tutorial de nómina ordinaria hasta el timbrado y actualizar los enlaces y preguntas frecuentes relacionados.
- Explicar el salario diario integrado en el detalle fiscal, su preparación para el timbrado y su diferencia con el salario base de cotización.
- Actualizar las fechas `updated` de las páginas modificadas y conservar el estilo, las plantillas y el lenguaje del manual integrado en Ayuda.
- Generar capturas reales nuevas cuando sean necesarias, mediante la Empresa Demo y datos de prueba. Si alguna captura depende de un servicio externo o de datos de prueba no disponibles, dejar constancia de la limitación.
- Ajustar los scripts de preparación y captura, y agregar anclas de captura mínimas a la aplicación cuando sea necesario, sin alterar el comportamiento funcional de Nómina.
- Actualizar la documentación de la infraestructura de capturas cuando los cambios lo requieran.

### No entra

- Cambiar cálculos, validaciones, permisos o flujos funcionales de Nómina.
- Emitir o cancelar comprobantes reales para producir capturas.
- Modificar el esquema de la base de datos.
- Documentar funciones que todavía no existen ni actualizar manuales de otros módulos.
- Crear una versión impresa, traducida o en otro formato del manual.

## Modelo de datos

Esta actualización no introduce estructuras de datos ni cambios en el esquema de la base de datos.

El manual seguirá usando archivos Markdown en `content/manual/nomina/`, con el encabezado existente y la fecha `updated` entre comillas. La nueva página de Días pendientes de pago seguirá la misma estructura que las demás páginas de pantalla.

Las capturas seguirán usando los marcadores del manual y el manifiesto existente en `public/manual/nomina/manifest.json`. Los nombres y estados de demostración necesarios se definirán en el plan de implementación.

## Plan de implementación

1. Revisar cada página de `content/manual/nomina/` frente a las pantallas, acciones y documentación técnica actuales. Identificar instrucciones obsoletas, funciones faltantes y capturas que necesitan actualizarse.
2. Corregir las páginas existentes y agregar la página de Días pendientes de pago. Documentar reapertura, CFDI y salario diario integrado en las páginas correspondientes; actualizar el tutorial ordinario, las preguntas frecuentes, los enlaces y las fechas `updated` de las páginas modificadas.
3. Verificar que los textos de botones, campos, estados y avisos citados coincidan con la aplicación. Comprobar que las páginas y sus enlaces se rendericen correctamente en Ayuda.
4. Preparar los escenarios de la Empresa Demo y generar las capturas necesarias con datos de prueba. Ajustar las definiciones y el manifiesto de capturas, y agregar anclas mínimas en la aplicación cuando hagan falta. Registrar cualquier captura que no pueda generarse por falta de servicios o datos de prueba.
5. Actualizar `docs/manual-usuario.md` y `docs/sucursal-demo.md` cuando corresponda. Revisar las capturas y ejecutar las comprobaciones apropiadas para los archivos modificados.

## Criterios de aceptación

- [x] Todas las páginas se revisan contra la aplicación y se corrigen las instrucciones obsoletas.
- [x] El manual documenta reapertura, días pendientes, timbrado, cancelación y salario diario integrado.
- [x] El tutorial ordinario llega al timbrado y los enlaces funcionan.
- [x] Los textos de controles y avisos coinciden con la aplicación.
- [x] Las páginas modificadas tienen la fecha `updated` actualizada y se muestran correctamente en Ayuda.
- [x] Las capturas necesarias se generan con datos de prueba o se registra la limitación que impide generarlas.
- [x] Los cambios de preparación y captura no alteran el comportamiento funcional de Nómina.
- [x] La documentación de capturas refleja los cambios realizados.

## Decisiones tomadas y descartadas

- **Sí:** revisar todo el manual, para detectar también instrucciones obsoletas.
- **Sí:** agregar una página para Días pendientes de pago, siguiendo la convención de una página por pantalla.
- **Sí:** documentar CFDI en las páginas existentes y extender el tutorial ordinario.
- **Sí:** usar capturas reales con datos de prueba y registrar las limitaciones.
- **No:** emitir comprobantes reales ni modificar el comportamiento funcional de Nómina.
- **No:** crear otro formato del manual; se conserva Ayuda.

## Riesgos identificados

- **Información desactualizada:** contrastar el manual con la aplicación y sus mensajes actuales.
- **Capturas de CFDI no disponibles:** usar datos de prueba y registrar cualquier dependencia externa que impida generarlas.

## Qué no incluye esta spec

- Cambios funcionales de Nómina o del esquema de base de datos.
- Emisión o cancelación de comprobantes reales para capturas.
- Manuales de otros módulos, funciones inexistentes u otros formatos del manual.

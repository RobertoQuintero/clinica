# Módulo de Recursos Humanos (HRM)

## 1. Objetivo

El módulo de **Recursos Humanos (HRM)** permitirá administrar la información de los empleados de una clínica podológica, incluyendo sus datos personales, información laboral, puestos, departamentos, documentación y estatus dentro de la organización.

El sistema deberá centralizar el expediente de cada empleado y facilitar la consulta, actualización y control de su información.

---

## 2. Estructura organizacional

### Departamentos

El módulo deberá contemplar los siguientes departamentos:

- Podología
- Suministros
- Recepción
- Marketing
- Recursos Humanos
- Finanzas
- Socios

### Puestos por departamento

#### Podología

- Podólogo
- Auxiliar de podología

#### Suministros

- Gerente de suministros
- Supervisor de suministros

#### Recepción

- Gerente de recepción
- Supervisor de recepción

#### Recursos Humanos

- Gerente de RH
- Auxiliar de RH

#### Finanzas

- Gerente de Contaduría

#### Marketing

- Gerente de Marketing
- Diseñador

#### Socios

- Socio

> Los departamentos y puestos deberán manejarse como catálogos para permitir su reutilización al registrar o editar empleados.

---

## 3. Registro de empleados

El sistema deberá permitir crear y administrar el expediente de cada empleado.

### 3.1 Datos generales

Los datos principales que deberán registrarse son:

- Nombre completo
- Puesto
- Estatus del empleado:
  - Activo
  - Inactivo
- Fotografía
- ID del empleado
- Fecha de ingreso
- Antigüedad
- Sucursal
- Supervisor
- WhatsApp
- Correo electrónico
- RFC
- CURP
- NSS

### 3.2 Sucursales

El empleado deberá poder asociarse a una sucursal.

Ejemplos de sucursales mostrados en el diseño:

- Papantla
- Poza Rica
- Puebla

El catálogo deberá permitir agregar nuevas sucursales en el futuro.

---

## 4. Datos personales

Cada empleado deberá contar con una sección de información personal.

### Campos

- Fecha de nacimiento
- Edad
- Género
- Estado civil
- Dirección
- Teléfono de contacto
- Contacto de emergencia
- WhatsApp de emergencia

La información de contacto de emergencia deberá permitir identificar a la persona que puede ser localizada en caso de una eventualidad.

---

## 5. Información laboral

La ficha del empleado deberá contener información relacionada con sus condiciones laborales.

### Campos

- Puesto
- Departamento
- Turno
- Días laborales
- Horario
- Salario diario
- Salario quincenal
- Salario mensual
- Tipo de salario
- Comisión
- Cuenta bancaria

El campo **Tipo de salario** deberá permitir representar esquemas como:

- Sueldo fijo
- Sueldo mixto
- Sueldo base + comisión

---

## 6. Documentación del empleado

El sistema deberá permitir cargar documentos relacionados con el expediente del empleado, principalmente en formato PDF.

### Documentos requeridos

- Fotografía
- INE — frente y reverso
- Comprobante de domicilio
- Constancia de situación fiscal
- CURP
- Hoja de Seguro Social
- Contrato firmado
- Firma de recibido del equipo
  - Modelo
  - Número de serie
- Firma de recibido del instrumental

### Requerimientos funcionales

El sistema deberá permitir:

- Cargar documentos PDF.
- Asociar cada documento con un empleado.
- Identificar el tipo de documento.
- Consultar documentos existentes.
- Descargar o visualizar documentos.
- Reemplazar documentos cuando sea necesario.
- Mantener el expediente documental organizado.

---

## 7. Estatus del empleado

Los empleados deberán contar con un estatus visual claramente identificable.

### Activo

Los empleados activos deberán mostrarse con un indicador de color **verde**.

### Inactivo

Los empleados inactivos deberán mostrarse con un indicador de color **rojo**.

El cambio de estatus no deberá eliminar la información histórica del empleado.

---

## 8. Expediente del empleado

La pantalla de detalle deberá presentar la información del empleado en forma de expediente.

### Encabezado

El encabezado deberá mostrar:

- Fotografía
- Nombre completo
- Puesto
- Estatus
- ID del empleado
- Acciones principales

### Acciones

Se deberán considerar las siguientes acciones:

- Editar empleado
- Activar / desactivar empleado
- Más acciones

---

## 9. Secciones del expediente

La pantalla de detalle podrá organizarse mediante pestañas.

### Información General

Contendrá:

#### Datos personales

- Fecha de nacimiento
- Edad
- Género
- Estado civil
- Dirección
- Teléfono personal
- Contacto de emergencia
- Teléfono de emergencia
- Correo personal

#### Información laboral

- Puesto
- Departamento
- Turno
- Días laborales
- Horario
- Salario diario
- Salario quincenal
- Salario mensual
- Tipo de salario
- Comisión
- Cuenta bancaria

### Nómina y Salario

Sección destinada a consultar y administrar información relacionada con:

- Salario
- Periodicidad de pago
- Tipo de salario
- Comisiones
- Datos necesarios para nómina
- Numero del seguro social
- Direccion fiscal
- Codigo postal
- Razon social

### Asistencia

Sección destinada al control de:

- Asistencia
- Faltas
- Retardos
- Horarios
- Incidencias relacionadas con asistencia

### Agenda Laboral

Sección destinada a consultar la programación laboral del empleado:

- Turnos
- Días laborales
- Horarios
- Agenda

### Documentos

Sección donde se deberá consultar y administrar el expediente documental del empleado.

### Incidencias

Sección destinada al registro y consulta de situaciones relacionadas con el empleado.

Ejemplos:

- Faltas
- Retardos
- Incapacidades
- Incidencias administrativas
- Observaciones

### Productividad

Sección destinada a registrar o consultar indicadores de productividad del empleado.

Para el personal de podología podrían considerarse indicadores como:

- Número de consultas
- Servicios realizados
- Productividad por periodo
- Comisiones generadas

### Inventario Asignado

Sección para controlar los equipos, herramientas e instrumental entregados al empleado.

Deberá permitir registrar:

- Equipo
- Modelo
- Número de serie
- Fecha de entrega
- Firma de recibido
- Estado del equipo
- Fecha de devolución, cuando aplique

---

## 10. Flujo principal del módulo

```text
INICIO HRM
    |
    v
Departamentos
    |
    v
Puestos
    |
    v
Registro / Consulta de empleados
    |
    +--> Datos generales
    |
    +--> Datos personales
    |
    +--> Información laboral
    |
    +--> Documentación
    |
    +--> Nómina y salario
    |
    +--> Asistencia
    |
    +--> Agenda laboral
    |
    +--> Incidencias
    |
    +--> Productividad
    |
    +--> Inventario asignado
```

---

## 11. Catálogos recomendados

Para mantener el módulo flexible, se recomienda administrar mediante catálogos los siguientes elementos:

- Departamentos
- Puestos
- Sucursales
- Turnos
- Tipos de contrato
- Tipos de salario
- Días laborales
- Tipos de documento
- Tipos de incidencia
- Tipos de equipo
- Estados del empleado

---

## 12. Reglas de negocio

### Empleados

1. Cada empleado deberá tener un identificador único.
2. Un empleado deberá estar asociado a un departamento.
3. Un empleado deberá tener un puesto.
4. Un empleado deberá tener una sucursal.
5. El estatus deberá ser Activo o Inactivo.
6. Desactivar un empleado no deberá eliminar su expediente.
7. La fecha de ingreso deberá permitir calcular la antigüedad.
8. La edad podrá calcularse automáticamente a partir de la fecha de nacimiento.

### Documentos

1. Cada documento deberá estar asociado a un empleado.
2. El sistema deberá identificar el tipo de documento.
3. Los documentos deberán conservar una referencia al archivo almacenado.
4. Los documentos sensibles deberán contar con controles de acceso adecuados.

### Información laboral

1. El salario deberá poder manejar diferentes periodicidades.
2. El tipo de salario deberá determinar cómo se interpreta la información salarial.
3. Los empleados con comisión deberán poder almacenar el porcentaje o esquema correspondiente.

---

## 13. Seguridad y permisos

Debido a que el módulo manejará información personal, laboral, fiscal, bancaria y documentos oficiales, se deberán establecer permisos por rol.

### Roles sugeridos

- Administrador
- Gerente de Recursos Humanos
- Auxiliar de Recursos Humanos
- Gerente de departamento
- Supervisor
- Contabilidad
- Consulta

### Ejemplo de permisos

| Funcionalidad | Administrador | RH | Supervisor | Contabilidad | Consulta |
|---|---:|---:|---:|---:|---:|
| Consultar empleados | Sí | Sí | Sí | Sí | Sí |
| Crear empleados | Sí | Sí | No | No | No |
| Editar datos personales | Sí | Sí | No | No | No |
| Editar información laboral | Sí | Sí | Limitado | Sí | No |
| Gestionar documentos | Sí | Sí | No | No | No |
| Gestionar salarios | Sí | Sí | No | Sí | No |
| Cambiar estatus | Sí | Sí | No | No | No |
| Consultar documentos sensibles | Sí | Sí | No | Según permiso | No |

---

## 14. Requisitos de la interfaz

La interfaz deberá ser clara y orientada a la consulta rápida del expediente.

### Lista de empleados

Se recomienda mostrar:

- Fotografía
- Nombre
- ID
- Puesto
- Departamento
- Sucursal
- Estatus
- Fecha de ingreso
- Acciones

También deberá incluir:

- Búsqueda por nombre
- Búsqueda por ID
- Filtro por departamento
- Filtro por puesto
- Filtro por sucursal
- Filtro por estatus

### Detalle del empleado

El diseño deberá utilizar:

- Encabezado con fotografía e información principal.
- Indicador visual del estatus.
- Botón de edición.
- Acción para activar/desactivar.
- Pestañas para separar la información.
- Secciones claramente diferenciadas.
- Acceso al expediente documental.

---

## 15. Resumen funcional

El módulo HRM de la clínica podológica deberá funcionar como un **expediente integral del empleado**, permitiendo administrar:

1. Estructura organizacional.
2. Departamentos.
3. Puestos.
4. Sucursales.
5. Datos generales.
6. Datos personales.
7. Información laboral.
8. Información salarial.
9. Asistencia.
10. Agenda laboral.
11. Documentación oficial.
12. Incidencias.
13. Productividad.
14. Inventario asignado.
15. Estatus del empleado.
16. Historial y control del expediente.

El objetivo es que Recursos Humanos pueda consultar desde una sola pantalla toda la información relevante de cada empleado y, al mismo tiempo, mantener separados los módulos operativos que requieren información específica como nómina, asistencia, documentos, incidencias, productividad e inventario.

# Especificación de Requerimientos y Reglas de Negocio: Módulo de Nómina (HRM)

Este documento concentra las reglas de negocio, fórmulas de cálculo, esquemas de pago y restricciones para el desarrollo del módulo de nómina y control de asistencia del sistema de gestión (HRM) del Centro Podológico.

---

## 1. Regla General de Salario y Método de Pago

### 1.1 Resumen de Pago Semanal
El sistema debe calcular el **Total Ganado de la Semana** considerando los siguientes conceptos:

$$\text{Total Ganado Semanal} = \text{Salario Base Semanal} + \text{Bono} + \text{Comisiones}$$

### 1.2 Desglose Visual en Sistema (Pantalla Principal / Resumen)
El sistema debe mostrar explícitamente en la vista de nómina los siguientes campos por empleado:
* **COMISIÓN:** $X\text{ cantidad}$
* **BONO:** $X\text{ cantidad}$
* **SALARIO:** $X\text{ cantidad}$
* **TOTAL GANADO DE LA SEMANA:** $\text{BONO} + \text{COMISIÓN} + \text{SALARIO}$

### 1.3 Clasificación por Método de Pago
* **Pago por Transferencia Bancaria:**
  * Sueldo Base Diario / Semanal.
  * Horas Extras.
  * Vacaciones y Prima Vacacional.
  * Aguinaldo.
* **Pago en Efectivo:**
  * Bonos (Puntualidad, Asistencia).
  * Comisiones (Onicomicosis, Pacientes atendidos).
  * Excedentes de percepciones / Horas extras especiales.

> **¡IMPORTANTE!** Las faltas, retardos, horas extras y deducciones legales afectan directamente al **salario semanal que se paga por transferencia bancaria**.

---

## 2. Percepciones (Ingresos)

### 2.1 Sueldo Base Diario
* **Monto Predeterminado:** $\$315.04\text{ MXN}$ diarios (configurable por empleado en la ficha del personal).

### 2.2 Bonos
* **Bono por Puntualidad:**
  * **Regla:** Llegar puntual los 12 días laborables de la quincena otorga un bono de $\$500.00\text{ MXN}$ a la quincena.
  * **Requerimiento:** El monto del bono debe ser parametrizable/ajustable desde el sistema.
* **Bono por Asistencia (Por no faltar):**
  * **Regla:** No tener ninguna falta durante los 15 días quincenales otorga un bono de $\$500.00\text{ MXN}$ a la quincena.
  * **Requerimiento:** El monto del bono debe ser parametrizable/ajustable desde el sistema.

### 2.3 Comisiones
* **Comisión por Venta de Tratamiento de Onicomicosis:**
  * **Regla:** Por cada tratamiento de Onicomicosis vendido, el podólogo recibe una comisión fija (Ejemplo: $\$500.00\text{ MXN}$).
  * **Requerimiento:** El monto de la comisión debe ser ajustable en el sistema.
* **Comisión por Pacientes Atendidos:**
  * **Regla:** Por alcanzar una meta diaria de pacientes atendidos (Ejemplo: 11 pacientes al día), el podólogo gana una comisión (Ejemplo: $\$350.00\text{ MXN}$).
  * **Requerimiento:** Tanto la cantidad objetivo de pacientes como el monto de la comisión deben ser parametrizables por empleado/puesto.

### 2.4 Horas Extras
* **Cálculo de la Hora Extra Base:**
  $$\text{Costo Hora Normal} = \frac{\text{Sueldo Diario}}{8 \text{ hrs}} = \frac{315.04}{8} = \$39.38\text{ MXN}$$
  $$\text{Costo Hora Extra (Doble)} = \text{Costo Hora Normal} \times 2 = \$78.76 \approx \$80.00\text{ MXN}$$
  * *Requerimiento:* El sistema debe calcular en automático el valor de la hora extra según el sueldo diario configurado.
* **Límite Semanal y Pago Triple:**
  * Hasta **9 horas extras a la semana**: Se pagan al **doble** ($\$80.00\text{ MXN}$ aprox.).
  * **A partir de la hora 10 en adelante** (si excede 9 horas semanales): Se pagan al **triple**.
* **Impacto Fiscal (ISR):**
  * Las primeras 9 horas extras **NO pagan ISR** (exentas de retención de ISR para el empleado).
  * A partir de la hora 10 en adelante, la percepción por horas extras **SÍ genera y paga ISR**.

### 2.5 Vacaciones y Prima Vacacional
* **Tabla de Antigüedad y Días de Vacaciones (Ley Federal del Trabajo):**
  * 1 año: 12 días
  * 2 años: 14 días
  * 3 años: 16 días
  * 4 años: 18 días
  * 5 años: 20 días
  * 6 a 10 años: 22 días
  * 11 a 15 años: 24 días
  * 16 a 20 años: 26 días
  * 21 a 25 años: 28 días
  * 26 a 30 años: 30 días
* **Cálculo de Prima Vacacional:**
  $$\text{Prima Vacacional} = (\text{Días de Vacaciones} \times \text{Salario Diario}) \times 0.25$$
  * *Ejemplo (1 año de antigüedad):* $(12 \text{ días} \times \$315.04) \times 0.25 = \$945.12\text{ MXN}$.
* **Requerimientos de Interfaz/Estado:**
  * Campo ajustable para modificar el monto de salario base específico de cálculo.
  * Estatus visible en el sistema: `VACACIONES TOMADAS / PENDIENTES`.
  * Estatus visible en el sistema: `VACACIONES PAGADAS AL AÑO / PENDIENTES`.
  * Estatus visible en el sistema: `PRIMA VACACIONAL PAGADA / PENDIENTE`.

### 2.6 Aguinaldo
* **Regla:** Equivalente a mínimo 15 días de salario base.
  $$\text{Aguinaldo Base} = 15 \times \text{Salario Diario}$$
  * *Ejemplo:* $15 \times \$315.04 = \$4,725.60\text{ MXN}$.
* **Estatus en Sistema:** Mapear estado `AGUINALDO PAGADO AL AÑO / PENDIENTE`.

### 2.7 Días Económicos
* **Derecho:** Cada empleado tiene derecho a **3 días económicos al año**.
* **Funcionalidad HRM:** El sistema debe contar con un botón/switch para **desactivar la validación por huella digital / checador** en las fechas autorizadas y computar el día como trabajado normal.

---

## 3. Deducciones, Control de Asistencia y Asignaciones Legales

### 3.1 Control de Faltas
* **Injustificadas:**
  * Descuento directo del día faltado en el salario por transferencia.
  * Si el sistema no detecta un archivo de justificante cargado, aplica el descuento automático.
* **Justificadas:**
  * Requiere subir justificante médico en formato PDF al sistema.
  * Si el sistema valida la presencia del archivo PDF de justificante, **NO cuenta como falta**.

### 3.2 Control de Retardos
* **Definición de Retardo:** Llegar 10 minutos o más después de la hora limite de entrada.
* **Injustificados:**
  * **Llegada de 30 min tarde o más:** Se descuenta directamente **medio día** de salario.
  * **Acumulación Quincenal de Retardos:**
    * **2 retardos en la quincena:** Equivale a **media falta** (descuento de medio día).
    * **4 retardos en la quincena:** Equivale a **1 falta completa** (descuento de 1 día entero de salario).
    * Si el sistema no detecta justificante PDF, se aplica el descuento automáticamente.
* **Justificados:**
  * Subida de justificante médico / administrativo en formato PDF.
  * Si hay PDF adjunto en el sistema, no computa para el límite de retardos.
* *Nota:* Estas reglas deben quedar integradas en el reglamento interno precargado en la plataforma.

### 3.3 Deducciones Legales e Impuestos (Esquema Interno y Operativo)
* **Tratamiento Fiscal General:**
  * Las deducciones legales (IMSS / ISR) entran como deducción total dentro de la contabilidad de la empresa (centro podológico).
  * **Cortes de Nómina:** Se realizan los días **miércoles** para realizar el pago los **viernes** (o jueves si el pago cae en sábado).
* **Seguro Social (IMSS) - Referencias de Cálculo Patronal vs. Empleado:**
  * *Pago Mensual (Ejemplo base $\$1,386.00\text{ MXN}$ total):*
    * Patrón: $\$1,257.00\text{ MXN}$
    * Empleado: $\$129.00\text{ MXN}$
  * *Pago Bimestral (Ejemplo base $\$4,214.00\text{ MXN}$ total):*
    * Patrón: $\$3,861.00\text{ MXN}$
    * Trabajador: $\$353.00\text{ MXN}$
* **Configuración por Empleado en Sistema:**
  * Debe existir un campo editable en la ficha del empleado para registrar la retención o aportación fija asignada (Ejemplo: $\$1,500.00\text{ MXN}$ en impuestos o monto IMSS/ISR).
  * El trabajador percibe su sueldo libre neto por transferencia (Ejemplo: de $\$5,000.00$, descontando IMSS e ISR de ley que se enteran al gobierno, el neto es de $\$4,500.00$), adicionando sus horas extras y bonos/comisiones en efectivo.
* **Tope de Bono/Vales de Despensa:**
  * El monto por concepto de bono de despensa **no debe exceder los $\$1,420.00\text{ MXN}$ al mes**.

---

## 4. Recibos de Nómina, Firma Electrónica y Roles de Usuario

### 4.1 Firma Electrónica de Recibos Quincenales
* **Proceso de Firma:** Los recibos de nómina quincenales se deben firmar digitalmente en la plataforma.
* **Validación de Seguridad / Identidad:** Al momento de firmar, el módulo debe solicitar:
  1. Firma autógrafa digital (en pantalla/pad touch).
  2. **Captura de fotografía en vivo (vía webcam/cámara del dispositivo)** como evidencia biométrica al momento de firmar (mecanismo tipo autenticación bancaria).
* **Impresión:** Posibilidad de emitir / imprimir el recibo de nómina en físico.

### 4.2 Restricción de Permisos y Roles (Matriz de Visibilidad)

| Módulo / Información | Rol Podólogo / Empleado | Rol Administrador / RH |
| :--- | :---: | :---: |
| **Salario Base Actual** |  Sí |  Sí |
| **Comisiones de la Semana / Mes** |  Sí |  Sí |
| **Total de Comisiones Acumuladas del Mes** |  Sí |  Sí |
| **Histórico Anterior de Comisiones / Pagos de Meses Pasados** | ❌ No |  Sí |
| **Detalle de Deducciones Totales de la Empresa** | ❌ No |  Sí |
| **Ajuste de Montos y Configuración de Parámetros** | ❌ No |  Sí |
| **Aprobación de Justificantes y Días Económicos** | ❌ No |  Sí |

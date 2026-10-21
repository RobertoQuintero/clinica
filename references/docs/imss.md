# Calculo deduccion IMSS

- La retencion se calcula sobre el SBC
- el SBC el contador lo captura (el mismo que reportó en IDSE)
- tasas obreras de 2026
- lo retenido en la nómina debe coincidir con lo que se paga al mes o al bimestre la diferencia NO SE AJUSTA, SI FALTO NO SE LE QUITA AL TRABAJADOR.
- Cotizan los de régimen 02 con NSS

## Tabla deducciones IMSS

| Clave / Concepto | Descripción Técnica / Supuesto | Regla de Cálculo / Base Legal | Observaciones de Implementación / Programación |
| :--- | :--- | :--- | :--- |
| **102. IMSS - Enfermedad y Maternidad (EyM)** | Aportación obrera por la cobertura de prestaciones en especie y dinero de EyM. | **Cuota fija:** Exenta para el trabajador (la paga íntegra el patrón).<br><br>**Excedente de 3 veces la UMA:** Se retiene el **0.40%** sobre la diferencia que resulte de restar 3 UMA al Salario Base de Cotización (SBC) (Art. 106, Ley del Seguro Social - LSS). | Requiere que el sistema valide si el SBC supera el límite de 3 UMA diarias para activar el cálculo del excedente. |
| **103. IMSS - Invalidez y Vida (IyV)** | Aportación obrera para riesgos de invalidez y fallecimiento. | Se retiene el **0.625%** sobre el Salario Base de Cotización (SBC) del trabajador (Art. 147, LSS). | Aplicar directamente sobre el SBC topado a 25 UMA (Art. 28, LSS). |
| **104. IMSS - Cesantía en Edad Avanzada y Vejez (CEAV)** | Aportación obrera destinada al retiro, cesantía y vejez. | Se retiene el porcentaje variable según el rango salarial de la tabla oficial de cuotas obrero-patronales de la LSS (Art. 168, LSS). | El sistema debe consultar la tabla vigente ligada al SBC del trabajador. |
| **105. IMSS - Retiro** | Aportación obrera complementaria para el rubro de retiro. | El trabajador aporta el **2.0%** sobre su Salario Base de Cotización (SBC) (Art. 168, LSS). | Aplicar sobre el SBC topado a 25 UMA. |



### Caso Práctico de Cálculo

**Salario Diario (SD):** $500.00 pesos
**Salario Base de Cotización (SBC):** $530.00 pesos (incluyendo prestaciones mínimas integradas).
**Valor UMA Diario vigente (2026): $117.31 pesos**
**Días del periodo:** 15 días (nómina quincenal).

---

#### 1. Determinación de la Base Quincenal

* $\text{SBC Quincenal} = \$530.00 \times 15 = \$7,950.00\text{ pesos.}$

---

#### 2. Cálculo por Ramo de Aseguramiento

##### A. Enfermedad y Maternidad (EyM) - Excedente de 3 UMA
El sistema debe validar el límite de 3 UMA con el valor actualizado:

1. **Límite de 3 UMA diarias:** $3 \times \$117.31 = \$351.93\text{ pesos.}$
2. **Excedente diario:** $\$530.00\text{ (SBC)} - \$351.93 = \$178.07\text{ pesos diarios.}$
3. **Excedente quincenal:** $\$178.07 \times 15 = \$2,671.05\text{ pesos.}$
4. **Cuota Obrera (0.40%):** $\$2,671.05 \times 0.40\% = \mathbf{\$10.68\text{ pesos}}$

##### B. Invalidez y Vida (IyV)
Aplicación directa sobre el SBC quincenal.

1. **Base:** $\$7,950.00\text{ pesos.}$
2. **Cuota Obrera (0.625%):** $\$7,950.00 \times 0.625\% = \mathbf{\$49.69\text{ pesos}}$

##### C. Cesantía en Edad Avanzada y Vejez (CEAV)
Aplicación del porcentaje correspondiente al rango salarial (ej. 1.125%).

1. **Base:** $\$7,950.00\text{ pesos.}$
2. **Cuota Obrera:** $\$7,950.00 \times 1.125\% = \mathbf{\$89.44\text{ pesos}}$

##### D. Retiro
Aportación fija del obrero.

1. **Base:** $\$7,950.00\text{ pesos.}$
2. **Cuota Obrera (2.0%):** $\$7,950.00 \times 2.0\% = \mathbf{\$159.00\text{ pesos}}$

---

#### 3. Resumen de Retención Total de IMSS (Quincenal)

| Ramo del Seguro | Base de Cálculo Quincenal | Tasa / Regla Aplicable | Importe a Retener (Pesos) |
| :--- | :--- | :--- | :--- |
| **EyM (Excedente)** | $2,671.05 (Exceso sobre 3 \times UMA 2026) | 0.40% | $10.68 |
| **Invalidez y Vida** | $7,950.00 (SBC Quincenal) | 0.625% | $49.69 |
| **Cesantía y Vejez** | $7,950.00 (SBC Quincenal) | 1.125% (Variable por rango) | $89.44 |
| **Retiro** | $7,950.00 (SBC Quincenal) | 2.00% | $159.00 |
| **TOTAL IMSS OBRERO** | --- | --- | **$308.81 pesos** |



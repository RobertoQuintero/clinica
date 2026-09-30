
### 3.1 Control de Faltas
* **Injustificadas:**
  * Descuento directo del día faltado en el salario.
  * Sin un archivo de justificante cargado, aplica el descuento automático.
* **Justificadas:**
  * Requiere subir justificante médico en formato PDF al sistema.
  * Si el sistema valida la presencia del archivo PDF de justificante, **NO cuenta como falta**.

### 3.2 Control de Retardos
* **Definición de Retardo:** Llegar 10 minutos o más después de la hora limite de entrada.(Debe ser configurable este limite)
* **Injustificados:**
  * **Llegada de 30 min tarde o más:** Se descuenta directamente **medio día** de salario. (debe ser configurable esta tolerancia)
  * **Acumulación de Retardos por periodo:**
    * **1 retardo en la semana:** Equivale a **media falta** (descuento de medio día).(la cantidad de dias y penalizacion debe ser configurable segun el periodo)
    * **2 retardos en la semana:** Equivale a **1 falta completa** (descuento de 1 día entero de salario).
    * Si no hay justificante PDF, se aplica el descuento automáticamente.
* **Justificados:**
  * Subida de justificante médico / administrativo en formato PDF.
  * Si hay PDF adjunto en el sistema, no computa para el límite de retardos.
 (limites y tolerancias deben ser editables)


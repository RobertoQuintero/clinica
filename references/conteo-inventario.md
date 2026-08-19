# Inventarios

## 1. Los dos actores

El proceso tiene dos participantes:

### Podólogo

- Es quien físicamente cuenta los productos.
- Puede generar y realizar inventarios.
- No puede consultar el stock real del sistema mientras está contando.
- Solo registra lo que físicamente encontró.

### Supervisor

- No realiza el conteo inicial.
- Revisa el inventario que realizó el podólogo.
- Decide qué hacer con cada diferencia detectada.
- Es quien finalmente autoriza el ajuste del stock.

## 2. ¿Qué es un inventario?

Un inventario es un proceso mediante el cual se compara:

- Lo que físicamente existe en la sucursal
- contra
- lo que el sistema considera que debería existir.

Pero el podólogo no debe conocer el segundo dato durante el conteo, porque eso podría influir en lo que registra.

**Ejemplo:**

El sistema realmente tiene registrado:

- 20 guantes

Pero físicamente hay:

- 17 guantes

El podólogo debe registrar simplemente:

**17**

sin saber que el sistema esperaba 20.

## 3. Inicio del inventario

El podólogo entra al módulo de inventarios y selecciona qué tipo de inventario realizará.

Puede elegir:

### Inventario general

Cuenta todos los productos de la sucursal.

### Inventario por categoría

Por ejemplo:

- Medicamentos
- Instrumental
- Consumibles

El sistema genera entonces el inventario correspondiente y muestra al podólogo los productos que debe contar.

> **Importante:** El sistema **NO** debe mostrar la existencia actual.

Debe mostrar algo parecido a:

| Producto | Primer conteo |
|---|---:|
| Guantes | ___ |
| Gasas | ___ |
| Alcohol | ___ |
| Vendas | ___ |

El podólogo únicamente introduce las cantidades que contó físicamente.

## 4. Primer conteo

El podólogo realiza el primer conteo físico.

**Ejemplo:**

| Producto | Primer conteo |
|---|---:|
| Guantes | 17 |
| Gasas | 50 |
| Alcohol | 8 |

Guarda el conteo.

El sistema toma esos datos e internamente compara contra el stock real, pero esa información sigue oculta para el podólogo.

Por ejemplo:

| Producto | Conteo | Stock sistema | Diferencia |
|---|---:|---:|---:|
| Guantes | 17 | 20 | -3 |
| Gasas | 50 | 50 | 0 |
| Alcohol | 8 | 10 | -2 |

El podólogo nunca ve esa tabla.

Él solamente debe saber qué productos requieren un segundo conteo.

## 5. Segundo conteo

El sistema detecta los productos que presentan diferencia y solicita un segundo conteo únicamente de esos productos.

Por ejemplo:

> Se detectaron diferencias en 2 productos.  
> Realice un segundo conteo.

El podólogo vuelve físicamente a contar:

| Producto | Segundo conteo |
|---|---:|
| Guantes | 17 |
| Alcohol | 8 |

Guarda nuevamente.

La finalidad es reducir errores humanos.

Por ejemplo, si en el primer conteo escribió accidentalmente 17 cuando realmente eran 18, el segundo conteo puede corregirlo.

## 6. Finalización del inventario del podólogo

Una vez realizado el segundo conteo, termina la participación del podólogo.

Aquí hay algo importante para el programador:

El podólogo **NO ajusta el inventario**.

No debe existir un botón como:

> “Actualizar stock”

porque esa decisión corresponde al supervisor.

El inventario queda guardado como:

**Realizado / pendiente de revisión**

y pasa a la bandeja del supervisor.

## 7. ¿Qué recibe el supervisor?

El supervisor verá los inventarios que están pendientes de revisión.

Debe poder identificar claramente:

- Folio del inventario.
- Sucursal.
- Usuario que lo realizó.
- Fecha.
- Hora.
- Tipo de inventario.
- Si fue general o por categoría.
- Estado del inventario.

**Ejemplo:**

```text
Inventario #INV-00025
Sucursal: Centro
Realizado por: Juan Pérez
Fecha: 18/08/2026
Hora: 10:35 AM
Tipo: Inventario por categoría
Categoría: Material de curación
Estado: Pendiente de revisión
```

## 8. El supervisor solamente revisa las diferencias

El sistema debe mostrarle los productos donde exista una diferencia.

Por ejemplo:

| Producto | Conteo físico | Stock sistema | Diferencia |
|---|---:|---:|---:|
| Guantes | 17 | 20 | -3 |
| Alcohol | 12 | 10 | +2 |

Y por cada producto con diferencia deberá tener tres decisiones posibles.

### Opción 1 — Aumentar stock

Se utiliza cuando el conteo físico demuestra que hay más producto del que registra el sistema.

**Ejemplo:**

Sistema:

**10**

Conteo:

**12**

El supervisor selecciona:

**Aumentar stock**

Resultado:

**Stock = 12**

Se registra una entrada/ajuste de inventario por **+2**.

### Opción 2 — Disminuir stock

Se utiliza cuando el conteo físico demuestra que existe menos producto.

**Ejemplo:**

Sistema:

**20**

Conteo:

**17**

El supervisor selecciona:

**Disminuir stock**

Resultado:

**Stock = 17**

Se registra una salida/ajuste de inventario por **-3**.

### Opción 3 — Dejar stock tal cual

Esta opción es muy importante.

El supervisor puede considerar que la diferencia no debe modificar el inventario.

**Ejemplo:**

Sistema:

**20**

Conteo:

**17**

Pero el supervisor determina que no debe realizarse el ajuste.

Selecciona:

**Dejar stock tal cual**

Resultado:

**Stock continúa en 20.**

Pero no debe desaparecer la diferencia.

Debe quedar registrado que:

> Se detectó una diferencia de -3 y el supervisor decidió no modificar el stock.

Esto es importante para la auditoría.

## 9. La decisión es producto por producto

El supervisor no debe estar obligado a aceptar o rechazar todo el inventario de una sola vez.

Cada diferencia debe tener su propia decisión.

**Ejemplo:**

| Producto | Diferencia | Decisión |
|---|---:|---|
| Guantes | -3 | Disminuir |
| Alcohol | +2 | Aumentar |
| Gasas | -1 | Dejar stock tal cual |

Así el supervisor puede analizar cada caso individualmente.

## 10. ¿Cuándo se modifica realmente el stock?

Esta es probablemente la regla más importante de todo el proceso:

> **El stock real NO debe modificarse durante el conteo del podólogo.**

El proceso sería:

### Podólogo

1. Crea inventario.
2. Realiza primer conteo.
3. Guarda.
4. El sistema detecta diferencias.
5. Realiza segundo conteo.
6. Finaliza inventario.

### Después: Supervisor

1. Revisa inventario.
2. Analiza cada diferencia.
3. Decide aumentar / disminuir / dejar igual.
4. El sistema realiza el ajuste correspondiente.
5. Queda registrado el movimiento.

## 11. Ejemplo completo

Supongamos que existen **20 guantes** en el sistema.

El podólogo hace su primer conteo:

**17**

El sistema detecta:

**Diferencia de -3**

Solicita segundo conteo.

El podólogo vuelve a contar:

**17**

El inventario queda pendiente de revisión.

El supervisor lo abre y ve:

```text
Stock sistema: 20
Conteo: 17
Diferencia: -3
```

Tiene tres opciones:

- **Aumentar:** no tendría sentido en este caso.
- **Disminuir:** modifica de 20 → 17.
- **Dejar stock tal cual:** mantiene 20.

Supongamos que selecciona **Disminuir**.

Entonces el sistema genera un movimiento:

```text
Ajuste de inventario
Producto: Guantes
Cantidad: -3
Motivo: Ajuste por inventario
Inventario: INV-00025
Autorizado por: Supervisor
Fecha/hora: ...
```

Así se puede saber en el futuro exactamente por qué el stock cambió.

## 12. Resumen conceptual

El inventario tiene dos etapas y dos responsabilidades diferentes.

El podólogo solamente cuenta y registra lo que físicamente encuentra. No tiene acceso al stock real del sistema y no puede modificarlo.

El supervisor revisa las diferencias encontradas por el podólogo y decide qué hacer con cada una.

Solo después de la decisión del supervisor se puede modificar el stock.

Toda modificación debe generar un movimiento de inventario que permita saber:

- qué producto cambió,
- cuánto cambió,
- por qué cambió,
- qué inventario lo originó,
- y qué usuario autorizó el cambio.

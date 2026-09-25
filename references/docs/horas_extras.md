# Calculo de Percepciones de horas extras por empleado (solo nomina operativa)
 Estas reglas tabien se van a aplicar a utilizando el salario_diario_fiscal posteriormente
 ahora solo es importante unicamente el calculo de las horas extras

- cada empleado tiene un horario de entrada y salida asignado
- los horarios se leen en la tabla  [RH].[empleado_horarios]
- las horas de entrada y salida reales registradas por el checador se leen en [RH].[asistencias]
- La hora extra se paga al doble osea (salario_diario MXN/8hrs)*2
- Solo puede trabajar 9 Horas extras a la semana (restriccion para nomina fiscal)
- Si exeden de las 9 horas extras se pagan al triple (restriccion para nomina fiscal)
- las primeras 9 horas no pagan ISR (restriccion para nomina fiscal)
- Si se pasa de la hora 10 en adelante paga ISR (restriccion para nomina fiscal)
- el sistema debe ajustar la Hora extra en automatico segun salario diario (salario_diario MXN/8hrs)*2 (restriccion para nomina fiscal)
- el limite de horas extras dobles y triples debe ser modificable (restriccion para nomina fiscal)
  
La reglas de calculo son:
 
Horas trabajadas = Salida − Entrada
 
Y después:
 
Horas extra = Horas trabajadas − Jornada laboral esperada
 
Supongamos que un empleado tiene:

=======================ENTRADA NORMAL=======================
ejemplo: 

Jornada de 8 am a 5 pm

Entrada: 08:00

Salida programada: 17:00

Salida real: 19:30

Jornada: 9 horas
 
08:00 → 19:30 = 11.5 horas

11.5 − 9 = 2.5 horas extra
 
======================Retardo=======================

Pero si entró tarde:
 
Jornada de 9 am a 6 pm 

Entrada: 10:00

Salida programada: 18:00

Salida real: 19:00
 
Trabajó 10 horas.
 
Podrías tener:

10 − 9 = 1 horas extra
 
Lo real

retardo 1 hora

hora extra 1 hora
 
======================Reglas de autorización

El sistema debe validar si las horas extra son autorizadas

 
==========REVISAR CONTRA JORNADA PROGRAMADA

Asistencia

    ↓

Entrada / Salida

    ↓

Determinar jornada programada

    ↓

Calcular horas trabajadas

    ↓

Determinar horas extra

    ↓

Aplicar reglas de autorización

    ↓

Nómina

 
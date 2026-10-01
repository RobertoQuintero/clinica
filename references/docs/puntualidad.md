====BONO DE PUNTUALIDAD====
 
	Aplica solo para podologos
*Incidencias que afectan al bono 
	Incidencias que afectan al bono = Retardos + Faltas injustificadas
	Y:
	Si incidencias > máximo permitido → pierde el bono.
*Una falta injustificada suma 1 incidencia para el Bono de Puntualidad.
*Combinación de retardos y faltas injustificadas
	Ejemplo 1
		Retardos: 1
		Faltas injustificadas: 1
		Máximo permitido: 2
		Total: 1 + 1 = 2
		Resultado: Bono conservado.
	Ejemplo 2
		Retardos: 1
		Faltas injustificadas: 2
		Máximo permitido: 2
		Total: 1 + 2 = 3
		Resultado: Bono perdido.
	Ejemplo 3
		Retardos: 0
		Faltas injustificadas: 3
		Máximo permitido: 2
		Total: 0 + 3 = 3
		Resultado: Bono perdido.
 
******Reglas******	 
*EL bono de puntualidad es configurable con los siguientes campos
	Monto: Es el importe total del bono que puede recibir el empleado en el periodo de nómina.
	Tolerancia: Es el número de minutos posteriores a la hora programada de entrada que todavía se consideran como puntualidad.
	Maximo de incidencias:  Este parámetro determina cuántas incidencias que afectan al Bono de Puntualidad puede acumular el empleado durante el periodo antes de perderlo.
	Status:Si el bono aplica o no aplica
Ejemplo
Llegar en el limite de tolerancia no genera incidencia
	Entrada programada: 09:00
	Tolerancia: 10 minutos
	Límite: 09:10
Resultado:
	09:10 → Puntual
	09:11 → Retardo
	Cada retardo suma 1 incidencia para el Bono de Puntualidad.
*El trabajador obtiene el bono de puntualidad cuando durante el periodo de nómina no supera el número máximo de incidencias configuradas y cumple las demás condiciones establecidas en la política.
*El bono se evalúa únicamente con la entrada, cada incidencia se determina "Hora entrada real > Hora entrada programada + tolerancia = Incidencia"
*La salida no afecta el bono de puntualidad.
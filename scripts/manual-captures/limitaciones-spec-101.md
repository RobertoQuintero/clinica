# Capturas pendientes — manual de Nómina, spec 101

El 24 de noviembre de 2026 se intentó ejecutar `npm run capture:manual` contra el servidor local. Los 19 marcadores existentes coincidieron con sus definiciones, pero la consulta a la base de datos de `.env.local` terminó por tiempo de espera antes de poder comprobar o preparar la Empresa Demo. No se regeneraron imágenes ni el manifiesto.

Quedan pendientes capturas con datos ficticios de:

- Días pendientes de pago, con al menos una captura y sus tarifas.
- Un periodo pagado con la acción «Reabrir periodo» y su diálogo de motivo.
- La vista fiscal de un periodo ordinario pagado con la columna CFDI y el detalle fiscal con salario diario integrado.
- Los estados, descargas y diálogo de cancelación de un CFDI de prueba, si hay emisor y servicio de pruebas disponibles. No emitir ni cancelar comprobantes reales para estas imágenes.

Las capturas existentes se conservan y pueden no mostrar los controles recientes. Cuando la base y la Empresa Demo estén disponibles, preparar los datos de prueba, agregar los marcadores y definiciones correspondientes, generar las imágenes y el manifiesto, y retirar esta nota al resolver todas las limitaciones.

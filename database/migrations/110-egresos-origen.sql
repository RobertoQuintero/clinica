-- Ejecutar antes de desplegar el código de la SPEC 110.
-- Los egresos existentes quedan sin clasificar hasta acreditar su origen.
IF COL_LENGTH('dbo.Egresos', 'origen') IS NULL
BEGIN
    ALTER TABLE dbo.Egresos ADD origen varchar(32) NULL;
END;

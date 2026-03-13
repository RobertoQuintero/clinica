import db from "@/database/connection";

export type RateLimitKeyType = "IP" | "EMAIL" | "REG_IP";

// Login: bloqueo por IP
export const IP_THRESHOLD     = 20;  // intentos fallidos antes de bloquear
export const IP_BLOCK_MINUTES = 30;  // minutos de bloqueo
export const IP_WINDOW_MINUTES = 15; // ventana de tiempo para contar intentos

// Login: bloqueo por cuenta (email)
export const EMAIL_THRESHOLD     = 5;
export const EMAIL_BLOCK_MINUTES = 15;
export const EMAIL_WINDOW_MINUTES = 15;

// Registro: bloqueo por IP
export const REG_IP_THRESHOLD     = 10;
export const REG_IP_BLOCK_MINUTES = 15;
export const REG_IP_WINDOW_MINUTES = 15;

// Bandera de módulo para evitar verificar la tabla en cada request
let tableEnsured = false;

/**
 * Crea la tabla login_attempts si no existe (idempotente).
 */
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await db.query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.objects
       WHERE object_id = OBJECT_ID(N'[dbo].[login_attempts]')
         AND type = N'U'
    )
    BEGIN
      CREATE TABLE [dbo].[login_attempts] (
        [id]              INT IDENTITY(1,1) PRIMARY KEY,
        [key_type]        VARCHAR(10)   NOT NULL,
        [key_value]       NVARCHAR(255) NOT NULL,
        [failed_count]    INT           NOT NULL DEFAULT 0,
        [last_attempt_at] DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        [blocked_until]   DATETIME2     NULL,
        CONSTRAINT [UQ_login_attempts_key] UNIQUE ([key_type], [key_value])
      );
      CREATE INDEX [IX_login_attempts_lookup]
        ON [dbo].[login_attempts] ([key_type], [key_value], [blocked_until]);
    END
  `);
  tableEnsured = true;
}

/**
 * Extrae la IP real del cliente desde los headers del request.
 * Soporta proxies / load balancers (x-forwarded-for, x-real-ip).
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Verifica si una clave (IP o email) está actualmente bloqueada.
 * Retorna { blocked: true, retryAfter: ISO string } si hay bloqueo activo.
 */
export async function checkBlocked(
  keyType: RateLimitKeyType,
  keyValue: string
): Promise<{ blocked: boolean; retryAfter?: string }> {
  await ensureTable();

  const rows = await db.queryParams(
    `SELECT [blocked_until]
       FROM [dbo].[login_attempts]
      WHERE [key_type]     = @key_type
        AND [key_value]    = @key_value
        AND [blocked_until] IS NOT NULL
        AND [blocked_until] > GETUTCDATE()`,
    { key_type: keyType, key_value: keyValue }
  );

  if (rows && rows.length > 0) {
    const row = rows[0] as { blocked_until: Date };
    return { blocked: true, retryAfter: row.blocked_until.toISOString() };
  }

  return { blocked: false };
}

/**
 * Registra un intento fallido para la clave dada.
 * Si se supera `threshold` dentro de `windowMinutes`, activa un bloqueo
 * de `blockMinutes` minutos. Si la ventana expiró o el bloqueo anterior
 * venció, reinicia el contador.
 */
export async function recordFailedAttempt(
  keyType: RateLimitKeyType,
  keyValue: string,
  threshold: number,
  blockMinutes: number,
  windowMinutes: number
): Promise<void> {
  await ensureTable();

  await db.queryParams(
    `MERGE [dbo].[login_attempts] AS target
     USING (SELECT @key_type AS key_type, @key_value AS key_value) AS source
        ON target.[key_type]  = source.[key_type]
       AND target.[key_value] = source.[key_value]
     -- Bloqueo anterior expiró: reiniciar contador
     WHEN MATCHED AND (
       target.[blocked_until] IS NOT NULL
       AND target.[blocked_until] <= GETUTCDATE()
     ) THEN
       UPDATE SET
         [failed_count]    = 1,
         [last_attempt_at] = GETUTCDATE(),
         [blocked_until]   = NULL
     -- Ventana de tiempo expiró (sin bloqueo activo): reiniciar contador
     WHEN MATCHED AND (
       target.[blocked_until] IS NULL
       AND target.[last_attempt_at] < DATEADD(MINUTE, -@window_minutes, GETUTCDATE())
     ) THEN
       UPDATE SET
         [failed_count]    = 1,
         [last_attempt_at] = GETUTCDATE(),
         [blocked_until]   = NULL
     -- Dentro de la ventana: incrementar y block si se supera el umbral
     WHEN MATCHED THEN
       UPDATE SET
         [failed_count]    = target.[failed_count] + 1,
         [last_attempt_at] = GETUTCDATE(),
         [blocked_until]   = CASE
           WHEN target.[failed_count] + 1 >= @threshold
           THEN DATEADD(MINUTE, @block_minutes, GETUTCDATE())
           ELSE NULL
         END
     -- Primera vez: insertar
     WHEN NOT MATCHED THEN
       INSERT ([key_type],[key_value],[failed_count],[last_attempt_at],[blocked_until])
       VALUES (@key_type, @key_value, 1, GETUTCDATE(), NULL);`,
    {
      key_type:       keyType,
      key_value:      keyValue,
      threshold,
      block_minutes:  blockMinutes,
      window_minutes: windowMinutes,
    }
  );
}

/**
 * Elimina el registro de intentos fallidos para la clave dada
 * (se llama al hacer login exitoso).
 */
export async function resetAttempts(
  keyType: RateLimitKeyType,
  keyValue: string
): Promise<void> {
  await ensureTable();

  await db.queryParams(
    `DELETE FROM [dbo].[login_attempts]
      WHERE [key_type]  = @key_type
        AND [key_value] = @key_value`,
    { key_type: keyType, key_value: keyValue }
  );
}

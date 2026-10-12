import "server-only";

import { ITransactionClient } from "@/database/connection";
import { buildDate } from "@/utils/date_helpper";
import { encryptSecret, decryptSecret } from "@/lib/billing/crypto";
import {
  IOrganizationRecord,
  IOrganizationSecrets,
  OrganizationLegalInput,
  PayrollIssuerInput,
  FacturapiMode,
} from "@/interfaces/organization";

/**
 * Toda la superficie SQL del módulo de facturación. Cada función recibe un
 * `ITransactionClient` (que puede ser el `db` singleton o el cliente de una
 * `db.transaction()`) en vez de importar `db` directamente, para que las actions
 * puedan encadenar una mutación con su `writeAuditEntry` correspondiente dentro
 * de la misma transacción cuando la operación toca las dos tablas (spec 28).
 */

const SCHEMA_TABLE_ORGANIZATIONS = "[CentroPodologico].[BILLING].[organizations]";
const SCHEMA_TABLE_AUDIT_LOG = "[CentroPodologico].[BILLING].[audit_log]";

/** Fila proyectada de `organizations`: nunca incluye `test_key`/`live_key` en claro. */
type OrganizationRow = IOrganizationRecord & IOrganizationSecrets;

const ORGANIZATION_SELECT_COLUMNS = `
  [id],
  [uid],
  [id_empresa],
  [is_live],
  [name],
  [legal_name],
  [tax_id],
  [tax_system],
  [phone],
  [website],
  [support_email],
  [street],
  [exterior],
  [interior],
  [neighborhood],
  [zip],
  [city],
  [municipality],
  [state],
  [country],
  [default_product_id],
  [registro_patronal],
  [riesgo_puesto],
  [curp_emisor],
  [is_payroll_issuer],
  CONVERT(varchar(19), [created_at], 120) AS created_at,
  CONVERT(varchar(19), [updated_at], 120) AS updated_at,
  CASE WHEN [test_key] IS NULL THEN 0 ELSE 1 END AS has_test_key,
  CASE WHEN [live_key] IS NULL THEN 0 ELSE 1 END AS has_live_key
`;

function normalizeOrganizationRow(row: Record<string, unknown>): OrganizationRow {
  return {
    ...(row as unknown as IOrganizationRecord),
    is_live: Boolean(row.is_live),
    is_payroll_issuer: Boolean(row.is_payroll_issuer),
    hasTestKey: Boolean(row.has_test_key),
    hasLiveKey: Boolean(row.has_live_key),
  };
}

/**
 * Busca una organización por `uid`, filtrada siempre por `id_empresa` — colapsa los
 * 8 `SELECT ... WHERE uid = ?` dispersos del proyecto original en un solo punto de
 * entrada, que además garantiza el chequeo de tenant en todos los call sites.
 * Devuelve `null` si no existe o si pertenece a otra empresa (misma respuesta para
 * ambos casos, para no filtrar cuáles `uid` existen).
 */
export async function getOrganizationByUid(
  client: ITransactionClient,
  uid: string,
  idEmpresa: number
): Promise<OrganizationRow | null> {
  const rows = await client.queryParams(
    `SELECT ${ORGANIZATION_SELECT_COLUMNS}
       FROM ${SCHEMA_TABLE_ORGANIZATIONS}
      WHERE [uid] = @uid AND [id_empresa] = @idEmpresa`,
    { uid, idEmpresa }
  );
  if (rows.length === 0) return null;
  return normalizeOrganizationRow(rows[0]);
}

/**
 * Única salida de una clave descifrada. Filtra por tenant igual que
 * `getOrganizationByUid`; devuelve `null` si la organización no existe para esa
 * empresa, o si el modo pedido no tiene clave configurada.
 */
export async function getOrganizationKey(
  client: ITransactionClient,
  uid: string,
  idEmpresa: number,
  mode: FacturapiMode
): Promise<string | null> {
  const column = mode === "live" ? "live_key" : "test_key";
  const rows = await client.queryParams(
    `SELECT [${column}] AS encrypted_key
       FROM ${SCHEMA_TABLE_ORGANIZATIONS}
      WHERE [uid] = @uid AND [id_empresa] = @idEmpresa`,
    { uid, idEmpresa }
  );
  const encryptedKey = rows[0]?.encrypted_key as string | null | undefined;
  if (!encryptedKey) return null;
  return decryptSecret(encryptedKey);
}

/** `uid`s de todas las organizaciones de una empresa — filtro por tenant para el listado. */
export async function listOrganizationUids(
  client: ITransactionClient,
  idEmpresa: number
): Promise<string[]> {
  const rows = await client.queryParams(
    `SELECT [uid] FROM ${SCHEMA_TABLE_ORGANIZATIONS} WHERE [id_empresa] = @idEmpresa`,
    { idEmpresa }
  );
  return rows.map((row) => row.uid as string);
}

export interface INewOrganizationInput extends OrganizationLegalInput {
  uid: string;
  id_empresa: number;
  /** Clave de prueba en claro, tal como la devuelve Facturapi al crear la organización; se cifra aquí antes de guardar. */
  testKey: string;
}

/** Inserta la fila local sidecar de una organización recién creada en Facturapi. */
export async function insertOrganization(
  client: ITransactionClient,
  input: INewOrganizationInput
): Promise<OrganizationRow> {
  const now = buildDate(new Date());
  const encryptedTestKey = encryptSecret(input.testKey);

  const rows = await client.queryParams(
    `INSERT INTO ${SCHEMA_TABLE_ORGANIZATIONS}
       ([uid], [id_empresa], [test_key], [is_live],
        [name], [legal_name], [tax_id], [tax_system], [phone], [website], [support_email],
        [street], [exterior], [interior], [neighborhood], [zip], [city], [municipality], [state], [country],
        [created_at], [updated_at])
     OUTPUT
       INSERTED.[id],
       INSERTED.[uid],
       INSERTED.[id_empresa],
       INSERTED.[is_live],
       INSERTED.[name],
       INSERTED.[legal_name],
       INSERTED.[tax_id],
       INSERTED.[tax_system],
       INSERTED.[phone],
       INSERTED.[website],
       INSERTED.[support_email],
       INSERTED.[street],
       INSERTED.[exterior],
       INSERTED.[interior],
       INSERTED.[neighborhood],
       INSERTED.[zip],
       INSERTED.[city],
       INSERTED.[municipality],
       INSERTED.[state],
       INSERTED.[country],
       INSERTED.[default_product_id],
       INSERTED.[registro_patronal],
       INSERTED.[riesgo_puesto],
       INSERTED.[curp_emisor],
       INSERTED.[is_payroll_issuer],
       CONVERT(varchar(19), INSERTED.[created_at], 120) AS created_at,
       CONVERT(varchar(19), INSERTED.[updated_at], 120) AS updated_at,
       CASE WHEN INSERTED.[test_key] IS NULL THEN 0 ELSE 1 END AS has_test_key,
       CASE WHEN INSERTED.[live_key] IS NULL THEN 0 ELSE 1 END AS has_live_key
     VALUES
       (@uid, @id_empresa, @test_key, 0,
        @name, @legal_name, @tax_id, @tax_system, @phone, @website, @support_email,
        @street, @exterior, @interior, @neighborhood, @zip, @city, @municipality, @state, @country,
        @created_at, @updated_at)`,
    {
      uid: input.uid,
      id_empresa: input.id_empresa,
      test_key: encryptedTestKey,
      name: input.name,
      legal_name: input.legal_name,
      tax_id: input.tax_id,
      tax_system: input.tax_system,
      phone: input.phone,
      website: input.website,
      support_email: input.support_email,
      street: input.street,
      exterior: input.exterior,
      interior: input.interior,
      neighborhood: input.neighborhood,
      zip: input.zip,
      city: input.city,
      municipality: input.municipality,
      state: input.state,
      country: input.country,
      created_at: now,
      updated_at: now,
    }
  );

  return normalizeOrganizationRow(rows[0]);
}

/**
 * Actualiza los datos legales/dirección de la copia local. Lanza si `uid` no existe
 * para `idEmpresa` (organización inexistente o de otro tenant).
 */
export async function updateOrganizationLegal(
  client: ITransactionClient,
  uid: string,
  idEmpresa: number,
  data: OrganizationLegalInput
): Promise<void> {
  const now = buildDate(new Date());

  const rows = await client.queryParams(
    `UPDATE ${SCHEMA_TABLE_ORGANIZATIONS}
        SET [name] = @name,
            [legal_name] = @legal_name,
            [tax_id] = @tax_id,
            [tax_system] = @tax_system,
            [phone] = @phone,
            [website] = @website,
            [support_email] = @support_email,
            [street] = @street,
            [exterior] = @exterior,
            [interior] = @interior,
            [neighborhood] = @neighborhood,
            [zip] = @zip,
            [city] = @city,
            [municipality] = @municipality,
            [state] = @state,
            [country] = @country,
            [updated_at] = @updated_at
      OUTPUT INSERTED.[id]
      WHERE [uid] = @uid AND [id_empresa] = @idEmpresa`,
    {
      uid,
      idEmpresa,
      name: data.name,
      legal_name: data.legal_name,
      tax_id: data.tax_id,
      tax_system: data.tax_system,
      phone: data.phone,
      website: data.website,
      support_email: data.support_email,
      street: data.street,
      exterior: data.exterior,
      interior: data.interior,
      neighborhood: data.neighborhood,
      zip: data.zip,
      city: data.city,
      municipality: data.municipality,
      state: data.state,
      country: data.country,
      updated_at: now,
    }
  );

  if (rows.length === 0) {
    throw new Error("La organización no existe o no pertenece a esta empresa");
  }
}

/** Cifra y guarda la clave de prueba. Devuelve el `first_12` para mostrar en pantalla, nunca la clave completa. */
export async function setTestKey(
  client: ITransactionClient,
  uid: string,
  idEmpresa: number,
  plainKey: string
): Promise<string> {
  const now = buildDate(new Date());
  const encrypted = encryptSecret(plainKey);

  const rows = await client.queryParams(
    `UPDATE ${SCHEMA_TABLE_ORGANIZATIONS}
        SET [test_key] = @test_key, [updated_at] = @updated_at
      OUTPUT INSERTED.[id]
      WHERE [uid] = @uid AND [id_empresa] = @idEmpresa`,
    { uid, idEmpresa, test_key: encrypted, updated_at: now }
  );

  if (rows.length === 0) {
    throw new Error("La organización no existe o no pertenece a esta empresa");
  }
  return plainKey.slice(0, 12);
}

/**
 * Cifra y guarda (o limpia, si `plainKey` es `null`) la clave live. Devuelve el
 * `first_12` de la nueva clave, o `null` si se limpió.
 */
export async function setLiveKey(
  client: ITransactionClient,
  uid: string,
  idEmpresa: number,
  plainKey: string | null
): Promise<string | null> {
  const now = buildDate(new Date());
  const encrypted = plainKey ? encryptSecret(plainKey) : null;

  const rows = await client.queryParams(
    `UPDATE ${SCHEMA_TABLE_ORGANIZATIONS}
        SET [live_key] = @live_key, [updated_at] = @updated_at
      OUTPUT INSERTED.[id]
      WHERE [uid] = @uid AND [id_empresa] = @idEmpresa`,
    { uid, idEmpresa, live_key: encrypted, updated_at: now }
  );

  if (rows.length === 0) {
    throw new Error("La organización no existe o no pertenece a esta empresa");
  }
  return plainKey ? plainKey.slice(0, 12) : null;
}

/**
 * Guarda el `id` del producto de Facturapi usado como concepto único al facturar
 * cobros desde la pestaña Por facturar (spec 34). `productId` puede ser `null`
 * para limpiar la configuración.
 */
export async function setDefaultProduct(
  client: ITransactionClient,
  uid: string,
  idEmpresa: number,
  productId: string | null
): Promise<void> {
  const now = buildDate(new Date());

  const rows = await client.queryParams(
    `UPDATE ${SCHEMA_TABLE_ORGANIZATIONS}
        SET [default_product_id] = @default_product_id, [updated_at] = @updated_at
      OUTPUT INSERTED.[id]
      WHERE [uid] = @uid AND [id_empresa] = @idEmpresa`,
    { uid, idEmpresa, default_product_id: productId, updated_at: now }
  );

  if (rows.length === 0) {
    throw new Error("La organización no existe o no pertenece a esta empresa");
  }
}

/**
 * Cambia el modo de operación (`is_live`). Se expone a través de `setOrgMode`
 * (spec 30), que valida las precondiciones (CSD + `live_key`) antes de llamar
 * a esta función — aquí solo se escribe la columna.
 */
export async function setLiveMode(
  client: ITransactionClient,
  uid: string,
  idEmpresa: number,
  isLive: boolean
): Promise<void> {
  const now = buildDate(new Date());

  const rows = await client.queryParams(
    `UPDATE ${SCHEMA_TABLE_ORGANIZATIONS}
        SET [is_live] = @is_live, [updated_at] = @updated_at
      OUTPUT INSERTED.[id]
      WHERE [uid] = @uid AND [id_empresa] = @idEmpresa`,
    { uid, idEmpresa, is_live: isLive, updated_at: now }
  );

  if (rows.length === 0) {
    throw new Error("La organización no existe o no pertenece a esta empresa");
  }
}

/**
 * Guarda los datos del emisor de nómina (spec 72). Solo escribe en local: no se mandan a
 * Facturapi. Lanza si `uid` no existe para `idEmpresa`. Los `CHECK` de la BD rechazan formatos inválidos.
 */
export async function updatePayrollIssuerData(
  client: ITransactionClient,
  uid: string,
  idEmpresa: number,
  input: PayrollIssuerInput
): Promise<void> {
  const now = buildDate(new Date());

  const rows = await client.queryParams(
    `UPDATE ${SCHEMA_TABLE_ORGANIZATIONS}
        SET [registro_patronal] = @registro_patronal,
            [riesgo_puesto] = @riesgo_puesto,
            [curp_emisor] = @curp_emisor,
            [updated_at] = @updated_at
      OUTPUT INSERTED.[id]
      WHERE [uid] = @uid AND [id_empresa] = @idEmpresa`,
    {
      uid,
      idEmpresa,
      registro_patronal: input.registro_patronal,
      riesgo_puesto: input.riesgo_puesto,
      curp_emisor: input.curp_emisor,
      updated_at: now,
    }
  );

  if (rows.length === 0) {
    throw new Error("La organización no existe o no pertenece a esta empresa");
  }
}

/**
 * Activa o desactiva la organización como emisora de nómina (spec 72). Al activar,
 * desactiva primero la que estuviera activa en la empresa (el índice filtrado
 * `UX_organizations_payroll_issuer` no admite dos a la vez). **Debe llamarse con el
 * cliente de una `db.transaction()`**: son dos `UPDATE` que deben ser atómicos, y el
 * llamador agrega ahí mismo su `writeAuditEntry`. Devuelve el `uid` de la organización
 * que se desactivó en automático, o `null`.
 */
export async function setPayrollIssuer(
  client: ITransactionClient,
  uid: string,
  idEmpresa: number,
  active: boolean
): Promise<{ deactivatedUid: string | null }> {
  const now = buildDate(new Date());
  let deactivatedUid: string | null = null;

  if (active) {
    const deactivatedRows = await client.queryParams(
      `UPDATE ${SCHEMA_TABLE_ORGANIZATIONS}
          SET [is_payroll_issuer] = 0, [updated_at] = @updated_at
        OUTPUT INSERTED.[uid]
        WHERE [id_empresa] = @idEmpresa AND [is_payroll_issuer] = 1 AND [uid] <> @uid`,
      { uid, idEmpresa, updated_at: now }
    );
    deactivatedUid = (deactivatedRows[0]?.uid as string | undefined) ?? null;
  }

  const rows = await client.queryParams(
    `UPDATE ${SCHEMA_TABLE_ORGANIZATIONS}
        SET [is_payroll_issuer] = @is_payroll_issuer, [updated_at] = @updated_at
      OUTPUT INSERTED.[id]
      WHERE [uid] = @uid AND [id_empresa] = @idEmpresa`,
    { uid, idEmpresa, is_payroll_issuer: active, updated_at: now }
  );

  if (rows.length === 0) {
    throw new Error("La organización no existe o no pertenece a esta empresa");
  }
  return { deactivatedUid };
}

/** `uid` de la organización que timbra la nómina de la empresa, o `null` si no hay (spec 72). */
export async function getPayrollIssuerUid(
  client: ITransactionClient,
  idEmpresa: number
): Promise<string | null> {
  const rows = await client.queryParams(
    `SELECT [uid] FROM ${SCHEMA_TABLE_ORGANIZATIONS}
      WHERE [id_empresa] = @idEmpresa AND [is_payroll_issuer] = 1`,
    { idEmpresa }
  );
  return (rows[0]?.uid as string | undefined) ?? null;
}

/**
 * Borra la fila local. Corrige el bug del proyecto original, que solo eliminaba la
 * organización en Facturapi y dejaba la fila local huérfana con ambas API keys.
 */
export async function deleteOrganizationByUid(
  client: ITransactionClient,
  uid: string,
  idEmpresa: number
): Promise<void> {
  const rows = await client.queryParams(
    `DELETE FROM ${SCHEMA_TABLE_ORGANIZATIONS}
      OUTPUT DELETED.[id]
      WHERE [uid] = @uid AND [id_empresa] = @idEmpresa`,
    { uid, idEmpresa }
  );

  if (rows.length === 0) {
    throw new Error("La organización no existe o no pertenece a esta empresa");
  }
}

/** Catálogo de acciones auditables (ampliado por los specs 29, 30 y 31). */
export type BillingAuditAction =
  | "org.create"
  | "org.update_legal"
  | "org.delete"
  | "cert.upload"
  | "cert.delete"
  | "key.renew_test"
  | "key.renew_live"
  | "key.revoke_live"
  | "customer.create"
  | "customer.update"
  | "product.create"
  | "product.update"
  | "mode.set_live"
  | "mode.set_test"
  | "invoice.create"
  | "invoice.cancel"
  | "invoice.email"
  | "invoice.pdf"
  | "org.upload_logo"
  | "org.update_customization"
  | "org.update_payroll_issuer"
  | "org.set_payroll_issuer";

export interface INewAuditEntry {
  id_empresa: number;
  id_user: number;
  action: BillingAuditAction;
  org_uid?: string | null;
  target_id?: string | null;
  mode?: FacturapiMode | null;
  /** Nunca debe contener claves ni la contraseña del CSD. */
  detail?: string | null;
}

/** Anexa un registro a la bitácora append-only. Nunca se lee desde ninguna UI todavía (spec 28). */
export async function writeAuditEntry(
  client: ITransactionClient,
  entry: INewAuditEntry
): Promise<void> {
  const now = buildDate(new Date());

  await client.queryParams(
    `INSERT INTO ${SCHEMA_TABLE_AUDIT_LOG}
       ([id_empresa], [id_user], [action], [org_uid], [target_id], [mode], [detail], [created_at])
     VALUES
       (@id_empresa, @id_user, @action, @org_uid, @target_id, @mode, @detail, @created_at)`,
    {
      id_empresa: entry.id_empresa,
      id_user: entry.id_user,
      action: entry.action,
      org_uid: entry.org_uid ?? null,
      target_id: entry.target_id ?? null,
      mode: entry.mode ?? null,
      detail: entry.detail ?? null,
      created_at: now,
    }
  );
}

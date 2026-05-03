"use server";

import db from "@/database/connection";
import { ICita } from "@/interfaces/cita";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";
import { IAuthUser } from "@/interfaces/auth";
import { toDBString, buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  type GCalEventRaw,
} from "@/lib/googleCalendar";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

export async function getCitas(): Promise<ICita[]> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;
  const data = await db.queryParams(
    `SELECT [id_cita]
           ,[id_paciente]
           ,[id_podologo]
           ,CONVERT(varchar(19), [fecha_inicio], 120) AS fecha_inicio
           ,CONVERT(varchar(19), [fecha_fin],    120) AS fecha_fin
           ,[estado]
           ,[motivo_cancelacion]
           ,CONVERT(varchar(19), [created_at],   120) AS created_at
           ,CONVERT(varchar(19), [deleted_at],   120) AS deleted_at
           ,[id_sucursal]
           ,[id_empresa]
           ,[google_event_id]
       FROM [CentroPodologico].[dbo].[citas]
      WHERE [id_sucursal] = @id_sucursal
        AND [id_empresa]  = @id_empresa`,
    { id_sucursal, id_empresa }
  );
  return data as ICita[];
}

export async function getPacientes(): Promise<IPaciente[]> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;
  const data = await db.queryParams(
    `SELECT [id_paciente]
           ,[nombre]
           ,[apellido_paterno]
           ,[apellido_materno]
           ,[telefono]
           ,CONVERT(varchar(10), [fecha_nacimiento], 120) AS fecha_nacimiento
           ,[direccion]
           ,[observaciones_generales]
           ,CONVERT(varchar(19), [created_at], 120) AS created_at
           ,CONVERT(varchar(19), [updated_at], 120) AS updated_at
           ,CONVERT(varchar(19), [deleted_at], 120) AS deleted_at
           ,[sexo]
           ,[whatsapp]
           ,[ciudad_preferida]
           ,[contacto_emergencia_nombre]
           ,[contacto_emergencia_whatsapp]
           ,[id_sucursal]
           ,[id_empresa]
       FROM [CentroPodologico].[dbo].[pacientes]
      WHERE [id_sucursal] = @id_sucursal
        AND [id_empresa]  = @id_empresa`,
    { id_sucursal, id_empresa }
  );
  return data as IPaciente[];
}

export async function getPodologos(): Promise<IUser[]> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;
  const data = await db.queryParams(
    `SELECT [id_user]
           ,[nombre]
           ,[email]
           ,[telefono]
           ,[password_hash]
           ,[id_role]
           ,[status]
           ,CONVERT(varchar(19), [created_at], 120) AS created_at
           ,CONVERT(varchar(19), [updated_at], 120) AS updated_at
           ,CONVERT(varchar(19), [deleted_at], 120) AS deleted_at
           ,[id_sucursal]
           ,[id_empresa]
       FROM [CentroPodologico].[dbo].[users]
      WHERE [id_sucursal] = @id_sucursal
        AND [id_empresa]  = @id_empresa`,
    { id_sucursal, id_empresa }
  );
  return data as IUser[];
}

export async function saveCita(
  form: ICita
): Promise<{ ok: boolean; message?: string }> {
  try {
    const {
      id_cita,
      id_paciente,
      id_podologo,
      fecha_inicio,
      fecha_fin,
      estado,
      motivo_cancelacion,
      created_at,
      deleted_at,
      id_sucursal,
      id_empresa,
      google_event_id,
    } = form;

    const commonParams = {
      id_paciente,
      id_podologo,
      fecha_inicio:       toDBString(String(fecha_inicio       ?? "")),
      fecha_fin:          toDBString(String(fecha_fin          ?? "")),
      estado,
      motivo_cancelacion,
      created_at:         toDBString(String(created_at ?? "")) ?? buildDate(new Date()),
      deleted_at:         toDBString(String(deleted_at          ?? "")),
      id_sucursal,
      id_empresa,
    };

    // --- Resolve names for the calendar event summary ---
    const [pacienteRows, podologoRows, sucursalRows] = await Promise.all([
      db.queryParams(
        `SELECT [nombre], [apellido_paterno], [whatsapp], [telefono] FROM [CentroPodologico].[dbo].[pacientes] WHERE [id_paciente] = @id_paciente`,
        { id_paciente }
      ),
      db.queryParams(
        `SELECT [nombre] FROM [CentroPodologico].[dbo].[users] WHERE [id_user] = @id_user`,
        { id_user: id_podologo }
      ),
      db.queryParams(
        `SELECT [nombre] FROM [CentroPodologico].[dbo].[sucursales] WHERE [id_sucursal] = @id_sucursal`,
        { id_sucursal }
      ),
    ]);
    const paciente = pacienteRows[0] as { nombre: string; apellido_paterno: string; whatsapp?: string; telefono?: string } | undefined;
    const podologo = podologoRows[0] as { nombre: string } | undefined;
    const sucursal = sucursalRows[0] as { nombre: string } | undefined;
    const summary = `Cita: ${paciente ? `${paciente.nombre} ${paciente.apellido_paterno}` : `Paciente #${id_paciente}`} con ${podologo ? podologo.nombre : `Podólogo #${id_podologo}`} — ${sucursal ? sucursal.nombre : `Sucursal #${id_sucursal}`}`;
    const telefono = paciente?.whatsapp || paciente?.telefono || "";
    const calEventData = {
      summary,
      description: telefono,
      startDateTime: String(commonParams.fecha_inicio ?? "").replace(" ", "T"),
      endDateTime:   String(commonParams.fecha_fin   ?? "").replace(" ", "T"),
      privateProperties: { id_sucursal: String(id_sucursal) },
    };

    if (id_cita === 0) {
      // If an external Google Calendar event is being imported, skip creating a new GCal event
      const isExternalImport = Boolean(google_event_id);

      const inserted = await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[citas]
           ([id_cita],[id_paciente],[id_podologo],[fecha_inicio],[fecha_fin],
            [estado],[motivo_cancelacion],[created_at],[deleted_at],[id_sucursal],[id_empresa])
         OUTPUT INSERTED.[id_cita]
         VALUES (
           (SELECT ISNULL(MAX([id_cita]),0)+1 FROM [CentroPodologico].[dbo].[citas]),
           @id_paciente,@id_podologo,@fecha_inicio,@fecha_fin,
           @estado,@motivo_cancelacion,@created_at,@deleted_at,@id_sucursal,@id_empresa
         )`,
        commonParams
      );
      const newId = (inserted[0] as { id_cita: number }).id_cita;

      try {
        let eventId: string;
        if (isExternalImport) {
          // External event already exists in GCal — just link it
          eventId = google_event_id!;
          await updateCalendarEvent(eventId, calEventData);
        } else {
          eventId = await createCalendarEvent(calEventData);
        }
        await db.queryParams(
          `UPDATE [CentroPodologico].[dbo].[citas] SET [google_event_id] = @eventId WHERE [id_cita] = @id_cita`,
          { eventId, id_cita: newId }
        );
      } catch (gcalErr) {
        console.error("[GoogleCalendar] Error al sincronizar evento:", gcalErr);
      }
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[citas] SET
           [id_paciente]        = @id_paciente,
           [id_podologo]        = @id_podologo,
           [fecha_inicio]       = @fecha_inicio,
           [fecha_fin]          = @fecha_fin,
           [estado]             = @estado,
           [motivo_cancelacion] = @motivo_cancelacion,
           [created_at]         = @created_at,
           [deleted_at]         = @deleted_at,
           [id_sucursal]        = @id_sucursal,
           [id_empresa]         = @id_empresa
         WHERE [id_cita] = @id_cita`,
        { id_cita, ...commonParams }
      );

      // Sync to Google Calendar (non-blocking)
      try {
        if (google_event_id && estado === "cancelada") {
          await deleteCalendarEvent(google_event_id);
          await db.queryParams(
            `UPDATE [CentroPodologico].[dbo].[citas] SET [google_event_id] = NULL WHERE [id_cita] = @id_cita`,
            { id_cita }
          );
        } else if (google_event_id) {
          await updateCalendarEvent(google_event_id, calEventData);
        } else if (estado !== "cancelada") {
          // Cita pre-integración sin event_id: crear el evento ahora
          const eventId = await createCalendarEvent(calEventData);
          await db.queryParams(
            `UPDATE [CentroPodologico].[dbo].[citas] SET [google_event_id] = @eventId WHERE [id_cita] = @id_cita`,
            { eventId, id_cita }
          );
        }
      } catch (gcalErr) {
        console.error("[GoogleCalendar] Error al sincronizar evento:", gcalErr);
      }
    }

    revalidatePath("/dashboard/citas");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar la cita" };
  }
}

export interface IExternalEvent {
  google_event_id: string;
  summary: string;
  description?: string;
  fecha_inicio: string;
  fecha_fin: string;
}

/**
 * Returns Google Calendar events in [timeMin, timeMax] that do NOT yet exist
 * as a row in the [citas] table for the current sucursal/empresa.
 * These are events created by external agents outside this system.
 */
export async function getExternalCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<IExternalEvent[]> {
  try {
    const cookieStore = await cookies();
    const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
    const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
    const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;

    const [gcalEvents, dbRows, sucursalRows] = await Promise.all([
      listCalendarEvents(timeMin, timeMax),
      db.queryParams(
        `SELECT [google_event_id] FROM [CentroPodologico].[dbo].[citas]
          WHERE [google_event_id] IS NOT NULL
            AND [id_empresa]  = @id_empresa`,
        { id_empresa }
      ),
      db.queryParams(
        `SELECT [id_sucursal], [nombre] FROM [CentroPodologico].[dbo].[sucursales]
          WHERE [id_empresa] = @id_empresa AND [activo] = 1`,
        { id_empresa }
      ),
    ]);

    const knownIds = new Set(
      (dbRows as { google_event_id: string }[]).map((r) => r.google_event_id)
    );

    const sucursales = sucursalRows as { id_sucursal: number; nombre: string }[];

    return (gcalEvents as GCalEventRaw[])
      .filter((e) => !knownIds.has(e.id))
      .filter((e) => {
        const eventSucursal = e.extendedPrivate?.id_sucursal;
        // Events with id_sucursal in extended properties → filter by exact match
        if (eventSucursal) return eventSucursal === String(id_sucursal);
        // Events without id_sucursal → check if the summary contains any known sucursal name
        const summary = e.summary ?? "";
        const matchedSucursal = sucursales.find((s) =>
          summary.includes(s.nombre)
        );
        // If the title references a specific sucursal, only show it to that one
        if (matchedSucursal) return matchedSucursal.id_sucursal === id_sucursal;
        // Truly external (no sucursal reference) → show to all sucursales
        return true;
      })
      .map((e) => ({
        google_event_id: e.id,
        summary:         e.summary,
        description:     e.description,
        fecha_inicio:    e.start,
        fecha_fin:       e.end,
      }));
  } catch {
    // Non-critical: if GCal is unreachable return empty list
    return [];
  }
}

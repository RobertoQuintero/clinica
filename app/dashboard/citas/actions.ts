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
           ,[id_tratamiento]
           ,[id_servicio_opcion]
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

export async function getServicioOpciones(): Promise<{ id_servicio_opcion: number; nombre: string }[]> {
  const data = await db.queryParams(
    `SELECT [id_servicio_opcion], [nombre]
       FROM [CentroPodologico].[dbo].[servicio_opciones]
      WHERE [id_servicio] = 2
        AND [status] = 1`,
    {}
  );
  return data as { id_servicio_opcion: number; nombre: string }[];
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
      id_tratamiento,
      id_consulta,
      id_servicio_opcion,
    } = form;

    const commonParams: any = {
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

    // Optional INT fields — bind only when present so null goes as literal NULL in SQL
    const sqlIdTratamiento    = id_tratamiento    != null ? "@id_tratamiento"    : "NULL";
    const sqlIdConsulta       = id_consulta       != null ? "@id_consulta"       : "NULL";
    const sqlIdServicioOpcion = id_servicio_opcion != null ? "@id_servicio_opcion" : "NULL";
    if (id_tratamiento    != null) commonParams.id_tratamiento    = id_tratamiento;
    if (id_consulta       != null) commonParams.id_consulta       = id_consulta;
    if (id_servicio_opcion != null) commonParams.id_servicio_opcion = id_servicio_opcion;

    // --- Resolve names for the calendar event summary ---
    const [pacienteRows, sucursalRows, servicioRows] = await Promise.all([
      db.queryParams(
        `SELECT p.[nombre], p.[apellido_paterno], p.[whatsapp], p.[telefono], pc.[codigo] AS phone_code
         FROM [CentroPodologico].[dbo].[pacientes] p
         LEFT JOIN [CentroPodologico].[dbo].[codigos_telefonicos] pc ON pc.[id_phone_code] = p.[id_phone_code]
         WHERE p.[id_paciente] = @id_paciente`,
        { id_paciente }
      ),
      db.queryParams(
        `SELECT [nombre], [id_calendar] FROM [CentroPodologico].[dbo].[sucursales] WHERE [id_sucursal] = @id_sucursal`,
        { id_sucursal }
      ),
      id_servicio_opcion != null
        ? db.queryParams(
            `SELECT [nombre] FROM [CentroPodologico].[dbo].[servicio_opciones] WHERE [id_servicio_opcion] = @id_servicio_opcion`,
            { id_servicio_opcion }
          )
        : Promise.resolve([]),
    ]);
    const paciente = pacienteRows[0] as { nombre: string; apellido_paterno: string; whatsapp?: string; telefono?: string; phone_code?: string } | undefined;
    const sucursal = sucursalRows[0] as { nombre: string; id_calendar: string | null } | undefined;
    const servicio = (servicioRows[0] as { nombre: string } | undefined)?.nombre ?? null;
    const calId    = sucursal?.id_calendar ?? undefined;
    const pacienteNombre = paciente ? `${paciente.nombre} ${paciente.apellido_paterno}` : `Paciente #${id_paciente}`;
    const summary = servicio
      ? `${servicio} — ${pacienteNombre}  · ${sucursal ? sucursal.nombre : `Sucursal #${id_sucursal}`}`
      : `Cita: ${pacienteNombre}  — ${sucursal ? sucursal.nombre : `Sucursal #${id_sucursal}`}`;
    const rawTelefono = paciente?.whatsapp || paciente?.telefono || "";
    const telefono = rawTelefono
      ? paciente?.phone_code ? `${paciente.phone_code}${rawTelefono}` : rawTelefono
      : "";

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

      const insertQuery = `INSERT INTO [CentroPodologico].[dbo].[citas]
             ([id_cita],[id_paciente],[id_podologo],[fecha_inicio],[fecha_fin],
              [estado],[motivo_cancelacion],[created_at],[deleted_at],[id_sucursal],[id_empresa],[id_tratamiento],[id_consulta],[id_servicio_opcion])
           OUTPUT INSERTED.[id_cita]
           VALUES (
             (SELECT ISNULL(MAX([id_cita]),0)+1 FROM [CentroPodologico].[dbo].[citas]),
             @id_paciente,@id_podologo,@fecha_inicio,@fecha_fin,
             @estado,@motivo_cancelacion,@created_at,@deleted_at,@id_sucursal,@id_empresa,${sqlIdTratamiento},${sqlIdConsulta},${sqlIdServicioOpcion}
           )`;

      const inserted = await db.queryParams(insertQuery, commonParams);
      const newId = (inserted[0] as { id_cita: number }).id_cita;

      try {
        let eventId: string;
        if (isExternalImport) {
          // External event already exists in GCal — just link it
          eventId = google_event_id!;
          await updateCalendarEvent(eventId, calEventData, calId);
        } else {
          eventId = await createCalendarEvent(calEventData, calId);
        }
        await db.queryParams(
          `UPDATE [CentroPodologico].[dbo].[citas] SET [google_event_id] = @eventId WHERE [id_cita] = @id_cita`,
          { eventId, id_cita: newId }
        );
      } catch (gcalErr) {
        console.error("[GoogleCalendar] Error al sincronizar evento:", gcalErr);
      }
    } else {
      const updateQuery = `UPDATE [CentroPodologico].[dbo].[citas] SET
             [id_paciente]        = @id_paciente,
             [id_podologo]        = @id_podologo,
             [fecha_inicio]       = @fecha_inicio,
             [fecha_fin]          = @fecha_fin,
             [estado]             = @estado,
             [motivo_cancelacion] = @motivo_cancelacion,
             [created_at]         = @created_at,
             [deleted_at]         = @deleted_at,
             [id_sucursal]        = @id_sucursal,
             [id_empresa]         = @id_empresa,
             [id_tratamiento]     = ${sqlIdTratamiento},
             [id_consulta]        = ${sqlIdConsulta},
             [id_servicio_opcion] = ${sqlIdServicioOpcion}
           WHERE [id_cita] = @id_cita`;

      await db.queryParams(updateQuery, { id_cita, ...commonParams });

      // Sync to Google Calendar (non-blocking)
      try {
        if (google_event_id && estado === "cancelada") {
          await deleteCalendarEvent(google_event_id, calId);
          await db.queryParams(
            `UPDATE [CentroPodologico].[dbo].[citas] SET [google_event_id] = NULL WHERE [id_cita] = @id_cita`,
            { id_cita }
          );
        } else if (google_event_id) {
          await updateCalendarEvent(google_event_id, calEventData, calId);
        } else if (estado !== "cancelada") {
          // Cita pre-integración sin event_id: crear el evento ahora
          const eventId = await createCalendarEvent(calEventData, calId);
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
  } catch(error) {
    console.log({error})
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

    const [dbRows, sucursalRows] = await Promise.all([
      db.queryParams(
        `SELECT [google_event_id] FROM [CentroPodologico].[dbo].[citas]
          WHERE [google_event_id] IS NOT NULL
            AND [id_empresa]  = @id_empresa`,
        { id_empresa }
      ),
      db.queryParams(
        `SELECT [id_sucursal], [nombre], [id_calendar] FROM [CentroPodologico].[dbo].[sucursales]
          WHERE [id_empresa] = @id_empresa AND [activo] = 1`,
        { id_empresa }
      ),
    ]);

    const sucursales = sucursalRows as { id_sucursal: number; nombre: string; id_calendar: string | null }[];
    const selectedSucursal = sucursales.find((s) => s.id_sucursal === id_sucursal);
    const sucursalCalId = selectedSucursal?.id_calendar ?? undefined;

    // Fetch calendar events using the selected sucursal's own calendar
    if (!sucursalCalId) return [];
    const calEvents = await listCalendarEvents(timeMin, timeMax, sucursalCalId);

    const knownIds = new Set(
      (dbRows as { google_event_id: string }[]).map((r) => r.google_event_id)
    );

    return (calEvents as GCalEventRaw[])
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

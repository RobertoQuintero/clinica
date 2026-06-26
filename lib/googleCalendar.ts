import { google } from "googleapis";
import { createPrivateKey } from "crypto";
import { importPKCS8, SignJWT } from "jose";

export interface CalendarEventData {
  summary: string;
  description?: string;
  startDateTime: string; // "YYYY-MM-DDTHH:mm:ss"
  endDateTime: string;   // "YYYY-MM-DDTHH:mm:ss"
  /** Private extended properties stored on the GCal event (invisible to end users). */
  privateProperties?: Record<string, string>;
}

/**
 * Obtains a Google OAuth2 access token using a service account JWT.
 * Uses `jose` (Web Crypto) instead of google-auth-library's jws signer,
 * which avoids the ERR_OSSL_UNSUPPORTED error in Node.js 18+ (OpenSSL 3).
 */
async function getAccessToken(email: string, rawKey: string): Promise<string> {
  // Normalize: strip surrounding quotes Railway may add, convert \n sequences
  let pem = rawKey.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");

  // Convert PKCS#1 → PKCS#8 so jose's importPKCS8 can parse it
  pem = createPrivateKey({ key: pem, format: "pem" })
    .export({ type: "pkcs8", format: "pem" }) as string;

  const privateKey = await importPKCS8(pem, "RS256");
  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/calendar.events",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google OAuth2 token error ${res.status}: ${body}`);
  }

  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new Error("Google OAuth2: no access_token in response");
  return access_token;
}

export async function getCalendarClient(calendarId?: string) {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const calId  = calendarId ?? process.env.GOOGLE_CALENDAR_ID;

  if (!email || !rawKey || !calId) {
    throw new Error(
      "Google Calendar: faltan variables de entorno (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID)"
    );
  }

  const accessToken = await getAccessToken(email, rawKey);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return { calendar: google.calendar({ version: "v3", auth }), calId };
}

/** Creates a new event and returns the Google event ID. */
export async function createCalendarEvent(data: CalendarEventData, calendarId?: string): Promise<string> {
  const { calendar, calId } = await getCalendarClient(calendarId);
  console.log({ calendar, calId })
  const res = await calendar.events.insert({
    calendarId: calId,
    requestBody: {
      summary: data.summary,
      description: data.description,
      start: { dateTime: data.startDateTime, timeZone: "America/Mexico_City" },
      end:   { dateTime: data.endDateTime,   timeZone: "America/Mexico_City" },
      ...(data.privateProperties &&
        Object.keys(data.privateProperties).length > 0 && {
          extendedProperties: { private: data.privateProperties },
        }),
    },
  });

  const eventId = res.data.id;
  if (!eventId) throw new Error("Google Calendar: no se recibió ID del evento creado");
  return eventId;
}

/** Updates an existing event by its Google event ID. */
export async function updateCalendarEvent(
  eventId: string,
  data: CalendarEventData,
  calendarId?: string
): Promise<void> {
  const { calendar, calId } = await getCalendarClient(calendarId);

  await calendar.events.patch({
    calendarId: calId,
    eventId,
    requestBody: {
      summary: data.summary,
      description: data.description,
      start: { dateTime: data.startDateTime, timeZone: "America/Mexico_City" },
      end:   { dateTime: data.endDateTime,   timeZone: "America/Mexico_City" },
      ...(data.privateProperties &&
        Object.keys(data.privateProperties).length > 0 && {
          extendedProperties: { private: data.privateProperties },
        }),
    },
  });
}

/** Deletes an event from Google Calendar by its event ID. */
export async function deleteCalendarEvent(eventId: string, calendarId?: string): Promise<void> {
  const { calendar, calId } = await getCalendarClient(calendarId);

  await calendar.events.delete({
    calendarId: calId,
    eventId,
  });
}

export interface GCalEventRaw {
  id: string;
  summary: string;
  description?: string;
  start: string; // "YYYY-MM-DDTHH:mm:ss"
  end: string;   // "YYYY-MM-DDTHH:mm:ss"
  /** Private extended properties attached to the event (e.g. { id_sucursal: "1" }). */
  extendedPrivate?: Record<string, string>;
}

/** Lists events in a time range across all configured calendars. Returns normalised flat objects.
 *
 * Primary calendar: GOOGLE_CALENDAR_ID
 * Extra calendars:  GOOGLE_EXTRA_CALENDAR_IDS (comma-separated calendar IDs)
 *
 * Results are deduplicated by event ID in case the same event appears in more than one calendar.
 */
export async function listCalendarEvents(
  timeMin: string,
  timeMax: string,
  calendarId?: string
): Promise<GCalEventRaw[]> {
  const { calendar, calId } = await getCalendarClient(calendarId);

  // Build the full list of calendar IDs to query
  const extraIds = (process.env.GOOGLE_EXTRA_CALENDAR_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allCalIds = Array.from(new Set([calId, ...extraIds]));

  // Fetch from all calendars in parallel; ignore individual failures
  const settled = await Promise.allSettled(
    allCalIds.map((id) =>
      calendar.events.list({
        calendarId: id,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 500,
      })
    )
  );

  const seen = new Set<string>();
  const events: GCalEventRaw[] = [];

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const e of result.value.data.items ?? []) {
      if (!e.id || !(e.start?.dateTime || e.start?.date)) continue;
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      events.push({
        id: e.id,
        summary: e.summary ?? "(sin título)",
        description: e.description ?? undefined,
        start: (e.start?.dateTime ?? e.start?.date ?? "").replace(/([+-]\d{2}:\d{2}|Z)$/, ""),
        end:   (e.end?.dateTime   ?? e.end?.date   ?? "").replace(/([+-]\d{2}:\d{2}|Z)$/, ""),
        extendedPrivate: (e.extendedProperties?.private as Record<string, string> | undefined) ?? undefined,
      });
    }
  }

  return events;
}

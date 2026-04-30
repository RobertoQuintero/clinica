import { google } from "googleapis";

export interface CalendarEventData {
  summary: string;
  description?: string;
  startDateTime: string; // "YYYY-MM-DDTHH:mm:ss"
  endDateTime: string;   // "YYYY-MM-DDTHH:mm:ss"
}

function getCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const calId = process.env.GOOGLE_CALENDAR_ID;

  if (!email || !key || !calId) {
    throw new Error(
      "Google Calendar: faltan variables de entorno (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID)"
    );
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  return { calendar: google.calendar({ version: "v3", auth }), calId };
}

/** Creates a new event and returns the Google event ID. */
export async function createCalendarEvent(data: CalendarEventData): Promise<string> {
  const { calendar, calId } = getCalendarClient();

  const res = await calendar.events.insert({
    calendarId: calId,
    requestBody: {
      summary: data.summary,
      description: data.description,
      start: { dateTime: data.startDateTime, timeZone: "America/Mexico_City" },
      end:   { dateTime: data.endDateTime,   timeZone: "America/Mexico_City" },
    },
  });

  const eventId = res.data.id;
  if (!eventId) throw new Error("Google Calendar: no se recibió ID del evento creado");
  return eventId;
}

/** Updates an existing event by its Google event ID. */
export async function updateCalendarEvent(
  eventId: string,
  data: CalendarEventData
): Promise<void> {
  const { calendar, calId } = getCalendarClient();

  await calendar.events.patch({
    calendarId: calId,
    eventId,
    requestBody: {
      summary: data.summary,
      description: data.description,
      start: { dateTime: data.startDateTime, timeZone: "America/Mexico_City" },
      end:   { dateTime: data.endDateTime,   timeZone: "America/Mexico_City" },
    },
  });
}

/** Deletes an event from Google Calendar by its event ID. */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const { calendar, calId } = getCalendarClient();

  await calendar.events.delete({
    calendarId: calId,
    eventId,
  });
}

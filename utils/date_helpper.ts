// Clinic timezone — used for all wall-clock date/time helpers so the
// app behaves correctly even when hosted on a UTC server (e.g. Railway).
const CLINIC_TZ = 'America/Mexico_City';

export const addZeroToday = (today: Date): string => {
  // toLocaleDateString with 'en-CA' returns "YYYY-MM-DD" in the clinic timezone.
  return today.toLocaleDateString('en-CA', { timeZone: CLINIC_TZ });
};

export const buildDate = (date: Date): string => {
  const d = date.toLocaleDateString('en-CA', { timeZone: CLINIC_TZ });         // "YYYY-MM-DD"
  const t = date.toLocaleTimeString('en-GB', { timeZone: CLINIC_TZ, hour12: false }); // "HH:mm:ss"
  return `${d} ${t}`;
}

export const buildDateReverse=(date:string)=>{
  if(date===null || date==='') return ''
  const day = date?.split('T')[0]
  const hour=date?.split('T')[1]?.split('.')[0]
  return `${day} ${hour}`
}

 export const dayFirst=(date:string| null)=>{
  if(date===null) return ''
  return addZeroToday(new Date(buildDateReverse(date as string))).split('-').reverse().join('/')
 }

// Converts datetime-local format ("YYYY-MM-DDTHH:mm") or DB format ("YYYY-MM-DD HH:mm:ss")
// to SQL Server safe format ("YYYY-MM-DD HH:mm:ss"). Returns null for empty values.
export const toDBString = (val: string | null | undefined): string | null => {
  if (!val) return null;
  const s = val.replace('T', ' ').slice(0, 19);
  return s.length === 16 ? s + ':00' : s;
};

// Converts DB string ("YYYY-MM-DD HH:mm:ss") or ISO string to datetime-local input value ("YYYY-MM-DDTHH:mm")
export const toDateTimeLocal = (val: string): string => {
  if (!val) return '';
  return val.replace(' ', 'T').slice(0, 16);
};
export const fmtDatetime = (val: Date | string) => {
  if (!val) return "—";
  return new Date(String(val).replace(" ", "T"))
    .toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

export const fmtDate = (val: Date | string) => {
  if (!val) return "—";
  const s = String(val).replace(" ", "T");
  return new Date(s.includes("T") ? s : s + "T00:00:00")
    .toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "2-digit" });
};

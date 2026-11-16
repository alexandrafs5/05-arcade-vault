// Display helpers shared by boards and lists (es-ES).

export const fmtNumber = (n: number) => n.toLocaleString("es-ES");

// DD/MM/YYYY. Fixed to UTC so server and browser render the same day.
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

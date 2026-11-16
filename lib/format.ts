// Display helpers shared by boards and lists (es-ES).

export const fmtNumber = (n: number) => n.toLocaleString("es-ES");

// "hace N min / h / d" for the home recent list.
export function fmtTimeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(
    1,
    Math.floor((now - new Date(iso).getTime()) / 60000),
  );
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

// DD/MM/YYYY. Fixed to UTC so server and browser render the same day.
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

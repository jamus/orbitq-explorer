export function formatShortDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

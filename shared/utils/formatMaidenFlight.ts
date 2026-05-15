const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Formats a maidenFlight string ("YYYY-MM-DD" or "YYYY") into a human-readable
// label. Returns the raw string unchanged if it cannot be parsed.
export function formatMaidenFlight(maidenFlight: string): string {
  const parts = maidenFlight.split("-");
  const year = parseInt(parts[0], 10);
  if (isNaN(year)) return maidenFlight;

  const month = parts[1] ? parseInt(parts[1], 10) : null;
  const day = parts[2] ? parseInt(parts[2], 10) : null;

  if (month !== null && !isNaN(month) && day !== null && !isNaN(day)) {
    return `${day} ${MONTHS[month - 1]} ${year}`;
  }
  if (month !== null && !isNaN(month)) {
    return `${MONTHS[month - 1]} ${year}`;
  }
  return String(year);
}

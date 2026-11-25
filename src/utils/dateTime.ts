const utcWithoutOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/i;

export function formatApiTime(value: string | null | undefined, options: Intl.DateTimeFormatOptions, timezone?: string) {
  if (!value) return "—";
  const date = new Date(utcWithoutOffset.test(value) ? value + "Z" : value);
  if (!Number.isFinite(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("es-MX", { ...options, timeZone: timezone }).format(date);
  } catch (error) {
    if (!(error instanceof RangeError) || !timezone) throw error;
    return new Intl.DateTimeFormat("es-MX", options).format(date);
  }
}

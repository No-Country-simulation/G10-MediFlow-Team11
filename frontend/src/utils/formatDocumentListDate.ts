export function formatDocumentListDate(iso: string): string {
  const date = new Date(iso);
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  const dateParts = new Intl.DateTimeFormat("es-CO", {
    ...dateOptions,
  }).formatToParts(date);
  const timeParts = new Intl.DateTimeFormat("es-CO", {
    ...timeOptions,
  }).formatToParts(date);
  const partValue = (
    parts: Intl.DateTimeFormatPart[],
    type: Intl.DateTimeFormatPartTypes,
  ): string | undefined => {
    return parts.find((part) => part.type === type)?.value;
  };
  const day = partValue(dateParts, "day");
  const month = partValue(dateParts, "month");
  const year = partValue(dateParts, "year");
  const hour = partValue(timeParts, "hour");
  const minute = partValue(timeParts, "minute");
  const rawDayPeriod = partValue(timeParts, "dayPeriod");

  if (
    day === undefined ||
    month === undefined ||
    year === undefined ||
    hour === undefined ||
    minute === undefined ||
    rawDayPeriod === undefined
  ) {
    return date.toLocaleString("es-CO", { ...dateOptions, ...timeOptions });
  }

  const dayPeriod = rawDayPeriod.replace(/[\u00a0\u202f]/g, " ");

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

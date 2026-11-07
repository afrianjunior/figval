const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const parts = (timestamp: number) => {
  const date = new Date(timestamp);
  return {
    day: date.getUTCDate(),
    month: MONTHS[date.getUTCMonth()] ?? 'January',
    year: date.getUTCFullYear(),
  };
};

/** "7 November 2026". Dates are read in UTC so output never depends on the machine. */
export const formatLongDate = (timestamp: number): string => {
  const { day, month, year } = parts(timestamp);
  return `${day} ${month} ${year}`;
};

/** "Nov 7". */
export const formatShortDate = (timestamp: number): string => {
  const { day, month } = parts(timestamp);
  return `${month.slice(0, 3)} ${day}`;
};

/** "<host> · <Mon D>" */
export const defaultSessionName = (host: string, timestamp: number): string =>
  `${host} · ${formatShortDate(timestamp)}`;

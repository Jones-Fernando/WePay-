function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  );
}

export function parseCurrencyInput(value: string): number {
  const input = value.replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!input) return Number.NaN;

  const commaIndex = input.lastIndexOf(",");
  const dotIndex = input.lastIndexOf(".");
  let normalized = input;

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const groupSeparator = decimalSeparator === "," ? "." : ",";
    const parts = input.split(decimalSeparator);
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) {
      return Number.NaN;
    }
    const groupingPattern = new RegExp(
      `^\\d{1,3}(?:\\${groupSeparator}\\d{3})+$`
    );
    if (!/^\d+$/.test(parts[0]) && !groupingPattern.test(parts[0])) {
      return Number.NaN;
    }
    normalized = `${parts[0].replace(new RegExp(`\\${groupSeparator}`, "g"), "")}.${parts[1]}`;
  } else if (commaIndex >= 0) {
    if (!/^-?\d+(?:,\d{1,2})?$/.test(input)) return Number.NaN;
    normalized = input.replace(",", ".");
  } else if (dotIndex >= 0) {
    const groupingPattern = /^-?\d{1,3}(?:\.\d{3})+$/;
    if (groupingPattern.test(input)) {
      normalized = input.replace(/\./g, "");
    } else if (!/^-?\d+(?:\.\d{1,2})?$/.test(input)) {
      return Number.NaN;
    }
  } else if (!/^-?\d+$/.test(input)) {
    return Number.NaN;
  }

  return Number(normalized);
}

export function parseDateInputToIso(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return isValidCalendarDate(Number(year), Number(month), Number(day))
      ? `${year}-${month}-${day}`
      : null;
  }

  const brazilian = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!brazilian) return null;
  const [, day, month, year] = brazilian;
  if (!isValidCalendarDate(Number(year), Number(month), Number(day))) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

export function formatDateForInput(value: Date): string {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${value.getFullYear()}`;
}

export function parseDateInputToDate(value: string): Date | null {
  const iso = parseDateInputToIso(value);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function normalizeDateInput(value: string): string {
  const iso = parseDateInputToIso(value);
  if (!iso) return value;
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function formatDateForDisplay(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseDateInputToDate(value)
    : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

export function formatDateTimeForDisplay(
  value: string,
  options: {
    yearFormat?: "numeric" | "2-digit";
    separator?: string;
    invalidValue?: string;
  } = {},
): string {
  const {
    yearFormat = "numeric",
    separator = " às ",
    invalidValue = value,
  } = options;
  const match = value.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (!match) return invalidValue;

  const [, yearText, month, day, hour, minute, second = "0", timezone] = match;
  if (
    !isValidCalendarDate(Number(yearText), Number(month), Number(day))
    || Number(hour) > 23
    || Number(minute) > 59
    || Number(second) > 59
  ) {
    return invalidValue;
  }

  if (!timezone) {
    const displayedYear = yearFormat === "2-digit"
      ? yearText.slice(-2)
      : yearText;
    return `${day}/${month}/${displayedYear}${separator}${hour}:${minute}`;
  }

  const timestamp = value.trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return invalidValue;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: yearFormat,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date).replace(", ", separator);
}

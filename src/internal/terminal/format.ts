export const humanFileSize = (bytes: number): string => {
  const absoluteBytes = Math.abs(bytes);

  if (absoluteBytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unitIndex = -1;

  do {
    value /= 1024;
    unitIndex += 1;
  } while (Math.abs(value) >= 1024 && unitIndex < units.length - 1);

  const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
};

export const truncate = (value: string, maxWidth: number): string => {
  if (maxWidth <= 0) {
    return "";
  }

  if (value.length <= maxWidth) {
    return value;
  }

  if (maxWidth <= 1) {
    return "…";
  }

  return `${value.slice(0, maxWidth - 1)}…`;
};

export const formatPercent = (value: number | null | undefined): string =>
  typeof value === "number" ? `${Math.round(value)}%` : "—";

export const formatNullable = (value: string | null | undefined): string =>
  value && value.length > 0 ? value : "—";

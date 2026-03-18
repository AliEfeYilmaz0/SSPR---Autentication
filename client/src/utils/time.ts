export const parseDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatTimeRemaining = (target?: Date | null) => {
  if (!target) return "--:--";
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "00:00";
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

export const toLocaleTime = (value?: Date | null) => {
  if (!value) return "--";
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

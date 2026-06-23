export function formatEngineVolumeFromCc(rawValue: string | number | null | undefined) {
  const cc =
    typeof rawValue === "number"
      ? rawValue
      : Number.parseInt(String(rawValue ?? "").replace(/\s/g, ""), 10);

  if (!Number.isFinite(cc) || cc <= 0) {
    return "";
  }

  const liters = Math.round((cc / 1000) * 10) / 10;
  const formatted = liters.toLocaleString("sk-SK", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return `${formatted} l`;
}

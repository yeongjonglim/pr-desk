const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "";
  const ms = Math.max(0, now - Date.parse(iso));
  if (ms < MIN) return "now";
  if (ms < HOUR) return `${Math.floor(ms / MIN)}m`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`;
  if (ms < 60 * DAY) return `${Math.floor(ms / DAY)}d`;
  return `${Math.floor(ms / (30 * DAY))}mo`;
}

export function agoLong(iso: string | null, now = Date.now()): string {
  if (!iso) return "";
  const ms = Math.max(0, now - Date.parse(iso));
  if (ms < MIN) return "just now";
  if (ms < HOUR) return plural(Math.floor(ms / MIN), "minute");
  if (ms < DAY) return plural(Math.floor(ms / HOUR), "hour");
  return plural(Math.floor(ms / DAY), "day");
}

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

export function days(iso: string | null, now = Date.now()): number {
  return iso ? (now - Date.parse(iso)) / DAY : 0;
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

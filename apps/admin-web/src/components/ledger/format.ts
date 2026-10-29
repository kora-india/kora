import { roleLabel } from "@/lib/activity-labels";

/** "29 Oct 2026" and "3:45 pm" in the school's time zone. */
export function dateTimeParts(iso: string, timeZone: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-IN", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

/** "Priya Sharma · Accountant", or "System" for automatic jobs. */
export function personLabel(person: { name: string; role: string } | null) {
  if (!person) return "";
  const role = roleLabel(person.role);
  return person.name === role ? role : `${person.name} · ${role}`;
}

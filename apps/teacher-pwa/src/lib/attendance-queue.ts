/**
 * Attendance saves waiting on this phone (U8). A save that can't reach the
 * server (offline, a network error or a server error) is kept here and sent
 * when the app is back online, so a teacher's marks are never lost. Saves the
 * server rejects (wrong section, future date) are not kept: retrying won't
 * help, and the teacher is told why.
 */

export interface AttendancePayload {
  classId: string;
  sectionId: string;
  date: string;
  records: { studentId: string; status: string }[];
}

export interface QueuedAttendance extends AttendancePayload {
  /** "Grade 6 – A · 21 Oct", for messages. */
  label: string;
  queuedAt: number;
}

export type SendResult =
  | { ok: true }
  | { ok: false; retry: boolean; error: string };

const KEY = "kora:attendance-queue";
export const QUEUE_EVENT = "kora:attendance-queue";

const sameSave = (a: AttendancePayload, b: AttendancePayload) =>
  a.classId === b.classId && a.sectionId === b.sectionId && a.date === b.date;

export function readQueue(): QueuedAttendance[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedAttendance[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedAttendance[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // Storage full or blocked; nothing more we can do on this device.
  }
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

/** Keeps a save for later; a newer save for the same section and day wins. */
export function enqueue(entry: QueuedAttendance) {
  writeQueue([...readQueue().filter((q) => !sameSave(q, entry)), entry]);
}

export function findQueued(payload: Omit<AttendancePayload, "records">) {
  return readQueue().find((q) => sameSave(q, { ...payload, records: [] }));
}

export async function sendAttendance(
  payload: AttendancePayload,
): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, retry: true, error: "No connection" };
  }
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  const error = body.error || `Server error (${res.status})`;
  // Signed out (401) or a server fault (5xx) can succeed later; a rejected
  // save (other 4xx) won't.
  const retry = res.status === 401 || res.status >= 500;
  return { ok: false, retry, error };
}

/** Sends every waiting save; returns what was sent and what was refused. */
export async function flushQueue() {
  const sent: string[] = [];
  const refused: { label: string; error: string }[] = [];
  for (const entry of readQueue()) {
    const { label, queuedAt, ...payload } = entry;
    const result = await sendAttendance(payload);
    if (result.ok) sent.push(label);
    else if (!result.retry) refused.push({ label, error: result.error });
    else continue;
    writeQueue(readQueue().filter((q) => !sameSave(q, entry)));
  }
  return { sent, refused };
}

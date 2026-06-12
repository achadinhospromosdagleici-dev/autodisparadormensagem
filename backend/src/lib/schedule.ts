export function isWithinSchedule(weekDays?: number[], startTime?: string, endTime?: string): boolean {
  if (!weekDays?.length && !startTime && !endTime) return true;

  const now = new Date();
  const weekday = now.getDay();

  if (weekDays?.length && !weekDays.includes(weekday)) return false;

  if (startTime || endTime) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    const cur = hour * 60 + minute;

    if (startTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      if (cur < sh * 60 + sm) return false;
    }
    if (endTime) {
      const [eh, em] = endTime.split(':').map(Number);
      if (cur > eh * 60 + em) return false;
    }
  }

  return true;
}

export function msUntilNextSlot(weekDays?: number[], startTime?: string, endTime?: string): number {
  if (!startTime && !weekDays?.length) return 0;

  const now = new Date();
  const weekday = now.getDay();

  for (let i = 1; i <= 60 * 24 * 7; i++) {
    const t = new Date(now.getTime() + i * 60000);
    const wd = t.getDay();
    const h = t.getHours();
    const m = t.getMinutes();
    const cur = h * 60 + m;

    if (weekDays?.length && !weekDays.includes(wd)) continue;

    if (startTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      if (cur < sh * 60 + sm) continue;
    }
    if (endTime) {
      const [eh, em] = endTime.split(':').map(Number);
      if (cur > eh * 60 + em) continue;
    }

    return i * 60000;
  }

  return 0;
}

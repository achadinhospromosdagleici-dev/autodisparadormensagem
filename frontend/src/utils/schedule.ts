export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function randomDelay(minSec: number, maxSec: number) {
  const min = Math.min(minSec, maxSec);
  const max = Math.max(minSec, maxSec);
  return (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
}

function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = wdMap[get('weekday')] ?? 0;
  return { hour, minute, weekday };
}

function parseHM(s?: string): { h: number; m: number } | null {
  if (!s) return null;
  const [h, m] = s.split(':').map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}

export function msUntilAllowed(
  now: Date,
  opts: { horaIni?: string; horaFim?: string; diasSemana?: number[]; timezone: string },
) {
  const ini = parseHM(opts.horaIni);
  const fim = parseHM(opts.horaFim);
  const dias = opts.diasSemana && opts.diasSemana.length > 0 ? opts.diasSemana : null;
  if (!ini && !fim && !dias) return 0;

  for (let i = 0; i < 60 * 24 * 8; i++) {
    const t = new Date(now.getTime() + i * 60_000);
    const { hour, minute, weekday } = zonedParts(t, opts.timezone);
    const dayOk = !dias || dias.includes(weekday);
    let timeOk = true;
    if (ini && fim) {
      const cur = hour * 60 + minute;
      const a = ini.h * 60 + ini.m;
      const b = fim.h * 60 + fim.m;
      timeOk = a <= b ? cur >= a && cur <= b : cur >= a || cur <= b;
    } else if (ini) {
      timeOk = hour * 60 + minute >= ini.h * 60 + ini.m;
    } else if (fim) {
      timeOk = hour * 60 + minute <= fim.h * 60 + fim.m;
    }
    if (dayOk && timeOk) return i * 60_000;
  }
  return 0;
}

export async function sleepCapped(ms: number, capMs = 6 * 60 * 60 * 1000) {
  const total = Math.min(ms, capMs);
  const step = 30_000;
  let left = total;
  while (left > 0) {
    const s = Math.min(step, left);
    await sleep(s);
    left -= s;
  }
}

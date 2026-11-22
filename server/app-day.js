// "Today" for counters and defaults follows a real timezone, not UTC.
//
// The server clock is UTC, so "today" began at 6 pm Central: the Passed today /
// Failed today counters reset in the middle of the afternoon shift and counted
// yesterday evening's work as today's. APP_TIMEZONE (an IANA name) sets the
// zone; default US Central.
const DEFAULT_ZONE = 'America/Chicago';

function parts(now, timeZone) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** The instant today began in the app's timezone, as a Date. */
export function startOfAppToday(now = new Date(), timeZone = process.env.APP_TIMEZONE || DEFAULT_ZONE) {
  let p;
  try { p = parts(now, timeZone); } catch { p = parts(now, DEFAULT_ZONE); }
  const wallAsUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  const offset = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;   // zone offset right now
  return new Date(Date.UTC(p.y, p.m - 1, p.d) - offset);
}

/** Same instant in SQLite's own "YYYY-MM-DD HH:MM:SS" (UTC) form. */
export function startOfAppTodaySql(now, timeZone) {
  return startOfAppToday(now, timeZone).toISOString().slice(0, 19).replace('T', ' ');
}

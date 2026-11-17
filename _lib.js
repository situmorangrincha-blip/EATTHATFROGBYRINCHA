import { createClient } from '@supabase/supabase-js';

export const admin = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Tanggal, menit-dalam-hari, dan hari-minggu di zona waktu tertentu
export function nowIn(tz, date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(date).map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute, wd: WD[p.weekday] };
}
export const toMin = (t) => { const [h, m] = String(t).split(':'); return +h * 60 + +m; };
export const pts = (t) => (t.frog ? 50 : 10);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Dedupe: true kalau key baru berhasil diklaim, false kalau sudah pernah terkirim
export async function claim(db, userId, key) {
  const { error } = await db.from('email_log').insert({ user_id: userId, key });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw new Error(error.message);
}
export const unclaim = (db, userId, key) =>
  db.from('email_log').delete().eq('user_id', userId).eq('key', key);

export async function sendMail({ to, subject, html }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Frog Quest <onboarding@resend.dev>', to: [to], subject, html }),
  });
  if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (await r.text()));
}

const row = (t, done) =>
  `<tr><td style="padding:9px 0;border-bottom:1px solid #eee;font-size:15px;${done ? 'color:#8e8e93;text-decoration:line-through;' : ''}">` +
  `${t.frog ? '🐸 ' : ''}${esc(t.text)}${t.remind_time && !done ? ` <span style="color:#8e8e93;font-size:12px">⏰ ${String(t.remind_time).slice(0, 5)}</span>` : ''}</td>` +
  `<td align="right" style="padding:9px 0;border-bottom:1px solid #eee;font-size:13px;color:#8e8e93">+${pts(t)}</td></tr>`;

export function layout({ title, lead, done = [], pending = [], stats }) {
  const url = process.env.APP_URL;
  const block = (h, list, d) => list.length
    ? `<h3 style="margin:20px 0 4px;font-size:13px;color:#8e8e93;font-weight:600">${h}</h3><table width="100%" cellspacing="0">${list.map((t) => row(t, d)).join('')}</table>` : '';
  return `<div style="background:#f2f2f7;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:460px;margin:0 auto;background:#fff;border-radius:22px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#34c759,#1f8a3d);color:#fff;padding:22px">
      <div style="font-size:13px;opacity:.85">Frog Quest</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px">${esc(title)}</div>
    </div>
    <div style="padding:20px 22px 24px;color:#1c1c1e">
      <p style="margin:0;font-size:15px;line-height:1.5">${esc(lead)}</p>
      ${stats ? `<p style="margin:12px 0 0;font-size:13px;color:#8e8e93">${stats}</p>` : ''}
      ${block('Sudah beres', done, true)}${block('Belum selesai', pending, false)}
      ${url ? `<p style="margin:22px 0 0"><a href="${esc(url)}" style="background:#0a84ff;color:#fff;text-decoration:none;padding:11px 18px;border-radius:12px;font-size:14px;font-weight:600;display:inline-block">Buka Frog Quest</a></p>` : ''}
    </div></div></div>`;
}

// Ambil tugas hari ini + hitung yang selesai hari ini
export async function loadDay(db, userId, tz) {
  const now = nowIn(tz);
  const { data, error } = await db.from('tasks').select('*').eq('user_id', userId).eq('day', now.date).order('created_at');
  if (error) throw new Error(error.message);
  const tasks = data || [];
  const done = tasks.filter((t) => t.done && t.done_at && nowIn(tz, new Date(t.done_at)).date === now.date);
  const pending = tasks.filter((t) => !t.done);
  return { now, tasks, done, pending };
}

// Dipanggil tiap 5 menit oleh Supabase pg_cron. Kirim reminder rutinitas / task khusus / nudge.
import { admin, loadDay, claim, unclaim, sendMail, layout, toMin, pts } from './_lib.js';

async function run(db, set) {
  const sent = [];
  const { now, done, pending } = await loadDay(db, set.user_id, set.tz);
  if (!pending.length) return sent;
  const due = (t) => { const d = now.min - toMin(t); return d >= 0 && d <= 120; }; // jendela 2 jam
  const stats = `🔥 streak ${set.streak} hari`;

  async function send(key, subject, html) {
    if (!(await claim(db, set.user_id, key))) return false;
    try { await sendMail({ to: set.email, subject, html }); } catch (e) { await unclaim(db, set.user_id, key); throw e; }
    sent.push(key);
    return true;
  }

  const frog = pending.find((t) => t.frog);

  if (set.mode === 'routine' && set.routine_days.includes(now.wd) && due(set.routine_time)) {
    const label = (frog || pending[0]).text;
    const lead = String(set.routine_msg || 'Frog lu hari ini: {frog}').replace('{frog}', label);
    await send(`routine:${now.date}`, `🐸 ${lead}`.slice(0, 120), layout({ title: 'Pengingat pagi', lead, done, pending, stats }));
  }

  if (set.mode === 'task') {
    const dueTasks = pending.filter((t) => t.remind_time && due(t.remind_time));
    const claimed = [];
    for (const t of dueTasks) if (await claim(db, set.user_id, `task:${t.id}`)) claimed.push(t);
    if (claimed.length) {
      try {
        await sendMail({
          to: set.email,
          subject: `⏰ ${claimed[0].text}${claimed.length > 1 ? ` +${claimed.length - 1} lainnya` : ''}`.slice(0, 120),
          html: layout({ title: 'Waktunya kerjain ini', lead: 'Tugas dengan jam reminder sudah masuk waktunya.', pending: claimed, stats }),
        });
        claimed.forEach((t) => sent.push(`task:${t.id}`));
      } catch (e) {
        for (const t of claimed) await unclaim(db, set.user_id, `task:${t.id}`);
        throw e;
      }
    }
  }

  if (set.nudge_enabled && due(set.nudge_time) && (frog || done.length === 0)) {
    const lead = frog ? `Frog "${frog.text}" belum dimakan. Kerjain yang ini dulu.` : 'Belum ada tugas yang selesai hari ini. Mulai dari yang paling kecil.';
    await send(`nudge:${now.date}`, frog ? '🐸 Frog lu belum dimakan' : '⏰ Belum ada tugas selesai', layout({ title: 'Jangan lupa', lead, done, pending, stats }));
  }
  return sent;
}

export default async function handler(req, res) {
  if ((req.headers.authorization || '') !== 'Bearer ' + process.env.CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  const db = admin();
  const { data: sets, error } = await db.from('settings').select('*').not('email', 'is', null);
  if (error) return res.status(500).json({ error: error.message });
  const out = [];
  for (const set of sets || []) {
    try { out.push(...(await run(db, set))); } catch (e) { out.push(`ERR ${set.user_id}: ${e.message}`); }
  }
  res.status(200).json({ ok: true, sent: out });
}

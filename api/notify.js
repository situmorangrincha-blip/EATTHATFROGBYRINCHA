// Dipanggil dari web saat tugas selesai (laporan) atau tombol "Kirim email tes".
import { admin, loadDay, claim, unclaim, sendMail, layout, pts } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const db = admin();
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const { data: { user } = {}, error: ue } = await db.auth.getUser(token);
    if (ue || !user) return res.status(401).json({ error: 'Belum login' });

    const type = (req.body && req.body.type) || '';
    const { data: set } = await db.from('settings').select('*').eq('user_id', user.id).maybeSingle();
    if (!set || !set.email) return res.status(400).json({ error: 'Isi email di pengaturan dulu' });

    const { now, tasks, done, pending } = await loadDay(db, user.id, set.tz);
    const score = done.reduce((a, t) => a + pts(t), 0);
    const stats = `+${score} poin hari ini · 🔥 streak ${set.streak} hari`;

    let key = null, mail = null;
    if (type === 'test') {
      mail = { subject: '🐸 Tes email Frog Quest', html: layout({ title: 'Email tersambung', lead: 'Kalau email ini masuk, laporan dan reminder lu siap jalan.', done, pending, stats }) };
    } else if (type === 'all' && tasks.length > 0 && pending.length === 0) {
      key = `all:${now.date}`;
      mail = { subject: '🏁 Semua tugas hari ini beres!', html: layout({ title: 'Semua tugas beres', lead: `Mantap, ${done.length} tugas selesai hari ini.`, done, pending, stats }) };
    } else if (type === 'milestone' && set.report_enabled && done.length > 0 && done.length % set.report_every === 0) {
      key = `ms:${now.date}:${done.length}`;
      mail = { subject: `🐸 ${done.length} tugas beres hari ini`, html: layout({ title: `${done.length} tugas selesai`, lead: pending.length ? `Masih ada ${pending.length} tugas lagi. Lanjut.` : 'Semua tugas beres.', done, pending, stats }) };
    }
    if (!mail) return res.status(200).json({ sent: false });

    if (key && !(await claim(db, user.id, key))) return res.status(200).json({ sent: false, reason: 'sudah terkirim' });
    try {
      await sendMail({ to: set.email, ...mail });
    } catch (e) {
      if (key) await unclaim(db, user.id, key);
      throw e;
    }
    return res.status(200).json({ sent: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

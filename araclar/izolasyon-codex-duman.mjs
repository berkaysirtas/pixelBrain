// İzolasyon, gerçek Codex turu (K-079): node araclar/izolasyon-codex-duman.mjs (sunucu açıkken; gerçek tur, 1-2 dk).
// Tarayıcısız. İzole bir geçici çalışma alanında Codex'ten başka çalışma alanının notunu ve konuşma arşivini okuması istenir.
// Bakılanlar: Kişisel › Satış notundaki ve konuşma arşivindeki metin cevaba ve komut çıktılarına sızmıyor; denenen okuma
// sandbox'ta "Operation not permitted" ile düşüyor ya da Codex izin kuralını görüp denemiyor; kendi Defter'ini okuyabiliyor.
// Sunucu yeniden başlayınca aynı konuşma (thread) izin profiliyle geri açılıyor, geçmiş kaybolmuyor. Açtığını kaldırır.
import { readFileSync, readdirSync } from 'node:fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700', REPO = new URL('..', import.meta.url), yol = (p) => new URL(p, REPO);
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const al = (u) => fetch(KOK + u, { cache: 'no-store' }).then((r) => r.json());
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const isaret = 'KENDI-DEFTERIM-' + Date.now().toString(36).toUpperCase();
const satisNot = readdirSync(yol('notlar/satis/')).find((f) => f.endsWith('.md'));
const satisSatir = readFileSync(yol('notlar/satis/' + satisNot), 'utf8').split('\n').find((l) => l.trim().length > 30 && !l.startsWith('---') && !/^[a-z_]+:/.test(l))?.trim().slice(0, 40);
const { ca, alan, temizle } = await geciciAlan('İzolasyon deneme', 'İzole alan');
const sonuc = {}, hatalar = [];
const turBitti = async () => { for (let i = 0; i < 120; i++) { await bekle(1500); const d = await al('/api/codex/durum'); if (!(d.aktif || []).length) return; } throw new Error('tur bitmedi'); };
const gecmis = async () => {
  const g = await al('/api/codex/gecmis?alan=' + alan), parca = (g.turlar || []).flatMap((t) => t.parcalar);
  return { thread: g.thread, tur: (g.turlar || []).length, komut: parca.filter((p) => p.type === 'commandExecution').map((p) => ({ k: String(p.command).replace(/^\/bin\/\w+ -l?c /, '').slice(0, 90), kod: p.exitCode, cikti: String(p.aggregatedOutput || '').slice(0, 160) })),
    cevap: parca.filter((p) => p.type === 'agentMessage').map((p) => p.text).join('\n') };
};
try {
  // Kendi Defter'ine işaret yaz: kendi verisini okuyabildiği sınansın
  const d = (await post('/api/alan-not', { alan })).sonuc;
  await post('/api/sayfa', { id: d.id, govde: 'Bu alanın notu: ' + isaret });
  await post('/api/codex/gonder', { alan, metin: `Üç şey yap, komutla dene ve sonucu aynen yaz: 1) Bu alanın Defter'inde hangi işaret kelime yazıyor (sayfalar/${alan}/ altına bak)? 2) notlar/satis/${satisNot} dosyasının ilk satırlarını oku. 3) ham/konusmalar/ klasöründeki dosyaları listele.`, efor: 'low' });
  await turBitti();
  const g1 = await gecmis(), metin = g1.cevap + g1.komut.map((k) => k.cikti).join('\n');
  sonuc.tur = { thread: !!g1.thread, komut: g1.komut, cevap: g1.cevap.slice(0, 400) };
  sonuc.sizinti = { satis_satiri: !!satisSatir && metin.includes(satisSatir), konusma_dosyasi: /\d{4}-\d{2}-\d{2}-(claude|codex)/i.test(metin) };
  sonuc.engel = { sandbox: g1.komut.some((k) => /Operation not permitted/.test(k.cikti)), kendi_defteri: metin.includes(isaret) };
  if (sonuc.sizinti.satis_satiri || sonuc.sizinti.konusma_dosyasi) hatalar.push('sızıntı');
  if (!sonuc.engel.kendi_defteri) hatalar.push('kendi Defter\'ini okuyamadı');
  // Yeniden başlatınca aynı konuşma izin profiliyle geri açılmalı (açılamazsa yeni konuşma açılır ve geçmiş kaybolurdu)
  await post('/api/yeniden-baslat', {});
  for (let i = 0; i < 30; i++) { await bekle(1000); try { await al('/api/codex/durum'); break; } catch {} }
  const g2 = await gecmis();
  sonuc.yeniden = { ayni_konusma: g2.thread === g1.thread, tur: g2.tur };
  if (g2.thread !== g1.thread || !g2.tur) hatalar.push('yeniden açılışta konuşma kayboldu');
} catch (e) { hatalar.push(String(e).slice(0, 200)); }
finally {
  await post('/api/codex/dur', { alan }).catch(() => {});
  temizle();
}
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

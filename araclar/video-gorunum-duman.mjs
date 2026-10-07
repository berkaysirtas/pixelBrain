// Video görünümü duman sınaması (K-045): node araclar/video-gorunum-duman.mjs [görüntü klasörü]. Gerçek Codex özeti yapar.
// Geçici alana 8 sn deneme videosu yükler, bitince Bilgi › Kaynaklar'daki karta basar; oynatıcı, bölümler ve kareler var mı,
// karta ya da kareye basınca video o saniyeye gidiyor mu sınar. Açtığı her şeyi kaldırır.
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { readFileSync, rmSync, mkdirSync } from 'fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700', CIKTI = process.argv[2] || '.durum';
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('.durum', { recursive: true });
const yol = '.durum/deneme-video2.mp4';
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=8:size=320x240:rate=10', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8', '-shortest', '-pix_fmt', 'yuv420p', yol]);
const { ca, alan, temizle } = await geciciAlan('Görünüm deneme', 'Görünüm alanı');
const sonuc = {}, hatalar = [];
const t = await chromium.launch();
try {
  await post('/api/veri', { calisma: ca, alan, dosya: { ad: 'deneme.mp4', icerik: readFileSync(yol).toString('base64') } });
  const kayit = () => JSON.parse(readFileSync('.durum/videolar.json', 'utf8')).find((v) => v.alan === alan);
  for (let i = 0; i < 240 && !['bitti', 'hata'].includes(kayit()?.asama); i++) await bekle(1000);
  sonuc.asama = kayit()?.asama;
  const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
  s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
  await s.goto(`${KOK}/#/c/${ca}/${alan}/bilgi`); await s.waitForSelector('[data-video-no]', { timeout: 20000 });
  await s.click('[data-video-no] .kv-ic'); await s.waitForSelector('.vg #vgOyn');
  sonuc.bolum = await s.$$eval('.vg-bol button', (e) => e.length);
  sonuc.kare = await s.$$eval('.vg-kareler button', (e) => e.length);
  await s.click('.vg-kareler button:nth-child(4)'); await bekle(500);
  sonuc.saniye = await s.$eval('#vgOyn', (e) => Math.round(e.currentTime));
  await s.screenshot({ path: `${CIKTI}/video-gorunum.png` });
  await s.keyboard.press('Escape'); sonuc.kapandi = !(await s.$('.vg'));
} finally { await t.close(); temizle(); rmSync(yol, { force: true }); }
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

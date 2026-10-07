// Yerel video duman sınaması (K-045): node araclar/video-yerel-duman.mjs (sunucu açıkken). Gerçek Codex özeti yapar.
// ffmpeg ile 8 saniyelik deneme videosu üretir, geçici alana /api/veri ile yükler; videonun sıraya girip transkript,
// kare ve özet aşamalarından geçtiğini, karelerin yazıldığını sınar. Açtığı her şeyi kaldırır.
import { execFileSync } from 'child_process';
import { readFileSync, readdirSync, existsSync, rmSync, mkdirSync } from 'fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('.durum', { recursive: true });
const yol = '.durum/deneme-video.mp4';
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=8:size=320x240:rate=10', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8',
  '-shortest', '-pix_fmt', 'yuv420p', yol]);
const { ca, alan, temizle } = await geciciAlan('Video deneme', 'Video alanı');
const sonuc = {};
try {
  sonuc.yukle = (await post('/api/veri', { calisma: ca, alan, dosya: { ad: 'deneme video.mp4', icerik: readFileSync(yol).toString('base64') } })).sonuc;
  const kayit = () => JSON.parse(readFileSync('.durum/videolar.json', 'utf8')).find((v) => v.alan === alan);
  sonuc.ilk = kayit()?.asama;
  const asamalar = new Set();
  for (let i = 0; i < 240; i++) {  // en çok 4 dakika (model ilk seferde iner)
    const v = kayit(); if (v) asamalar.add(v.asama);
    if (!v || ['bitti', 'hata'].includes(v.asama)) break;
    await bekle(1000);
  }
  const v = kayit();
  sonuc.son = v?.asama; sonuc.hata = v?.hata || ''; sonuc.asamalar = [...asamalar]; sonuc.sure = v?.sure;
  const klasor = `ham/kaynaklar/${ca}/${alan}/video/${v?.vid}`;
  sonuc.kareler = existsSync(klasor) ? readdirSync(klasor).filter((f) => f.endsWith('.jpg')).length : 0;
} finally {
  temizle(); rmSync(yol, { force: true });
}
console.log(JSON.stringify(sonuc, null, 1));

// Verilen panoların küçük resmini çeker: <durum>/resim/<ad>.png (gerçek boyun 0,3'ü).
// Kullanım: sunucu.py kendisi çağırır
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4620;
const PROJE = process.env.BEYIN_PANOLAR;
const RESIM = process.env.BEYIN_RESIM || path.join(KOK, 'resim');
const OLCEK = 0.3;
const panolar = JSON.parse(fs.readFileSync(path.join(PROJE, 'canvas.json'), 'utf8')).boards;
fs.mkdirSync(RESIM, { recursive: true });

const tarayici = await chromium.launch();
const baglam = await tarayici.newContext({ deviceScaleFactor: OLCEK });
for (const ad of process.argv.slice(2)) {
  const b = panolar[ad];
  if (!b) continue;
  const sayfa = await baglam.newPage();
  try {
    await sayfa.setViewportSize({ width: b.w, height: b.h });
    await sayfa.goto(`http://127.0.0.1:${PORT}/project/${ad}`, { waitUntil: 'load', timeout: 15000 });
    await sayfa.waitForTimeout(800);
    const hedef = path.join(RESIM, ad.replace(/\.dc\.html$/, '') + '.png');
    await sayfa.screenshot({ path: hedef + '.yaziliyor.png' });
    fs.renameSync(hedef + '.yaziliyor.png', hedef);
    console.log('tamam', ad);
  } catch (hata) {
    console.log('hata', ad, String(hata).split('\n')[0].slice(0, 160));
  }
  await sayfa.close();
}
await tarayici.close();

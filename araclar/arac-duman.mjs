// Tuval araç çubuğu A duman sınaması (K-045): node araclar/arac-duman.mjs (sunucu açıkken). Headless.
// Geçici alanın Çizim'inde not, metin ve şekil koyar, yazısını yazar; bağı sürükleyerek çizer; yüzen çubukla renk değiştirir,
// Sil ile kaldırır, Geri al ve İleri al ile döndürür.
// canvas.json'a doğru yazıldığını sınar. Açtığı her şeyi (sayfa ve öğeler) kaldırır.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const { ca, alan, temizle } = await geciciAlan('Araç deneme', 'Araç alanı');
const sayfa = 'page-' + alan;
const ogeler = () => Object.values(JSON.parse(readFileSync('panolar/canvas.json', 'utf8')).notes || {}).filter((n) => n.page === sayfa);
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
try {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/cizim`);
  await s.waitForSelector('#icerik iframe', { timeout: 15000 });
  const f = s.frameLocator('#icerik iframe');
  await f.locator('[data-arac="not"]').waitFor({ timeout: 15000 });
  const sahne = await s.$eval('#icerik iframe', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const tikla = async (arac, x, y, yazi) => {
    await f.locator(`[data-arac="${arac}"]`).click();
    await s.mouse.click(sahne.x + x, sahne.y + y); await s.waitForTimeout(500);
    if (yazi) { await s.keyboard.type(yazi); await s.keyboard.press('Escape'); await s.waitForTimeout(500); }
  };
  await tikla('not', 300, 250, 'Deneme notu');
  await tikla('metin', 600, 250, 'Başlık yazısı');
  await tikla('sekil', 300, 450, 'Kutu');
  await f.locator('[data-arac="bag"]').click();
  await s.mouse.move(sahne.x + 500, sahne.y + 450); await s.mouse.down(); await s.mouse.move(sahne.x + 700, sahne.y + 520, { steps: 6 }); await s.mouse.up();
  await s.waitForTimeout(700);
  await s.screenshot({ path: '.durum/arac-duman.png' });
  const once = ogeler();
  sonuc.turler = once.map((n) => n.kind || 'not').sort();
  sonuc.yazilar = once.map((n) => n.text).filter(Boolean).sort();
  sonuc.bag = once.some((n) => n.kind === 'bag' && Math.abs(n.dx - 200) < 30 && Math.abs(n.dy - 70) < 30);
  await f.locator('.yapiskan').click(); await s.waitForTimeout(300);
  sonuc.cubuk = await f.locator('#ogeCubuk').isVisible();
  await f.locator('#ogeCubuk [data-renk="green"]').click(); await s.waitForTimeout(600);
  sonuc.renk = ogeler().find((n) => !n.kind)?.fill;
  await f.locator('.sekil-not').click(); await f.locator('#ogeCubuk [data-sil]').click(); await s.waitForTimeout(600);
  sonuc.silindi = !ogeler().some((n) => n.kind === 'sekil');
  await f.locator('#geriAl').click(); await s.waitForTimeout(700);
  sonuc.geriAlindi = ogeler().some((n) => n.kind === 'sekil' && n.text === 'Kutu');
  await f.locator('#ileriAl').click(); await s.waitForTimeout(700);
  sonuc.ileriAlindi = !ogeler().some((n) => n.kind === 'sekil');
  await f.locator('#geriAl').click(); await s.waitForTimeout(700);
  await f.locator('#geriAl').click(); await s.waitForTimeout(700);
  sonuc.renkGeri = ogeler().find((n) => !n.kind)?.fill;  // silmeyi, sonra rengi geri alır: sarıya döner
  await f.locator('.yapiskan').click(); await s.waitForTimeout(300);
  await s.screenshot({ path: '.durum/arac-cubuk.png' });
} finally {
  await t.close();
  const c = JSON.parse(readFileSync('panolar/canvas.json', 'utf8'));
  for (const [k, n] of Object.entries(c.notes || {})) if (n.page === sayfa) delete c.notes[k];
  writeFileSync('panolar/canvas.json', JSON.stringify(c, null, 1) + '\n');
  temizle();
}
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

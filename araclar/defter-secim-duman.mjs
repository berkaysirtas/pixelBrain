// Defter blok seçimi ve link duman sınaması: node araclar/defter-secim-duman.mjs (sunucu açıkken). Headless.
// Üç satır yazar; birinci satırdan üçüncüye sürükleyince üç blok seçilir, çubuk "3 blok" der, Sil hepsini kaldırır. Seçili yazıya
// ⌘⇧K ile link verir, başka yazının üstüne URL yapıştırınca link olur; Defter dosyasında [yazı](url) olarak durur. Açtığını kaldırır.
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const { ca, alan, temizle } = await geciciAlan('Seçim deneme', 'Seçim alanı');
const defter = () => readdirSync(`sayfalar/${alan}`).map((f) => readFileSync(`sayfalar/${alan}/${f}`, 'utf8')).find((x) => x.includes('ana: evet')) || '';
const t = await chromium.launch(); const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
try {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`); await s.waitForSelector('#syYazi .sy-metin'); await s.waitForTimeout(600);
  await s.click('#syYazi .sy-metin');
  for (const x of ['birinci satır', 'ikinci satır', 'üçüncü satır', 'kalan satır']) { await s.keyboard.type(x); await s.keyboard.press('Enter'); }
  await s.waitForTimeout(400);
  const m = await s.$$('#syYazi .sy-blok .sy-metin');
  const r1 = await m[0].boundingBox(), r3 = await m[2].boundingBox();
  await s.mouse.move(r1.x + 20, r1.y + r1.height / 2); await s.mouse.down();
  await s.mouse.move(r3.x + 40, r3.y + r3.height / 2, { steps: 8 }); await s.mouse.up(); await s.waitForTimeout(300);
  sonuc.secili = await s.$$eval('#syYazi .sy-blok.secili', (e) => e.length);
  sonuc.cubuk = await s.$eval('.sy-bicim', (e) => !e.hidden && e.querySelector('.sy-bicim-sayi').textContent);
  await s.screenshot({ path: '.durum/defter-secim.png' });
  await s.keyboard.press('Backspace'); await s.waitForTimeout(1500);
  sonuc.silindi = !defter().includes('ikinci satır') && defter().includes('kalan satır');
  // ⌘⇧K ile link
  const k = (await s.$$('#syYazi .sy-blok .sy-metin'))[0];
  await k.click(); await s.keyboard.press('End'); await s.keyboard.press('Enter'); await s.keyboard.type('Beyin sitesi');
  await s.keyboard.press('Shift+Home'); await s.waitForTimeout(200);
  await s.keyboard.press('Meta+Shift+K'); await s.waitForSelector('.sy-link:not([hidden]) input');
  sonuc.komutAcilmadi = await s.$eval('#komut', (e) => e.hidden);
  await s.keyboard.type('example.com/beyin'); await s.keyboard.press('Enter'); await s.waitForTimeout(1500);
  sonuc.link = defter().includes('[Beyin sitesi](https://example.com/beyin)');
  // seçiliyken URL yapıştır
  await s.keyboard.press('End'); await s.keyboard.press('Enter'); await s.keyboard.type('kaynak');
  await s.keyboard.press('Shift+Home');
  await s.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'https://example.org/k'); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await s.waitForTimeout(1500);
  sonuc.yapistirLink = defter().includes('[kaynak](https://example.org/k)');
} finally {
  await t.close(); temizle();
}
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

// Defter'e link bırakma duman sınaması: node araclar/defter-link-duman.mjs (sunucu açıkken). Headless.
// Geçici alanın Defter'ine sürüklenmiş link bırakır; linkin Defter'e bağ olarak yazıldığını ve alanın verisine girdiğini,
// üst çubukta tek Veri düğmesi kaldığını (Video ona katıldı, K-057) sınar. Açtığını kaldırır.
import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const { ca, alan, temizle } = await geciciAlan('Link deneme', 'Link alanı');
const t = await chromium.launch(); const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
try {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`); await s.waitForSelector('#syYazi .sy-bloklar'); await s.waitForTimeout(800);
  sonuc.dugmeler = await s.$$eval('#ust .ust-dugme .yazi', (e) => e.map((x) => x.textContent));
  const r = await s.$eval('#syYazi .sy', (e) => { const b = e.getBoundingClientRect(); return { x: b.left + 200, y: b.top + 300 }; });
  await s.evaluate(({ x, y }) => {
    const dt = new DataTransfer(); dt.setData('text/uri-list', 'https://example.com/rehber'); dt.setData('text/plain', 'https://example.com/rehber');
    const hedef = document.elementFromPoint(x, y);
    for (const tur of ['dragenter', 'dragover', 'drop']) hedef.dispatchEvent(new DragEvent(tur, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
  }, r);
  await s.waitForTimeout(2500);
  const not = readdirSync(`sayfalar/${alan}`).map((f) => readFileSync(`sayfalar/${alan}/${f}`, 'utf8')).find((x) => x.includes('ana: evet')) || '';
  sonuc.defterde = not.includes('[example.com/rehber](https://example.com/rehber)');
  sonuc.ekranda = await s.$$eval('#syYazi .sy-bloklar a', (e) => e.map((x) => x.getAttribute('href')));
  const klasor = `ham/kaynaklar/${ca}/${alan}`;
  sonuc.veride = existsSync(klasor) && readdirSync(klasor, { recursive: true }).some((f) => String(f).endsWith('.url.txt'));
} finally {
  await t.close(); temizle();
}
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

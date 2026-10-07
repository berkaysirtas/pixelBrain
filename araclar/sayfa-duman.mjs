// Alan ekranı duman sınaması (K-029): node araclar/sayfa-duman.mjs (sunucu açıkken). Headless. Geçici bir çalışma alanı ve alan
// açar; Defter (bloklar, "/" menüsü, şablon, sürükleme, dosya bırakma), Çizim, tek Codex paneli, iki katlı kenar çubuğu ve eski
// adreslerin yönlenmesini denetler; sonunda geçici çalışma alanını kaldırır (araclar/gecici-alan.mjs).
import { chromium } from 'playwright';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const { ca, alan, temizle } = await geciciAlan('Duman deneme', 'Duman alanı');
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
await s.addInitScript(() => { localStorage.setItem('beyin:oneri', 'kapali'); localStorage.setItem('beyin:panel', 'acik'); });
const bekle = (ms) => s.waitForTimeout(ms);
const yaz = (m) => s.keyboard.type(m, { delay: 6 });
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); } };
let notId = '';

await adim('alan_ekrani', async () => {
  await s.goto(`${KOK}/#/c/${ca}/${alan}`); await s.waitForSelector('#syYazi .sy-baslik', { timeout: 15000 }); await bekle(400);
  notId = await s.$eval('.sy-yuzey', (e) => e.dataset.not);
  return { baslik: await s.$eval('.sy-baslik', (e) => e.textContent), sekme: await s.$eval('[data-sy-sekme="yazi"]', (e) => e.textContent.trim()),
    panel: await s.$eval('.panel-ust', (e) => e.textContent.trim()), notlarSekmesi: await s.$$eval('[data-sekme^="panel:"]', (e) => e.length),
    sablonSatiri: await s.$$eval('.sy-sablon', (e) => e.length), sayfaAgaci: await s.$$eval('#sayfaAgaci', (e) => e.length),
    yan: await s.$$eval('#yan .agac-satir', (e) => e.map((x) => (x.style.getPropertyValue('--d') || '0') + ' ' + x.textContent.trim().slice(0, 14))) };
});
await adim('yazim', async () => {
  await s.click('.sy-blok .sy-metin');
  await yaz('# Başlık'); await s.keyboard.press('Enter'); await yaz('Bir paragraf.'); await s.keyboard.press('Enter');
  await yaz('- madde'); await s.keyboard.press('Enter'); await s.keyboard.press('Enter'); await yaz('/yorum'); await bekle(150);
  const menu = await s.$eval('.sy-menu', (m) => !m.hidden && [...m.querySelectorAll('.sy-menu-bas, .sy-menu-oge b')].map((b) => b.textContent));
  await s.keyboard.press('Escape'); for (let i = 0; i < 6; i++) await s.keyboard.press('Backspace');
  await bekle(1300);
  const kayit = await (await fetch(`${KOK}/api/sayfa?id=${notId}`)).json();
  return { menu, govde: kayit.govde, alanda: kayit.alan === alan };
});
await adim('surukle', async () => {
  await s.hover('.sy-bloklar > .sy-blok:nth-child(3)'); const b = await (await s.$('.sy-bloklar > .sy-blok:nth-child(3) .sy-tut')).boundingBox();
  const ilk = await (await s.$('.sy-bloklar > .sy-blok:first-child')).boundingBox();
  await s.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await s.mouse.down(); await s.mouse.move(b.x + 40, ilk.y + 2, { steps: 10 }); await s.mouse.up(); await bekle(1200);
  return (await (await fetch(`${KOK}/api/sayfa?id=${notId}`)).json()).govde.split('\n')[0];
});
await adim('dosya_birak', async () => {
  await s.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['ay,sayi\nOcak,3\n'], 'duman-veri.csv', { type: 'text/csv' }));
    const h = document.querySelector('#syYazi .sy-blok .sy-metin');
    for (const x of ['dragenter', 'dragover', 'drop']) h.dispatchEvent(new DragEvent(x, { bubbles: true, cancelable: true, dataTransfer: dt, clientY: h.getBoundingClientRect().bottom })); });
  await s.waitForSelector('.sy-metin a.sy-dosya', { timeout: 10000 });
  return await s.$eval('.sy-metin a.sy-dosya', (a) => a.getAttribute('href').replace(/\d{8}-\d{6}-/, '…-'));
});
await adim('sablon', async () => {
  await s.click('.sy-bloklar > .sy-blok:last-child .sy-metin'); await s.keyboard.type('/topl', { delay: 6 }); await s.waitForTimeout(150);
  const menu = await s.$$eval('.sy-menu .sy-menu-bas, .sy-menu .sy-menu-oge b', (e) => e.map((x) => x.textContent));
  await s.keyboard.press('Enter'); await s.keyboard.type('Ayşe', { delay: 6 }); await s.waitForTimeout(1300);
  const govde = (await (await fetch(`${KOK}/api/sayfa?id=${notId}`)).json()).govde;
  return { menu, baslik: /## Toplantı · /.test(govde), kimler: govde.includes('**Kimler:** Ayşe'), alt: govde.includes('### Gündem') };
});
await adim('cizim', async () => {
  await s.click('[data-sy-sekme="cizim"]'); await s.waitForSelector('#syCizim iframe', { timeout: 15000 }); await bekle(1200);
  return { url: new URL(s.url()).hash.split('/').pop(), arac: await s.frameLocator('#syCizim iframe').locator('.araclar [data-arac]').count(), bos: await s.$eval('#syCizimBos', (e) => !e.hidden),
    yuzen: await s.evaluate(() => document.body.classList.contains('cizimde') && getComputedStyle(document.querySelector('#icerik .panel')).position + ' ' + getComputedStyle(document.querySelector('#ust')).position) };
});
await adim('eski_adresler', async () => {
  await s.goto(`${KOK}/#/sayfa/${notId}`); await bekle(1200); const sayfa = new URL(s.url()).hash;
  await s.goto(`${KOK}/#/c/${ca}/${alan}/konu/x`); await bekle(1000);
  return { sayfa, konu: await s.$eval('[data-sy-sekme="yazi"]', (e) => e.getAttribute('aria-selected')), cizimdeKalkti: await s.evaluate(() => !document.body.classList.contains('cizimde')) };
});
await adim('veri_karti', async () => {
  await s.click('#veriDugme'); await s.waitForTimeout(200);
  const r = await s.$eval('#veri', (e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), ust: Math.round(b.top) }; });
  return { ...r, sayfaItilmedi: await s.$eval('#ana', (e) => getComputedStyle(e).right) };
});
await adim('veri_kapanis', async () => {  // K-072: × yok; dışarı tık ve Esc kapatır, yazılan metin kalır, kartın içi kapatmaz
  const gizli = () => s.$eval('#veri', (e) => e.hidden);
  await s.fill('#metin', 'https://ornek.test/deneme'); await s.click('#veri .vk-hedef');
  const icTik = await gizli();
  await s.mouse.click(720, 700); await s.waitForTimeout(150);
  const disTik = await gizli();
  await s.click('#veriDugme'); await s.waitForTimeout(200);
  const metin = await s.$eval('#metin', (e) => e.value);
  await s.keyboard.press('Escape'); await s.waitForTimeout(150);
  const esc = await gizli();
  await s.evaluate(() => { document.querySelector('#metin').value = ''; });
  return { carpi: !!(await s.$('#veriKapat')), icTikKapatmadi: !icTik, disTikKapatti: disTik, metinKaldi: metin, escKapatti: esc };
});
await t.close();

temizle();
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

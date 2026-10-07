// Liste sıralama duman sınaması (K-045): node araclar/sira-duman.mjs (sunucu açıkken). Headless.
// Geçici çalışma alanına üç alan açar, üçüncüyü tutamaktan sürükleyip en üste bırakır, sıranın calisma.json'a yazıldığını
// ve hatalı sıranın reddedildiğini sınar. Kullanıcının verisi yalnız okunur; açtığı her şeyi kaldırır.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, rmSync } from 'fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const { ca, alan, temizle } = await geciciAlan('Sıra deneme', 'Bir');
const ekler = [];
for (const ad of ['İki', 'Üç']) ekler.push((await post('/api/alan', { calisma: ca, ad, ikon_ciz: false })).sonuc);
const sira = async () => (await (await fetch(KOK + '/api/calisma')).json()).calisma_alanlari.find((x) => x.id === ca).alanlar.map((a) => a.id);
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
try {
  sonuc.once = await sira();
  await s.goto(`${KOK}/#/c/${ca}`); await s.waitForSelector(`#calismalar [data-alan="${ekler[1]}"]`, { state: 'attached', timeout: 15000 });
  await s.hover(`#rayListe [data-git="#/c/${ca}"]`); await s.waitForTimeout(500);
  const ilk = await s.$eval(`#calismalar [data-alan="${alan}"]`, (e) => { const r = e.getBoundingClientRect(); return { y: r.top + 3 }; });
  await s.hover(`#calismalar [data-alan="${ekler[1]}"]`);
  const tut = await s.$eval(`#calismalar [data-alan="${ekler[1]}"] [data-tut]`, (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await s.mouse.move(tut.x, tut.y); await s.mouse.down(); await s.mouse.move(tut.x, ilk.y, { steps: 8 }); await s.mouse.up();
  await s.waitForTimeout(800);
  sonuc.sonra = await sira();
  sonuc.dogru = sonuc.sonra.join() === [ekler[1], alan, ekler[0]].join();
  sonuc.ret = (await post('/api/alan-sira', { calisma: ca, sira: [alan] })).hata || 'reddedilmedi';
} finally {
  await t.close();
  temizle();
  const t2 = JSON.parse(readFileSync('panolar/canvas.json', 'utf8'));
  t2.pages = t2.pages.filter((x) => !ekler.some((a) => x.id === 'page-' + a));
  writeFileSync('panolar/canvas.json', JSON.stringify(t2, null, 1));
  for (const a of ekler) for (const d of [`notlar/${a}`, `sayfalar/${a}`]) rmSync(d, { recursive: true, force: true });
}
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

// Ray ve liste, ⌘K duman sınaması: node araclar/ray-duman.mjs (sunucu açıkken). Headless.
// Rayda her görünür çalışma alanı bir kare mi; kareye gelince liste açılıp o çalışma alanının alanlarını gösteriyor mu;
// İzole düğmesi listenin başında çalışıp rayda kilit rozeti çıkarıyor mu; ⌘K açılıp süzüp Enter ile gidiyor mu.
// İzole yalnız geçici çalışma alanında denenir (araclar/gecici-alan.mjs); kullanıcının verisi yalnız okunur.
import { chromium } from 'playwright';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); } };
const { ca, alan, temizle } = await geciciAlan('Ray deneme', 'Ray alanı');
const calisma = await (await fetch(KOK + '/api/calisma')).json();
const gorunur = calisma.calisma_alanlari.filter((c) => !c.gizli);

await adim('ray', async () => {
  await s.goto(KOK + '/#/ortak'); await s.waitForSelector('#rayListe .ray-kare', { timeout: 15000 });
  return { kare: await s.$$eval('#rayListe .ray-kare', (e) => e.length), beklenen: gorunur.length, ortakSecili: await s.$eval('#ortakDugme', (e) => e.getAttribute('aria-current')),
    izoleUstte: !!(await s.$('#ust #izole')) };
});
await adim('liste', async () => {
  await s.click(`#rayListe [data-git="#/c/${ca}"]`);  // fare karede kalır: liste açık
  await s.waitForFunction((c) => location.hash === '#/c/' + c, ca);
  await s.waitForSelector('#calismalar .agac-git');
  return { baslik: await s.$eval('#lyUst .ly-ad', (e) => e.textContent.trim()), alanlar: await s.$$eval('#calismalar .agac-git', (e) => e.map((x) => x.textContent.trim())),
    kareSecili: await s.$eval(`#rayListe [data-git="#/c/${ca}"]`, (e) => e.getAttribute('aria-current')) };
});
await adim('izole', async () => {
  const once = await s.$eval('#izole', (e) => e.textContent.trim());
  await s.click('#izole'); await s.waitForFunction((o) => document.querySelector('#izole')?.textContent.trim() !== o, once);
  return { once, sonra: await s.$eval('#izole', (e) => e.textContent.trim()), rozet: !!(await s.$(`#rayListe [data-git="#/c/${ca}"] .ray-kilit`)) };
});
await adim('komut', async () => {
  await s.keyboard.press('Meta+k'); await s.waitForSelector('#komut:not([hidden]) #komutSonuc button');
  const ilk = await s.$$eval('#komutSonuc button', (e) => e.length);
  await s.keyboard.type('ray alan'); await s.waitForTimeout(150);
  const bulunan = await s.$$eval('#komutSonuc button', (e) => e.map((x) => x.textContent.trim()));
  await s.screenshot({ path: '.durum/ray-komut.png' });
  await s.keyboard.press('Enter');
  await s.waitForFunction(() => document.querySelector('#komut').hidden);
  return { ilk, bulunan: bulunan.slice(0, 4), adres: decodeURIComponent(new URL(s.url()).hash) };
});
await adim('bilgi', async () => {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/bilgi`); await s.waitForSelector('#syBilgi .bl-guncelle', { timeout: 15000 }); await s.waitForSelector('#blKaynak .kv-ekle');
  const izlet = await s.$eval('#blKaynak .kv-ekle button', (e) => getComputedStyle(e).display);
  await s.fill('#blKaynak .kv-ekle input', 'https://youtu.be/x');
  return { eylemler: await s.$$eval('.bl-guncelle-menu button', (e) => e.map((x) => x.textContent.trim())), bos: await s.$eval('.bl-bos', (e) => e.textContent),
    etiketYok: !(await s.$('.bl-etiket')), yolYok: !(await s.$('.bl-yol')), izletGizli: izlet === 'none', izletYazinca: await s.$eval('#blKaynak .kv-ekle button', (e) => getComputedStyle(e).display) };
});
await s.screenshot({ path: '.durum/ray-bilgi.png' });
// Çalışma alanı (K-082). Raydaki +: yanında kart açılır, ad kutusu odaklı; renk ve İzole seçilir, Enter adı, rengi ve İzole'yi
// gönderir (istek yakalanır, çalışma alanı açılmaz); Esc kartı kapatır. Menü: geçici çalışma alanının raydaki karesine sağ tık ve
// liste başındaki ▾ aynı menüyü açar; Çöp'e taşı soru sormaz, bildirimdeki Geri al alanıyla birlikte geri getirir.
await adim('arti', async () => {
  let giden = null;
  await s.route('**/api/calisma', (r) => { if (r.request().method() !== 'POST') return r.continue(); giden = r.request().postDataJSON(); r.fulfill({ json: { tamam: true, sonuc: ca } }); });
  await s.goto(`${KOK}/#/ortak`); await s.waitForSelector('#yeniCalisma'); await s.mouse.move(900, 500); await s.waitForTimeout(400);
  const kart = () => s.evaluate(() => { const m = document.querySelector('#caYeni'), g = document.querySelector('#cyAd'), b = m.getBoundingClientRect(), a = document.querySelector('#yeniCalisma').getBoundingClientRect();
    return { acik: !m.hidden, odak: !!g && document.activeElement === g, yaninda: !m.hidden && b.left >= a.right && Math.abs(b.top - a.top) < 40, olustur: document.querySelector('#cyOlustur')?.disabled === false }; });
  await s.click('#yeniCalisma'); const acik = await kart();
  await s.keyboard.type('Arti deneme'); await s.click('#caYeni [data-cy-renk="mor"]'); await s.click('#cyIzole'); const dolu = await kart();
  await s.keyboard.press('Enter'); await s.waitForTimeout(800);
  await s.unroute('**/api/calisma');
  await s.goto(`${KOK}/#/ortak`); await s.waitForSelector('#yeniCalisma'); await s.click('#yeniCalisma'); await s.keyboard.press('Escape'); await s.waitForTimeout(200);
  const esc = await kart();
  if (!acik.acik || !acik.odak || !acik.yaninda) hatalar.push('+ kartı rayın yanında açılmadı ya da ad kutusu odak almadı');
  if (giden?.ad !== 'Arti deneme' || giden?.renk !== 'mor' || giden?.izole !== false) hatalar.push('+ kartı ad, renk ve İzole\'yi göndermedi');
  if (esc.acik) hatalar.push('Esc kartı kapatmadı');
  return { acik, oluşturDugmesi: dolu.olustur, giden, esc_sonra_acik: esc.acik };
});
await adim('menu', async () => {
  await s.goto(`${KOK}/#/c/${ca}`); await s.waitForSelector(`#rayListe [data-git="#/c/${ca}"]`); await s.waitForTimeout(600);
  await s.click(`#rayListe [data-git="#/c/${ca}"]`, { button: 'right' }); await s.waitForTimeout(200);
  const satirlar = await s.$$eval('#caMenu:not([hidden]) .cm-satir', (e) => e.map((x) => x.querySelector('.cm-ad')?.textContent.trim()));
  await s.keyboard.press('Escape'); await s.mouse.click(900, 600); await s.waitForTimeout(200);
  await s.hover(`#rayListe [data-git="#/c/${ca}"]`); await s.waitForTimeout(300); await s.click('#lyUst [data-ca-menu]'); await s.waitForTimeout(200);
  const ok = await s.$eval('#caMenu', (m) => !m.hidden && m.dataset.hedef);
  await s.click('#caMenu [data-cmc="cop"]'); await s.waitForSelector('#bildirim.acik.eylemli', { timeout: 5000 });
  const bildirim = await s.$eval('#bildirim', (b) => b.textContent);
  const gitti = !(await (await fetch(`${KOK}/api/calisma`)).json()).calisma_alanlari.some((x) => x.id === ca);
  await s.click('#bildirim button'); await s.waitForTimeout(1500);
  const geldi = (await (await fetch(`${KOK}/api/calisma`)).json()).calisma_alanlari.find((x) => x.id === ca);
  if (!satirlar.includes("Çöp'e taşı") || !satirlar.includes('Yeniden adlandır')) hatalar.push('sağ tık menüsü eksik');
  if (ok !== 'ca:' + ca) hatalar.push('liste başındaki ▾ menüyü açmadı');
  if (!gitti) hatalar.push("Çöp'e taşı çalışma alanını kaldırmadı");
  if (!geldi || !geldi.alanlar.some((a) => a.id === alan)) hatalar.push('Geri al çalışma alanını alanıyla getirmedi');
  return { satirlar, ok, bildirim, gitti, geri_geldi: !!geldi, adres: decodeURIComponent(new URL(s.url()).hash) };
});
await t.close();
temizle();
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

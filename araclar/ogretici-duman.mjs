// Öğretici dersler duman sınaması (K-052, K-062): node araclar/ogretici-duman.mjs (sunucu açıkken). Headless; Codex çağrılmaz.
// "Öğren deneme" adıyla öğretici kurulur: yedi ders alanı, Defter'de Dene listesi, Bilgi okuma sayfası, Çizim'de dört öğe.
// Adımlar yapılınca Defter'deki satır kendiliğinden işaretlenir: Defter'e yazmak, Bilgi'ye geçmek, bölüm etiketi, tuvale öğe
// (tuval penceresinin isteği), Ortak beyne gitmek. Çalışma alanı sayfası ilerlemeyi gösterir, Göster yeri ışıklar.
// İkinci kurulum çoğaltmaz; ⌘K'da "Beyin'i öğren" ve turun son kartında anahtar var. Sonda kurulan her şey silinir.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
const KOK = 'http://127.0.0.1:4700', REPO = new URL('..', import.meta.url), AD = 'Öğren deneme', EK = ' (deneme)';
const yol = (p) => new URL(p, REPO);
const jsonDegis = (p, f) => { const v = JSON.parse(readFileSync(yol(p), 'utf8')); f(v); writeFileSync(yol(p), JSON.stringify(v, null, 1) + '\n'); };
const calisma = async () => (await fetch(KOK + '/api/calisma')).json();
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const defter = async (alan) => (await post('/api/alan-not', { alan })).sonuc.govde;
const isaretli = (g) => g.split('\n').filter((l) => l.startsWith('- [x] ')).map((l) => l.slice(6));
if ((await calisma()).calisma_alanlari.some((c) => c.ad === AD)) { console.log(`"${AD}" zaten var; önceki sınama yarım kalmış, elle sil.`); process.exit(1); }
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
// Yüklenemeyen betik sayfa hatası vermez (5 Ekim'de toplu koşuda bir kez ogreticiKur tanımsız kaldı); hangisi düştüyse çıktıya yazılır
const yuklenmeyen = [];
s.on('requestfailed', (r) => { if (r.url().endsWith('.js')) yuklenmeyen.push(r.url().replace(KOK, '') + ' ' + (r.failure()?.errorText || '')); });
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); hatalar.push(ad); } };
await s.addInitScript(() => { localStorage.setItem('beyin:kurulum', 'bitti'); localStorage.setItem('beyin:oneri', 'kapali'); });
let ca = null;
const ders = (k) => ca.alanlar.find((a) => a.ders === k);
const temizle = () => {
  if (!ca) return;
  const sayfalar = new Set(ca.alanlar.map((a) => a.sayfa));
  jsonDegis('calisma.json', (c) => { c.calisma_alanlari = c.calisma_alanlari.filter((x) => x.id !== ca.id); });
  jsonDegis('panolar/canvas.json', (v) => {
    v.pages = v.pages.filter((x) => !sayfalar.has(x.id));
    for (const [k, n] of Object.entries(v.notes || {})) if (sayfalar.has(n.page)) delete v.notes[k];
  });
  jsonDegis('.beyin-projects.json', (p) => { for (const k of Object.keys(p.folders)) if (p.folders[k] === ca.id) delete p.folders[k]; });
  for (const a of ca.alanlar) for (const d of [`notlar/${a.id}`, `sayfalar/${a.id}`]) rmSync(yol(d), { recursive: true, force: true });
  rmSync(yol(`ham/kaynaklar/${ca.id}`), { recursive: true, force: true });
};

try {
  await adim('kur', async () => {
    await s.goto(KOK + '/#/ortak'); await s.waitForSelector('#rayListe .ray-kare', { timeout: 15000 });
    await s.evaluate(([ad, ek]) => window.ogreticiKur({ ad, ek, ikonCiz: false }), [AD, EK]);
    ca = (await calisma()).calisma_alanlari.find((c) => c.ad === AD);
    await s.waitForSelector('.og-ders', { timeout: 15000 });
    return { ogretici: ca.ogretici, izole: ca.izole, alanlar: ca.alanlar.map((a) => a.ad), dersler: ca.alanlar.map((a) => a.ders).join(','),
      adres: await s.evaluate(() => location.hash), kart: await s.$$eval('.og-ders', (e) => e.length), meta: await s.$eval('.og-sayfa .sb-meta', (e) => e.textContent), kagit: await s.$eval('.og-sayfa', (e) => e.classList.contains('sayfa')),
      dene: (await defter(ders('defter').id)).includes('- [ ] Bu sayfaya aklındaki bir fikri yaz') };
  });
  await s.screenshot({ path: '.durum/ogretici-sayfa.png' });
  await adim('bilgi_sayfasi', async () => {
    const a = ders('bilgi');
    await s.goto(`${KOK}/#/c/${ca.id}/${a.id}/bilgi`); await s.waitForSelector('#syBilgi .bl-ozet', { timeout: 15000 }); await s.waitForTimeout(400);
    return await s.evaluate(() => ({ ozet: document.querySelector('.bl-ozet').textContent.includes('Okuma'), bolum: document.querySelectorAll('.bl-bolum2').length,
      tablo: document.querySelectorAll('.bl-tablo').length, defterCip: document.querySelectorAll('.bl-cip[data-git]').length, bolumCip: document.querySelectorAll('.bl-cip[data-bl-bolum]').length }));
  });
  await adim('cizim_ogeler', async () => {
    const v = JSON.parse(readFileSync(yol('panolar/canvas.json'), 'utf8'));
    return { oge: Object.values(v.notes || {}).filter((n) => n.page === ders('cizim').sayfa).map((n) => n.kind || 'not') };
  });
  await adim('defter_isaret', async () => {  // Defter'e yeni satır yazınca "fikri yaz" kendiliğinden işaretlenir
    const a = ders('defter');
    await s.goto(`${KOK}/#/c/${ca.id}/${a.id}/yazi`); await s.waitForSelector('#syYazi .sy-metin', { timeout: 15000 }); await s.waitForTimeout(500);
    const son = (await s.$$('#syYazi .sy-metin')).pop(); await son.click(); await s.keyboard.press('End'); await s.keyboard.press('Enter');
    await s.keyboard.type('Deneme fikri: kısa notlar', { delay: 10 });
    await s.waitForFunction(() => [...document.querySelectorAll('#syYazi .sy-kutu')].some((k) => k.checked), null, { timeout: 12000 });
    await s.waitForTimeout(2500);
    return { isaretli: isaretli(await defter(a.id)) };
  });
  await adim('bilgi_isaret', async () => {  // Bilgi sekmesine geçmek ve bölüm etiketi
    const a = ders('bilgi');
    await s.goto(`${KOK}/#/c/${ca.id}/${a.id}/yazi`); await s.waitForSelector('[data-sy-sekme="bilgi"]', { timeout: 15000 }); await s.waitForTimeout(500);
    await s.click('[data-sy-sekme="bilgi"]'); await s.waitForSelector('#syBilgi .bl-cip[data-bl-bolum]', { timeout: 15000 }); await s.waitForTimeout(800);
    await s.click('#syBilgi .bl-cip[data-bl-bolum]'); await s.waitForTimeout(2500);
    return { isaretli: isaretli(await defter(a.id)) };
  });
  await adim('cizim_isaret', async () => {  // Çizim sekmesi ve tuval penceresinden gelen "öğe ekle" isteği
    const a = ders('cizim');
    await s.goto(`${KOK}/#/c/${ca.id}/${a.id}/yazi`); await s.waitForSelector('[data-sy-sekme="cizim"]', { timeout: 15000 }); await s.waitForTimeout(400);
    await s.click('[data-sy-sekme="cizim"]'); await s.waitForSelector('#icerik iframe', { timeout: 15000 }); await s.waitForTimeout(2000);
    const fr = s.frames().find((x) => x.url().includes('/pano') || x !== s.mainFrame());
    await fr.evaluate((sayfa) => fetch('/api/tuval-oge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is: 'ekle', tur: 'not', sayfa, x: 520, y: 260, text: 'Sınama' }) }), a.sayfa);
    await s.waitForTimeout(2500);
    return { isaretli: isaretli(await defter(a.id)) };
  });
  await adim('ortak_isaret', async () => {  // her yerde geçerli adım: Ortak beyne gitmek
    await s.goto(`${KOK}/#/ortak`); await s.waitForTimeout(2500);
    return { isaretli: isaretli(await defter(ders('ortak').id)) };
  });
  await adim('ilerleme_ve_goster', async () => {
    await s.goto(`${KOK}/#/c/${ca.id}`); await s.waitForSelector('.og-ders', { timeout: 15000 }); await s.waitForTimeout(600);
    const kartlar = await s.$$eval('.og-ders small', (e) => e.map((x) => x.textContent));
    await s.click('.og-ders[data-og-ders="2"]'); await s.waitForTimeout(500);
    const yan = await s.$eval('.og-yan .og-etiket', (e) => e.textContent);
    const bitenSatir = await s.$$eval('.og-adimlar li.bitti', (e) => e.length);
    await s.screenshot({ path: '.durum/ogretici-ilerleme.png' });
    await s.click('[data-og-goster]'); await s.waitForSelector('#ogIsik .og-balon', { timeout: 8000 }); await s.waitForTimeout(1500);
    const isik = await s.evaluate(() => ({ halka: !document.querySelector('#ogIsik .og-halka').hidden, metin: document.querySelector('#ogIsik .og-balon p').textContent, adres: location.hash }));
    await s.screenshot({ path: '.durum/ogretici-goster.png' });
    await s.keyboard.press('Escape'); await s.waitForTimeout(200);
    return { kartlar, yan, bitenSatir, ...isik, kapandi: !(await s.$('#ogIsik')) };
  });
  await adim('ikinci_kurulum', async () => {
    await s.evaluate(([ad, ek]) => window.ogreticiKur({ ad, ek, ikonCiz: false, git: false }), [AD, EK]);
    const c = (await calisma()).calisma_alanlari.filter((x) => x.ad === AD);
    return { calisma: c.length, alan: c[0]?.alanlar.length };
  });
  await adim('komut', async () => {
    await s.keyboard.press('Meta+k'); await s.waitForSelector('#komut:not([hidden])', { timeout: 5000 });
    await s.fill('#komutAra', 'öğren'); await s.waitForTimeout(200);
    const ilk = await s.$$eval('#komutSonuc [data-komut]', (e) => e.map((x) => x.textContent));
    await s.keyboard.press('Escape');
    return { var: ilk.some((x) => x.startsWith("Beyin'i öğren")) };
  });
  await adim('tur_anahtari', async () => {
    await s.evaluate(() => window.turBaslat());
    for (let i = 0; i < 6; i++) { await s.waitForSelector('#tur [data-tur="ileri"]', { timeout: 5000 }); await s.click('#tur [data-tur="ileri"]'); }
    await s.waitForSelector('#tur [data-ogren]', { timeout: 5000 });
    const once = await s.$eval('#tur [data-ogren]', (e) => e.getAttribute('aria-pressed'));
    await s.click('#tur [data-ogren]');
    const sonra = await s.$eval('#tur [data-ogren]', (e) => e.getAttribute('aria-pressed'));
    await s.keyboard.press('Escape');
    return { once, sonra, kapandi: !(await s.$('#tur')) };
  });
} finally {
  await t.close();
  temizle();
}
const kaldi = (await calisma()).calisma_alanlari.some((c) => c.ad === AD);
console.log(JSON.stringify({ sonuc, temizlendi: !kaldi, hatalar, yuklenmeyen }, null, 1));

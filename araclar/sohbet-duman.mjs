// Codex sohbeti duman sınaması (K-073, sakin balon): node araclar/sohbet-duman.mjs (sunucu açıkken). Headless; Codex çağrılmaz.
// Geçmiş ve canlı akış sahte veriyle beslenir (istek tarayıcıda karşılanır), kullanıcının sohbetine ve verisine dokunulmaz.
// Bakılanlar: balon dolgulu ve çerçevesiz, en çok %72; uzun mesaj dört satırda katlanır ve açılır; "Çizim modu" her mesajda
// değil yalnız açılıp kapandığı yerde ayraç; art arda biten adımlar tek satır, basınca açılır; süren adım görünür kalır;
// Codex cevabındaki Çiz, mesajı çizim moduyla gönderir (K-075); pano bloğu sohbette satıra iner, parçası tuvale gider (K-077).
import { chromium } from 'playwright';
const KOK = 'http://127.0.0.1:4700', T = 't-sinama';
const sen = (id, metin, ...ek) => ({ id, type: 'userMessage', content: [...ek.map((e) => ({ type: 'text', text: e })), { type: 'text', text: metin }] });
const codex = (id, text) => ({ id, type: 'agentMessage', text });
const dusun = (id, ozet) => ({ id, type: 'reasoning', summary: [ozet], content: [] });
const komut = (id, command) => ({ id, type: 'commandExecution', command, aggregatedOutput: 'tamam', exitCode: 0, status: 'completed' });
const dosya = (id, ...yollar) => ({ id, type: 'fileChange', status: 'completed', changes: yollar.map((path) => ({ path })) });
const CIZ = '<cizim_modu>açık</cizim_modu>';
const UZUN = Array.from({ length: 40 }, (_, i) => `${i + 1}. satır: hızlı ve zahmetsiz sonuç isteyen, sorumluluk almayan müşteri tarifi`).join('\n');
const gecmis = { thread: T, kok: '/x', sira: 0, calisiyor: false, istekler: [], turlar: [
  { id: 'r1', durum: 'completed', parcalar: [sen('u1', 'Bu notu özetle'), dusun('d1', 'Notu okuyorum'), komut('k1', 'sed -n 1,80p notlar/satis/R-001-hedef-kitle.md'),
    komut('k2', 'rg -n "teklif" notlar/satis'), codex('a1', 'Not üç gruba ayırıyor: mükemmel, mecburi ve gereksiz müşteri.')] },
  { id: 'r2', durum: 'completed', parcalar: [sen('u2', UZUN), codex('a2', 'Bu tarif "gereksiz müşteri" grubuna giriyor.')] },
  { id: 'r3', durum: 'completed', parcalar: [sen('u3', 'Bunu bir pano olarak çiz', CIZ), dusun('d3', 'Panoyu kuruyorum'), komut('k3', 'cat PANO.md'), dosya('f3', '/x/panolar/HedefKitleNotu.dc.html'),
    komut('k4', 'node araclar/pano.mjs HedefKitleNotu.dc.html'), codex('a3', '<pano-yaz ad="HedefKitleNotu.dc.html" baslik="Hedef kitle notu" w="1440" h="900">\n<helmet><style>.k{color:var(--yazi)}</style></helmet>\n<div class="k">Üç müşteri grubu</div>\n</pano-yaz>\nPanoyu Çizim\'e koydum.')] },
  { id: 'r4', durum: 'completed', parcalar: [sen('u4', 'Başlığı büyüt', CIZ), dosya('f4', '/x/panolar/HedefKitleNotu.dc.html'), codex('a4', 'Başlık büyüdü.')] },
  { id: 'r5', durum: 'completed', parcalar: [sen('u5', 'Teşekkürler, şimdilik bu kadar'), codex('a5', 'Tamam.')] },
] };
const olay = (method, params) => `data: ${JSON.stringify({ method, params: { threadId: T, ...params } })}\n\n`;
const basla = (item) => olay('item/started', { item: { ...item, exitCode: null, status: 'inProgress' } }), bitir = (item) => olay('item/completed', { item });
const CANLI = olay('turn/started', {}) + basla(sen('u6', 'Bir de kaynakları tara')) + bitir(sen('u6', 'Bir de kaynakları tara'))
  + basla(komut('c1', 'cat BEYIN.md')) + bitir(komut('c1', 'cat BEYIN.md')) + basla(komut('c2', 'cat PANO.md')) + bitir(komut('c2', 'cat PANO.md'))
  + basla(komut('c3', 'rg -n "kaynak" ham/kaynaklar'))
  // Canlı çizim (K-077): mesajın içinde açık pano bloğu ve sunucunun yayınladığı içerik parçası
  + basla({ id: 'cm', type: 'agentMessage', text: '' }) + olay('item/agentMessage/delta', { itemId: 'cm', delta: '<pano-yaz ad="CanliPano.dc.html" baslik="Canlı pano" w="1440" h="900">\n<div>Başlık' })
  + olay('beyin/pano-akis', { ad: 'CanliPano.dc.html', basla: true, bas: 0, parca: '', baslik: 'Canlı pano', w: 1440, h: 900, x: 0, y: 0 }) + olay('beyin/pano-akis', { ad: 'CanliPano.dc.html', bas: 0, parca: '<div>Başlık' });

const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); hatalar.push(ad); } };
await s.addInitScript(() => { localStorage.setItem('beyin:kurulum', 'bitti'); localStorage.setItem('beyin:oneri', 'kapali'); localStorage.setItem('beyin:sekme:panel', 'codex'); });
await s.route('**/api/codex/gecmis*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(gecmis) }));
let akisSayisi = 0;
const gonderilen = [];
await s.route('**/api/codex/gonder', (r) => { gonderilen.push(r.request().postDataJSON()); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ tamam: true, sonuc: { thread: T } }) }); });
await s.route('**/api/codex/akis*', (r) => r.fulfill({ contentType: 'text/event-stream', body: akisSayisi++ ? '' : CANLI }));
const grup = (i) => s.evaluate((i) => {
  const g = document.querySelectorAll('#cxAkis .cx-grup')[i], bas = g.querySelector('.cx-grup-bas');
  return { satir: bas.hidden ? null : bas.textContent, gorunen: [...g.querySelectorAll('.cx-adim')].filter((a) => a.offsetParent).length, suren: g.querySelectorAll('.cx-suruyor').length };
}, i);
try {
  await adim('balon', async () => {
    await s.goto(KOK + '/#/c/kisisel/satis/cizim'); await s.waitForSelector('#cxAkis .cx-sen', { timeout: 15000 }); await s.waitForTimeout(1200);
    return await s.evaluate(() => {
      const b = document.querySelector('#cxAkis .cx-sen'), st = getComputedStyle(b), akis = document.querySelector('#cxAkis'), ic = akis.clientWidth - 32;
      const enGenis = Math.max(...[...document.querySelectorAll('#cxAkis .cx-sen')].map((x) => x.getBoundingClientRect().width));
      return { adet: document.querySelectorAll('#cxAkis .cx-sen').length, cerceve: st.borderTopWidth, dolgu: st.backgroundColor !== 'rgba(0, 0, 0, 0)' && st.backgroundColor !== getComputedStyle(akis.closest('.cx')).backgroundColor,
        golge: st.boxShadow, enCok72: enGenis <= ic * 0.72 + 1, sagda: Math.round(akis.getBoundingClientRect().right - b.getBoundingClientRect().right) };
    });
  });
  await adim('uzun_mesaj', async () => {
    const olc = () => s.evaluate(() => { const b = document.querySelectorAll('#cxAkis .cx-sen')[1], m = b.querySelector('.cx-sen-metin'); return { dugme: b.querySelector('.cx-devam')?.textContent || null, boy: Math.round(m.getBoundingClientRect().height), kisik: b.classList.contains('cx-kisik') }; });
    const once = await olc();
    await s.click('#cxAkis .cx-devam'); await s.waitForTimeout(150);
    const acik = await olc();
    await s.click('#cxAkis .cx-devam'); await s.waitForTimeout(150);
    const kisaDugme = await s.$$eval('#cxAkis .cx-sen', (e) => e.filter((b) => b.querySelector('.cx-devam')).length);
    return { once, acik, yine: await olc(), dugmeliBalon: kisaDugme };
  });
  await adim('cizim_ayraci', async () => s.evaluate(() => ({ ayrac: [...document.querySelectorAll('#cxAkis .cx-ayrac')].map((a) => a.textContent.trim()),
    onceki: [...document.querySelectorAll('#cxAkis .cx-ayrac')].map((a) => a.nextElementSibling?.textContent.trim().slice(0, 24)),
    cipteMod: [...document.querySelectorAll('#cxAkis .cx-sen-cip')].some((c) => c.textContent.includes('Çizim modu')) })));
  await adim('adim_grubu', async () => {
    const ilk = await grup(0), cizen = await grup(1), tek = await grup(2);
    await s.click('#cxAkis .cx-grup .cx-grup-bas'); await s.waitForTimeout(150);
    const acik = await grup(0), genis = await s.$eval('#cxAkis .cx-grup-bas', (b) => b.getAttribute('aria-expanded'));
    await s.click('#cxAkis .cx-grup .cx-grup-bas'); await s.waitForTimeout(150);
    return { ilk, cizen, tek, acik, genis, kapandi: (await grup(0)).gorunen };
  });
  await adim('pano_blogu', async () => {  // K-077: pano bloğu sohbette görünmez, yerine "Çizdi / Çiziyor" satırı; parça tuvale iletilir
    await s.waitForSelector('#cxAkis .cx-pano-cip.cx-suruyor', { timeout: 8000 });
    const tuval = s.frames().find((f) => f !== s.mainFrame() && f.parentFrame() === s.mainFrame());
    return { ...(await s.evaluate(() => ({ cizdi: [...document.querySelectorAll('#cxAkis .cx-pano-cip:not(.cx-suruyor)')].map((c) => c.textContent), ciziyor: [...document.querySelectorAll('#cxAkis .cx-pano-cip.cx-suruyor')].map((c) => c.textContent),
      hamGorunuyor: /pano-yaz|<div|<helmet/.test(document.querySelector('#cxAkis').innerText), cevap: [...document.querySelectorAll('#cxAkis .cx-codex')].some((c) => c.innerText.includes("Panoyu Çizim'e koydum.")) }))),
      tuvaleGitti: await tuval.evaluate(() => akislar.has('CanliPano.dc.html')) };
  });
  await adim('suren_adim', async () => {
    await s.waitForSelector('#cxAkis .cx-suruyor', { timeout: 8000 });
    const son = await s.$$eval('#cxAkis .cx-grup', (g) => g.length - 1);
    return { ...(await grup(son)), canli: await s.$eval('#cxAkis .cx-canli', (c) => !c.hidden) };
  });
  await s.evaluate(() => { const a = document.querySelector('#cxAkis'); a.style.scrollBehavior = 'auto'; a.scrollTop = a.scrollHeight; });
  await s.screenshot({ path: '.durum/sohbet.png' });
  await adim('cevabi_ciz', async () => {  // K-075: Codex cevabında tek tık Çiz; mesaj çizim moduyla bu alanın Codex'ine gider
    const cevap = s.locator('#cxAkis .cx-codex').first();
    await cevap.scrollIntoViewIfNeeded(); await cevap.hover(); await s.waitForTimeout(250); await cevap.screenshot({ path: '.durum/sohbet-ciz.png' }); await cevap.locator('[data-mesaj-ciz]').click(); await s.waitForTimeout(400);
    const g = gonderilen.at(-1) || {};
    return { dugme: await s.$$eval('#cxAkis [data-mesaj-ciz]', (e) => e.length), gitti: gonderilen.length, ciz: g.ciz, metin: (g.metin || '').slice(0, 60), cizDugmesi: await s.$eval('#cxCiz', (b) => b.getAttribute('aria-pressed')) };
  });
} finally { await t.close(); }
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

// Canlı çizim duman sınaması (K-077): node araclar/canli-cizim-duman.mjs (sunucu açıkken). Headless; Codex çağrılmaz.
// Sunucunun çizim akışında yaptığı (yer tutucu dosya, tuvale koyma, sonda gerçek dosya) elle yapılır; içerik parçaları tuvale
// kabuğun yolladığı iletiyle (panoAkis) verilir. Bakılanlar: pano tuvalde kendi yerinde, içerik yazıldıkça görünür, imleç
// yazılan yere iner ve "Codex çiziyor" yazar; bitince akış çerçevesi kalkar, panonun gerçeği yüklenir. Tuval çizim sürerken
// açılmış gibi baştaki parçalar kaçarsa sunucudaki hâliyle tamamlanır. Geçici alanda çalışır, açtığını kaldırır.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700', REPO = new URL('..', import.meta.url), yol = (p) => new URL(p, REPO);
const { ca, alan, temizle } = await geciciAlan('Canlı çizim deneme', 'Çizim alanı');
const sayfa = 'page-' + alan, AD = 'CanliCizim' + alan.replace(/[^a-z0-9]/gi, '') + '.dc.html', AD2 = AD.replace('.dc.html', 'Iki.dc.html');
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const sar = (govde, baslik) => `<!doctype html>\n<html lang="tr"><head><meta charset="utf-8"><title>${baslik}</title><script src="./support.js"></script></head><body><x-dc>\n${govde}\n</x-dc><script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1200,"height":800}}'>class Component extends DCLogic { renderVals(){ return {}; } }</script></body></html>\n`;
const BOS = '<helmet><link rel="stylesheet" href="./tema.css"></helmet>\n<div style="width: 1200px; height: 800px; background: var(--zemin)"></div>';
const SATIRLAR = Array.from({ length: 9 }, (_, i) => `<p class="satir">${i + 1}. adım: müşteriyi dinle, engeli bul, teklifi ona göre kur</p>`);
const GOVDE = '<helmet><link rel="stylesheet" href="./tema.css"><style>.kok{box-sizing:border-box;width:1200px;height:800px;padding:48px;background:var(--zemin);color:var(--yazi);font-family:Arial,sans-serif}.kok h1{font-size:44px;margin:0 0 24px}.satir{font-size:26px;margin:0 0 22px;padding:14px 18px;background:var(--kart);border-radius:12px}</style></helmet>\n'
  + '<div class="kok"><h1>Canlı çizim denemesi</h1>\n' + SATIRLAR.join('\n') + '\n</div>';
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 180); hatalar.push(ad); } };
await s.addInitScript(() => { localStorage.setItem('beyin:kurulum', 'bitti'); localStorage.setItem('beyin:oneri', 'kapali'); });
const tuval = () => s.frames().find((f) => f.url().includes('/pano') || (f !== s.mainFrame() && f.parentFrame() === s.mainFrame()));
const yolla = (veri) => s.evaluate((v) => document.querySelector('#icerik iframe').contentWindow.postMessage({ beyin: 'panoAkis', ...v }, location.origin), veri);
const durum = (ad) => tuval().evaluate((ad) => {
  const p = document.querySelector(`.pano[data-pano="${ad}"]`), f = p?.querySelector('iframe.akis'), im = document.querySelector('.codex-imlec');
  return { pano: !!p, akis: !!f, cerceve: !!p?.classList.contains('akiyor'), satir: f ? f.contentDocument.querySelectorAll('.satir').length : -1, baslik: f?.contentDocument.querySelector('h1')?.textContent || '',
    imlec: im && !im.hidden ? im.querySelector('span').textContent : '', imlecY: im ? Math.round(parseFloat(im.style.top)) : 0,
    betik: f ? f.contentDocument.querySelectorAll('script').length : 0 };
}, ad);
const akit = async (ad, metin, bas = 0, boy = 90) => { for (let i = 0; i < metin.length; i += boy) { await yolla({ ad, bas: bas + i, parca: metin.slice(i, i + boy) }); await s.waitForTimeout(25); } };
try {
  await adim('akarken', async () => {
    await s.goto(`${KOK}/#/c/${ca}/${alan}/cizim`); await s.waitForSelector('#icerik iframe', { timeout: 15000 }); await s.waitForTimeout(2500);
    writeFileSync(yol('panolar/' + AD), sar(BOS, 'Canlı çizim'));  // sunucunun blok açılınca yaptığı: yer tutucu ve tuvale koyma
    const yer = (await post('/api/pano-yerlestir', { ad: AD, sayfa, baslik: 'Canlı çizim', w: 1200, h: 800 })).sonuc;
    await yolla({ ad: AD, basla: true, bas: 0, parca: '', baslik: 'Canlı çizim', w: 1200, h: 800, ...yer });
    const yari = GOVDE.indexOf(SATIRLAR[3]);
    await akit(AD, GOVDE.slice(0, yari));
    await tuval().waitForSelector(`.pano[data-pano="${AD}"] iframe.akis`, { timeout: 8000 }); await s.waitForTimeout(500);
    const ilk = await durum(AD);
    await s.screenshot({ path: '.durum/canli-cizim-yari.png' });
    await akit(AD, GOVDE.slice(yari), yari); await s.waitForTimeout(400);
    const son = await durum(AD);
    return { ilk, son, imlecIndi: son.imlecY > ilk.imlecY };
  });
  await adim('bitince', async () => {
    writeFileSync(yol('panolar/' + AD), sar(GOVDE, 'Canlı çizim'));  // sunucunun blok kapanınca yaptığı: gerçek dosya
    await yolla({ ad: AD, bas: GOVDE.length, parca: '', bitti: true });
    await tuval().waitForFunction((ad) => !document.querySelector(`.pano[data-pano="${ad}"] iframe.akis`), AD, { timeout: 12000 });
    await s.waitForTimeout(600);
    await s.screenshot({ path: '.durum/canli-cizim-bitti.png' });
    return await tuval().evaluate((ad) => { const p = document.querySelector(`.pano[data-pano="${ad}"]`), f = p.querySelector('iframe');
      return { akis: !!p.querySelector('iframe.akis'), cerceve: p.classList.contains('akiyor'), gercek: !!f && f.src.includes(ad), gercekSatir: f?.contentDocument?.querySelectorAll('.satir').length ?? -1 }; }, AD);
  });
  await adim('sonradan_acilan', async () => {  // baştaki parçalar kaçtı: ilk gelen parça ortadan; tuval eksik başı sunucudan alır
    writeFileSync(yol('panolar/' + AD2), sar(BOS, 'İkinci'));
    await post('/api/pano-yerlestir', { ad: AD2, sayfa, baslik: 'İkinci', w: 1200, h: 800 });
    const orta = GOVDE.indexOf(SATIRLAR[5]), devam = GOVDE.indexOf(SATIRLAR[6]);
    await s.route('**/api/pano-akis', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ [AD2]: { icerik: GOVDE.slice(0, orta), baslik: 'İkinci', w: 1200, h: 800 } }) }));
    await yolla({ ad: AD2, bas: orta, parca: GOVDE.slice(orta, devam) });
    await tuval().waitForSelector(`.pano[data-pano="${AD2}"] iframe.akis`, { timeout: 8000 }); await s.waitForTimeout(600);
    return await durum(AD2);
  });
} finally {
  await t.close();
  const c = JSON.parse(readFileSync(yol('panolar/canvas.json'), 'utf8'));
  for (const ad of [AD, AD2]) { delete c.boards[ad]; c.order = (c.order || []).filter((x) => x !== ad); rmSync(yol('panolar/' + ad), { force: true }); }
  writeFileSync(yol('panolar/canvas.json'), JSON.stringify(c, null, 1) + '\n');
  temizle();
}
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

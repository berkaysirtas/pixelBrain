// Doğrulama duman sınaması (K-069): node araclar/dogrula-duman.mjs (sunucu açıkken). Headless, Codex turu açmaz.
// Geçici alana üç soru bırakır; üstteki Codex düğmesinde rozet sayıyı gösterir mi, rozet listeyi açar ama Codex panelini
// açıp kapatmaz mı; Düzelt düzeltilmiş metni, Evet olduğu gibi Bilgi'ye yazar mı; Hayır yazmaz ve bir daha sorulmaz mı;
// Defter'e dokunulmaz mı. Açtığını kaldırır.
import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const { ca, alan, temizle } = await geciciAlan('Doğrula deneme', 'Doğrula alanı');
const t = await chromium.launch(); const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
const sayfa = (ne) => readdirSync(`sayfalar/${alan}`).map((f) => readFileSync(`sayfalar/${alan}/${f}`, 'utf8')).find((x) => x.includes(ne)) || '';
try {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`); await s.waitForSelector('#syYazi .sy-bloklar'); await s.waitForTimeout(600);
  const defterOnce = sayfa('ana: evet');
  for (const [iddia, hedef, bolum] of [['Ekim hedefi 12 görüşme', 'bilgi', 'Hedefler'], ['Deneme tercihi: duman sınaması reddeder', 'tercih', ''], ['Demo sonrası takip tek kalıpta', 'bilgi', '']])
    await post('/api/dogrula-ekle', { alan, iddia, hedef, bolum });
  sonuc.ayniYeniden = (await post('/api/dogrula-ekle', { alan, iddia: 'ekim hedefi 12 görüşme!', hedef: 'bilgi', bolum: '' })).sonuc;
  await s.evaluate(() => durumIzle()); await s.waitForSelector('.dg-rozet', { timeout: 8000 });
  sonuc.rozet = await s.textContent('.dg-rozet');
  const panel = () => s.$eval('#icerik', (e) => e.classList.contains('panel-kapali'));
  const panelOnce = await panel();
  await s.click('.dg-rozet'); await s.waitForSelector('#dgKutu');
  sonuc.panelAyni = (await panel()) === panelOnce;
  sonuc.baslik = await s.textContent('#dgKutu .dg-bas');
  sonuc.nereye = await s.$$eval('#dgKutu .dg-nere', (e) => e.map((x) => x.textContent.split('→')[1].trim()));
  await s.screenshot({ path: '.durum/dogrula.png' });
  await s.keyboard.press('Escape'); sonuc.escKapatir = !(await s.$('#dgKutu'));
  await s.click('.dg-rozet'); await s.waitForSelector('#dgKutu');
  // Düzelt: ilk iddia yerinde düzeltilir, Enter kaydeder
  await s.click('#dgKutu .dg-oge:nth-of-type(2) [data-dg-karar="duzelt"]');
  await s.keyboard.type('Ekim hedefi: kliniklerde 12 görüşme'); await s.keyboard.press('Enter');
  await s.waitForFunction(() => document.querySelectorAll('#dgKutu .dg-oge').length === 2, null, { timeout: 8000 });
  // Hayır: tercih yazılmaz
  const tercih = await s.$('#dgKutu .dg-oge:has(.dg-nere:text("Hafıza")) [data-dg-karar="hayir"]');
  await tercih.click(); await s.waitForFunction(() => document.querySelectorAll('#dgKutu .dg-oge').length === 1, null, { timeout: 8000 });
  // Evet: kalan olduğu gibi yazılır, liste ve rozet kalkar
  await s.click('#dgKutu [data-dg-karar="evet"]'); await s.waitForFunction(() => !document.querySelector('#dgKutu'), null, { timeout: 8000 });
  sonuc.rozetKalkti = !(await s.$('.dg-rozet'));
  const bilgi = sayfa('bilgi: evet');
  sonuc.bilgi = { hedefler: /## Hedefler\n- Ekim hedefi: kliniklerde 12 görüşme \(sen doğruladın/.test(bilgi), dogrulananlar: /## Doğrulananlar\n- Demo sonrası takip tek kalıpta/.test(bilgi), tercihYok: !bilgi.includes('Deneme tercihi') };
  sonuc.tercihYazilmadi = !existsSync('knowledge/tercihler/deneme-tercihi-duman-sinamasi-reddeder.md');
  sonuc.defterAyni = sayfa('ana: evet') === defterOnce;
  sonuc.reddedilenYeniden = (await post('/api/dogrula-ekle', { alan, iddia: 'Deneme tercihi: duman sınaması reddeder', hedef: 'tercih', bolum: '' })).sonuc;
  sonuc.bekleyen = (await (await fetch(KOK + '/api/dogrula')).json()).filter((x) => x.alan === alan).length;
} finally {
  await t.close(); temizle();
}
const b = sonuc.bilgi || {};
const tamam = sonuc.rozet === '3' && sonuc.ayniYeniden === false && sonuc.panelAyni && sonuc.escKapatir && sonuc.rozetKalkti && b.hedefler && b.dogrulananlar && b.tercihYok
  && sonuc.tercihYazilmadi && sonuc.defterAyni && sonuc.reddedilenYeniden === false && sonuc.bekleyen === 0;
if (!tamam) hatalar.push('HATA: beklenen sonuç çıkmadı');
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
process.exit(hatalar.length ? 1 : 0);

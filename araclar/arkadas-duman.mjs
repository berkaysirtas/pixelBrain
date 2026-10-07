// Yazı arkadaşı duman sınaması (K-074): node araclar/arkadas-duman.mjs (sunucu açıkken). Headless; Codex çağrılmaz.
// Kural: Codex kendiliğinden koşmaz; sen bir Defter'e yazarken arkada yalnız bir kez okur. Öneri isteği tarayıcıda karşılanır
// ve sayılır: yazınca bir kez gider, daha çok yazınca ve Defter'e yeniden gelince yeniden gitmez; ⋯ › "Bu nota baksın" ile
// (senin isteğinle) bir kez daha gider. Geçici alanda çalışır, açtığını kaldırır.
import { chromium } from 'playwright';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const { ca, alan, temizle } = await geciciAlan('Arkadaş deneme', 'Arkadaş alanı');
const t = await chromium.launch(); const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); hatalar.push(ad); } };
await s.addInitScript(() => { localStorage.setItem('beyin:kurulum', 'bitti'); localStorage.setItem('beyin:oneri', 'acik'); });
let istek = 0;
await s.route('**/api/codex/oneri', (r) => { istek++; r.fulfill({ contentType: 'application/json', body: JSON.stringify({ tamam: true, sonuc: [{ tur: 'soru', alinti: 'klinik sahipleri', yeni: 'Hangi büyüklükteki klinikler?', neden: 'Hedef kitle geniş kalmış.' }] }) }); });
const yaz = async (metin) => { const son = (await s.$$('#syYazi .sy-metin')).pop(); await son.click(); await s.keyboard.press('End'); await s.keyboard.type(' ' + metin, { delay: 5 }); };
const defter = async () => { await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`); await s.waitForSelector('#syYazi .sy-metin', { timeout: 15000 }); await s.waitForTimeout(600); };
try {
  await adim('yazinca_bir_kez', async () => {
    await defter();
    const acilista = istek;
    await yaz('Hedef kitlem klinik sahipleri; randevu kaçırma sorununu çözmek istiyorum, önce ihtiyacı dinleyeceğim.');
    await s.waitForSelector('#syYazi .sy-oneri', { timeout: 12000 });
    return { acilista, istek, kart: await s.$$eval('#syYazi .sy-oneri', (e) => e.length) };
  });
  await adim('daha_cok_yazinca_yok', async () => {  // başka yere gidip gelince düzenleyici yeniden kurulur (bekleme sınırı sıfırlanır): izin olsaydı 3,5 sn sonra giderdi
    await yaz('Sonra teklifi üç pakete ayırıp her birinde tek bir sonucu öne çıkaracağım, fiyatı en sona bırakacağım.');
    await s.waitForTimeout(1500);
    await s.goto(`${KOK}/#/ortak`); await s.waitForTimeout(800); await defter();
    await yaz('Görüşmenin sonunda bir sonraki adımı ben önereceğim ve tarihi aynı konuşmada netleştireceğim.');
    await s.waitForTimeout(7000);
    return { istek, yaziKaldi: await s.$eval('#syYazi', (e) => e.innerText.includes('netleştireceğim')) };
  });
  await adim('isteyince_bir_kez_daha', async () => {
    await s.click('#syUc'); await s.click('#syAcilir [data-not-bak]');
    await s.waitForFunction(() => /öneri kenarda|bir şey bulmadı/.test(document.querySelector('#bildirim').textContent), null, { timeout: 12000 });
    return { istek, bildirim: await s.$eval('#bildirim', (e) => e.textContent), menuKapandi: await s.$eval('#syAcilir', (e) => e.hidden) };
  });
  await adim('bilgi_sekmesinden', async () => {  // başka sekmeden istenirse Defter'e geçer, öneri orada görünür
    await s.click('[data-sy-sekme="bilgi"]'); await s.waitForTimeout(900);
    const once = istek;
    await s.click('#syUc'); await s.click('#syAcilir [data-not-bak]');
    await s.waitForFunction((n) => /öneri kenarda|bir şey bulmadı/.test(document.querySelector('#bildirim').textContent) && window.__n !== n, once, { timeout: 12000 }); await s.waitForTimeout(600);
    return { once, istek, adres: new URL(s.url()).hash.split('/').pop() };
  });
  await adim('yeniden_acinca', async () => {  // kural programın açık kaldığı süre için: yeniden açınca yazarken bir kez daha okur
    const once = istek;
    await s.reload(); await s.waitForSelector('#syYazi .sy-metin', { timeout: 15000 }); await s.waitForTimeout(600);
    await yaz('Ertesi gün kısa bir özet mesajı gönderip kararını soracağım, ısrar etmeyeceğim.');
    await s.waitForFunction(() => document.querySelectorAll('#syYazi .sy-oneri').length > 0, null, { timeout: 12000 }).catch(() => {});
    return { once, istek };
  });
} finally { await t.close(); temizle(); }
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

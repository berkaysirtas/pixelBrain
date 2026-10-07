// Alan kaldır duman sınaması (K-055): node araclar/alan-sil-duman.mjs (sunucu açıkken). Headless.
// Panolu, tuval öğeli, kararlı ve verili alanı galeri kartının ⋯ menüsünden kaldırır; hepsinin çöpe gidip Çöp'ten her şeyiyle
// geri geldiğini, kalıcı silmede pano dosyasının da gittiğini sınar. Liste satırında ⋯ ve sağ tık, koyu temada tuval. Açtığını kaldırır.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const { ca, alan, temizle } = await geciciAlan('Silme deneme', 'Silinecek alan');
const sayfa = 'page-' + alan, sonuc = {}, hatalar = [];
let alan2 = '';
const t = await chromium.launch(); const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
try {
  await post('/api/tuval-oge', { is: 'ekle', sayfa, tur: 'metin', x: 10, y: 10, text: 'öğe' });
  const c = JSON.parse(readFileSync('panolar/canvas.json', 'utf8'));
  c.boards['SilmeDeneme.dc.html'] = { page: sayfa, x: 0, y: 0, w: 400, h: 300, title: 'deneme' }; c.order.push('SilmeDeneme.dc.html');
  writeFileSync('panolar/canvas.json', JSON.stringify(c, null, 1) + '\n'); writeFileSync('panolar/SilmeDeneme.dc.html', '<!doctype html><p>deneme</p>');
  mkdirSync(`notlar/${alan}`, { recursive: true }); writeFileSync(`notlar/${alan}/S-001-deneme.md`, '---\nno: S-001\n---\ndeneme\n');
  mkdirSync(`ham/kaynaklar/${ca}/${alan}`, { recursive: true }); writeFileSync(`ham/kaynaklar/${ca}/${alan}/a.txt`, 'veri');
  await s.goto(`${KOK}/#/c/${ca}`); await s.waitForSelector('.ca-kart'); await s.waitForTimeout(500);
  await s.hover('.ca-kart'); await s.click('.ca-kart .ca-uc'); await s.waitForTimeout(200);
  sonuc.menu = await s.$$eval('#caMenu:not([hidden]) .cm-ad', (e) => e.map((x) => x.textContent));
  sonuc.adres = new URL(s.url()).hash;
  await s.screenshot({ path: '.durum/alan-menu.png', clip: { x: 0, y: 0, width: 900, height: 500 } });
  await s.click('[data-am-kaldir]'); sonuc.soru = await s.textContent('[data-am-kaldir] .cm-ad'); await s.click('[data-am-kaldir]'); await s.waitForTimeout(1200);
  const k = JSON.parse(readFileSync('sayfalar/.cop/kaldirilanlar.json', 'utf8')).find((x) => x.alan?.id === alan);
  const c2 = JSON.parse(readFileSync('panolar/canvas.json', 'utf8'));
  sonuc.cop = { ek: k?.ek, pano: Object.keys(k?.panolar || {}), oge: Object.keys(k?.ogeler || {}).length, tuvaldenGitti: !c2.boards['SilmeDeneme.dc.html'] && !Object.values(c2.notes).some((n) => n.page === sayfa), notlarGitti: !existsSync(`notlar/${alan}`), veriGitti: !existsSync(`ham/kaynaklar/${ca}/${alan}`) };
  sonuc.kartKalmadi = !(await s.$('.ca-kart'));
  await s.goto(`${KOK}/#/cop`); await s.waitForSelector('.cop-satir'); await s.waitForTimeout(300);
  sonuc.copSatir = await s.$eval(`.cop-satir:has-text("Silinecek alan") small`, (e) => e.textContent);
  const g = await post('/api/cop-geri', { no: k.no });
  const c3 = JSON.parse(readFileSync('panolar/canvas.json', 'utf8'));
  sonuc.geri = { yer: g.sonuc, pano: !!c3.boards['SilmeDeneme.dc.html'], oge: Object.values(c3.notes).some((n) => n.page === sayfa), notlar: existsSync(`notlar/${alan}/S-001-deneme.md`), veri: existsSync(`ham/kaynaklar/${ca}/${alan}/a.txt`), copBos: !existsSync('sayfalar/.cop/' + k.no) };
  // ikinci kez kaldır ve kalıcı sil: pano dosyası da gitsin
  await post('/api/alan-kaldir', { alan }); const k2 = JSON.parse(readFileSync('sayfalar/.cop/kaldirilanlar.json', 'utf8')).find((x) => x.alan?.id === alan);
  await post('/api/cop-sil', { no: k2.no });
  sonuc.kalici = { panoDosyasi: existsSync('panolar/SilmeDeneme.dc.html'), ek: existsSync('sayfalar/.cop/' + k2.no) };
  // liste satırında ⋯ ve sağ tık; koyu tuval
  alan2 = (await post('/api/alan', { calisma: ca, ad: 'Liste alanı ' + Date.now().toString(36), ikon_ciz: false })).sonuc;
  await s.goto(`${KOK}/#/c/${ca}/${alan2}/cizim`); await s.reload(); await s.waitForSelector('#icerik iframe'); await s.waitForTimeout(1200);
  await s.hover(`#rayListe [data-git="#/c/${ca}"]`); await s.waitForTimeout(500); await s.hover(`.agac-satir[data-alan="${alan2}"]`); sonuc.listeUc = await s.isVisible(`.agac-satir[data-alan="${alan2}"] .agac-uc`);
  await s.click(`.agac-satir[data-alan="${alan2}"]`, { button: 'right' }); sonuc.sagTik = await s.isVisible('#caMenu [data-am-kaldir]');
  await s.keyboard.press('Escape'); await s.mouse.click(700, 500);
  await s.evaluate(() => { localStorage.setItem('beyin:gorunus:tema', 'koyu'); }); await s.reload(); await s.waitForSelector('#icerik iframe'); await s.waitForTimeout(1500);
  sonuc.koyuTuval = await s.frameLocator('#icerik iframe').locator('html').evaluate((h) => [h.dataset.tema, getComputedStyle(document.body).backgroundColor]);
  await s.screenshot({ path: '.durum/koyu-cizim.png' });
  await s.evaluate(() => { localStorage.removeItem('beyin:gorunus:tema'); });
  await post('/api/alan-kaldir', { alan: alan2 });
} finally {
  await t.close();
  const kl = JSON.parse(readFileSync('sayfalar/.cop/kaldirilanlar.json', 'utf8'));
  for (const x of kl.filter((x) => x.calisma === ca)) await post('/api/cop-sil', { no: x.no });
  temizle();
  for (const d of [`notlar/${alan2 || '-'}`, `sayfalar/${alan2 || '-'}`]) rmSync(d, { recursive: true, force: true });
}
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

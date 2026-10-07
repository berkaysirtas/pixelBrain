// Ayarlar, Ben, ⋯ menüsü ve Entegrasyonlar duman sınaması (K-060, K-061, K-065): node araclar/ayar-duman.mjs (sunucu açıkken). Headless.
// ⋯ menüsünün grupları; alanı yeniden adlandırma ve başka çalışma alanına taşıma; Ayarlar › Çalışma alanları satırları, izole
// anahtarı, çalışma alanını alanlarıyla Çöp'e atıp birlikte geri getirme; Ben'in Ortak beyinde sekme olması. Açtığını kaldırır.
import { chromium } from 'playwright';
import { readFileSync, rmSync } from 'fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const calisma = async () => (await fetch(KOK + '/api/calisma')).json();
const { ca, alan, temizle } = await geciciAlan('Ayar deneme', 'Ayar alanı');
const ca2 = (await post('/api/calisma', { ad: 'Ayar hedef', ikon_ciz: false })).sonuc;
const t = await chromium.launch(); const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
try {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`); await s.waitForSelector('#syYazi .sy-bloklar'); await s.waitForTimeout(600);
  await s.click('#syUc'); await s.waitForTimeout(200);
  sonuc.menu = await s.$$eval('#syAcilir .sy-acilir-bas, #syAcilir button', (e) => e.map((x) => x.textContent.trim().split('\n')[0].slice(0, 28)));
  sonuc.baslikIpucu = await s.$eval('#syYazi .sy-baslik', (e) => e.title);
  await s.click('#syAcilir [data-am-adlandir]'); await s.waitForSelector('#cmAd');
  await s.fill('#cmAd', 'Yeni adlı alan'); await s.press('#cmAd', 'Enter'); await s.waitForTimeout(1500);
  const c1 = await calisma();
  sonuc.yeniAd = c1.calisma_alanlari.find((x) => x.id === ca).alanlar.find((a) => a.id === alan)?.ad;
  sonuc.yolda = await s.textContent('#yol');
  await s.click('#syUc'); await s.waitForTimeout(200); await s.click('#syAcilir [data-am-tasi]'); await s.waitForSelector(`[data-tasi$=">${ca2}"]`);
  await s.click(`[data-tasi$=">${ca2}"]`); await s.waitForTimeout(1800);
  const c2 = await calisma();
  sonuc.tasindi = c2.calisma_alanlari.find((x) => x.id === ca2).alanlar.some((a) => a.id === alan);
  sonuc.adres = new URL(s.url()).hash;
  // Ayarlar › Çalışma alanları
  await s.goto(`${KOK}/#/ayarlar`); await s.waitForSelector('[data-sekme="ayarlar:calisma"]');
  sonuc.ayarSekmeleri = await s.$$eval('[data-sekme^="ayarlar:"]', (e) => e.map((x) => x.textContent));
  await s.click('[data-sekme="ayarlar:calisma"]'); await s.waitForSelector('#yaListe');
  sonuc.satirlar = await s.$$eval('#yaListe .ya-satir b', (e) => e.map((x) => x.textContent));
  await s.click(`[data-ya-izole="${ca2}"]`); await s.waitForTimeout(800);
  sonuc.izole = (await calisma()).calisma_alanlari.find((x) => x.id === ca2).izole;
  await s.click(`[data-ya-ac="${ca2}"]`); await s.waitForTimeout(300);
  sonuc.acilanAlanlar = await s.$$eval(`[data-sira-ca="${ca2}"] .ya-alan .ya-git span:last-child`, (e) => e.map((x) => x.textContent));
  await s.screenshot({ path: '.durum/ayar-calisma.png' });
  await s.click(`[data-ya-ca-kaldir="${ca2}"]`); await s.waitForTimeout(1500);  // K-082: tek tık, soru yok; bildirimde Geri al
  const kayit = JSON.parse(readFileSync('sayfalar/.cop/kaldirilanlar.json', 'utf8'));
  const caKayit = kayit.find((k) => k.tur === 'calisma' && k.calisma === ca2);
  sonuc.copte = { calisma: !!caKayit, alanGrupta: kayit.some((k) => k.grup === caKayit?.no && k.alan?.id === alan) };
  await post('/api/cop-geri', { no: caKayit.no });
  const c3 = await calisma();
  sonuc.geriGeldi = c3.calisma_alanlari.find((x) => x.id === ca2)?.alanlar.some((a) => a.id === alan) || false;
  // Entegrasyonlar (K-065, K-068): kart ızgarası; GitHub formu açılır ama gönderilmez; hafıza sağlık çıktısı gelir
  await s.click('[data-sekme="ayarlar:entegrasyon"]'); await s.waitForSelector('.ent-kart', { timeout: 20000 });
  sonuc.entegrasyon = { kartlar: await s.$$eval('.ent-izgara .ent-kart', (e) => e.map((x) => [x.querySelector('.ent-bas b').textContent, x.querySelector('.ent-durum').textContent])), yakinda: !!(await s.$('.ent-izgara .ent-bos')) };
  if (await s.$('[data-ent-eylem="github-bagla"]')) { await s.click('[data-ent-eylem="github-bagla"]'); sonuc.githubForm = !!(await s.$('#entDepo')); }
  await s.click('[data-ent-eylem="hafiza-saglik"]'); await s.waitForSelector('.ent-pre', { timeout: 40000 });
  sonuc.hafizaSaglik = (await s.textContent('.ent-pre')).length > 20;
  await s.screenshot({ path: '.durum/entegrasyon.png' });
  // Ben Ortak beyinde
  await s.goto(`${KOK}/#/ben`); await s.waitForSelector('[data-bolum]', { timeout: 15000 });
  sonuc.ben = { adres: new URL(s.url()).hash, ortakSekmeleri: await s.$$eval('#ustEk .ob-sekmeler .yazi', (e) => e.map((x) => x.textContent)), kart: await s.$$eval('[data-bolum]', (e) => e.length) };
  await s.screenshot({ path: '.durum/ortak-ben.png' });
} finally {
  await t.close();
  const kl = JSON.parse(readFileSync('sayfalar/.cop/kaldirilanlar.json', 'utf8'));
  for (const x of kl.filter((x) => x.calisma === ca || x.calisma === ca2)) await post('/api/cop-sil', { no: x.no }).catch(() => {});
  const c = await calisma();
  if (c.calisma_alanlari.some((x) => x.id === ca2)) { await post('/api/calisma-kaldir', { calisma: ca2 }); const k2 = JSON.parse(readFileSync('sayfalar/.cop/kaldirilanlar.json', 'utf8')); for (const x of k2.filter((x) => x.calisma === ca2)) await post('/api/cop-sil', { no: x.no }); }
  temizle(); rmSync(`ham/kaynaklar/${ca2}`, { recursive: true, force: true });
  // Kalıcı silinen çalışma alanının kendi satırı da Çöp'ten gitmeli (içinde alan varken kalıyordu)
  sonuc.copTemiz = !JSON.parse(readFileSync('sayfalar/.cop/kaldirilanlar.json', 'utf8')).some((x) => x.calisma === ca || x.calisma === ca2);
  if (!sonuc.copTemiz) hatalar.push('HATA: Çöp\'te sınama artığı kaldı');
}
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));

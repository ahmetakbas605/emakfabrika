import { checkRoadLegal, computeNetKg, evaluateFulfilment, toKg } from '../src/lib/marketing/weighing-math';

// Kantar hesap kuralları — MySQL'e HİÇ dokunmaz (tests/motion.test.ts
// ile aynı sınıf, saniyenin altında çalışır).
//
// Buradaki risk sessiz ve pahalı: net ağırlık FATURAYA giden miktarı
// belirliyor. Yanlış bir çevrim ya da yanlış bir tolerans kararı ekranda
// hata olarak görünmez, müşteriye eksik/fazla fatura olarak gider.

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

console.log('\nNet ağırlık — boş/dolu tartım');
check('brüt 42500, dara 16200 -> net 26300', computeNetKg(42500, 16200) === 26300);
check('metin girdi de çalışır', computeNetKg('42500.500', '16200.250') === 26300.25);
check('dara okunmadıysa net yok', computeNetKg(42500, null) === null);
check('brüt okunmadıysa net yok', computeNetKg(null, 16200) === null);
check('sayı olmayan girdi net üretmez', computeNetKg('abc', 100) === null);

console.log('\nKarayolları tonaj kontrolü (BRÜT üzerinden)');
check('40000 limitte 39500 uygun', checkRoadLegal(39500, 40000) === true);
check('40000 limitte 41200 AŞIM', checkRoadLegal(41200, 40000) === false);
check('tam limitte uygun', checkRoadLegal(40000, 40000) === true);
check('limit tanımsızsa "bilinmiyor" (null), "aşım" DEĞİL', checkRoadLegal(41200, null) === null);
check('limit sıfırsa karar verilmez', checkRoadLegal(41200, 0) === null);

console.log('\nBirim çevrimi — kg dışı ürünler');
check('birim zaten KG ise çarpan aranmaz', toKg(500, 'KG', null) === 500);
check('küçük harf kg de tanınır', toKg(500, 'kg', null) === 500);
check('ton -> kg (çarpan 1000)', toKg(26.3, 'TON', 1000) === 26300);
check('çarpan yoksa TAHMİN YÜRÜTÜLMEZ (null)', toKg(500, 'ADET', null) === null);
check('çarpan sıfır/negatifse null', toKg(500, 'TON', 0) === null);

console.log('\nTalep / Şu anki / Eksik');
{
  const v = evaluateFulfilment(26300, 20000, 0);
  check('eksik = talep - teslim', v.remainingKg === 6300);
  check('tolerans kapalıyken karar verilmez', v.withinTolerance === null);
  check('eksik varken fazla teslim değil', v.isOverDelivered === false);
}
{
  const v = evaluateFulfilment(26300, 27000, 0);
  check('fazla teslimde eksik negatif', v.remainingKg === -700);
  check('fazla teslim işaretlenir', v.isOverDelivered === true);
}
{
  // %3 tolerans -> 26300 * 0.03 = 789 kg sapma kabul edilir.
  const inside = evaluateFulfilment(26300, 25600, 3);
  check('700 kg sapma %3 toleransın İÇİNDE', inside.withinTolerance === true);
  const outside = evaluateFulfilment(26300, 25000, 3);
  check('1300 kg sapma %3 toleransın DIŞINDA', outside.withinTolerance === false);
  // Tolerans mutlak değere bakar: 700 kg FAZLA teslim de 789 kg'lık
  // payın içinde. (İlk yazışta 27100 seçmiştim -> 800 kg sapma, payı
  // 11 kg aşıyor ve test HAKLI OLARAK patladı; kod değil veri yanlıştı.)
  const overInside = evaluateFulfilment(26300, 27000, 3);
  check('700 kg FAZLA teslim toleransın içinde (mutlak değer)', overInside.withinTolerance === true);
  const overOutside = evaluateFulfilment(26300, 27100, 3);
  check('800 kg FAZLA teslim toleransın dışında (789 kg pay aşıldı)', overOutside.withinTolerance === false);
}
{
  const v = evaluateFulfilment(null, 5000, 3);
  check('talep kg bilinmiyorsa (birim çevrimi yok) karar verilmez', v.remainingKg === null && v.withinTolerance === null);
}

console.log(`\n${pass}/${pass + fail} geçti.`);
if (fail > 0) process.exit(1);

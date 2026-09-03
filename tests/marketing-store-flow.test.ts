import {
  canCloseShift,
  canOpenShift,
  canRecordSale,
  requiresOwnLedger,
  saleLinesTotal,
  shiftCloseTotal
} from '../src/lib/marketing/store-flow';

// Mağaza vardiya kuralları — MySQL'e HİÇ dokunmaz (weighbridge.test.ts
// ve marketing-contract-flow.test.ts ile aynı sınıf).
//
// Buradaki risk: bir kuralın ters dönmesi ya kasadan doğrudan doğruya
// para kaybettirir (kapalı vardiyada satışa izin vermek) ya da mağazayı
// tamamen kilitler (asla vardiya açtırmamak).

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

console.log('\nMağaza türü — hangisi kendi defterini tutar');
check('POS kendi stok/kasasını tutar', requiresOwnLedger('POS') === true);
check('ORDER_INTAKE kendi defterini TUTMAZ', requiresOwnLedger('ORDER_INTAKE') === false);

console.log('\nSatış kaydı — yalnızca POS + AÇIK vardiya');
check('POS + açık vardiya -> satış olur', canRecordSale('POS', 'OPEN') === true);
check('POS + kapalı vardiya -> satış OLMAZ', canRecordSale('POS', 'CLOSED') === false);
check('POS + vardiya hiç yok -> satış OLMAZ', canRecordSale('POS', null) === false);
check('ORDER_INTAKE + açık vardiya olsa bile satış OLMAZ (bu tür vardiya tutmaz)', canRecordSale('ORDER_INTAKE', 'OPEN') === false);

console.log('\nVardiya açma/kapama');
check('açık vardiya yoksa açılabilir', canOpenShift(false) === true);
check('zaten açık vardiya varken İKİNCİSİ açılamaz', canOpenShift(true) === false);
check('açık vardiya kapatılabilir', canCloseShift('OPEN') === true);
check('kapalı vardiya tekrar kapatılamaz', canCloseShift('CLOSED') === false);

console.log('\nSatış toplamı');
check(
  'iki kalemin toplamı doğru',
  saleLinesTotal([
    { quantity: 3, unitPrice: 150 },
    { quantity: 1, unitPrice: 75.5 }
  ]) === 525.5
);
check('boş kalem listesi null (satış en az 1 kalem ister)', saleLinesTotal([]) === null);
check('sayı olmayan kalem toplamı BOZMAZ, null döner', saleLinesTotal([{ quantity: 'abc', unitPrice: 10 }]) === null);

console.log('\nGün sonu kapanış toplamı');
check('birden çok satışın toplamı doğru', shiftCloseTotal([100, 250.25, 49.75]) === 400);
check('hiç satış olmayan gün 0 döner (hata DEĞİL — kapatmak yine geçerli)', shiftCloseTotal([]) === 0);
check('metin tutarlar da toplanır (DB\'den decimal string gelir)', shiftCloseTotal(['100.500000', '99.500000']) === 200);

console.log(`\n${pass}/${pass + fail} geçti.`);
if (fail > 0) process.exit(1);

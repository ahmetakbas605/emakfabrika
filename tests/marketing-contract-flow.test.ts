import {
  allowedActions,
  canCreateOrder,
  canTransition,
  contractTotal,
  isEditable,
  nextStatus,
  validateContractDates
} from '../src/lib/marketing/contract-flow';

// Sözleşme imza akışının durum makinesi — MySQL'e HİÇ dokunmaz
// (tests/motion.test.ts ve tests/weighbridge.test.ts ile aynı sınıf).
//
// Buradaki risk sessiz: yasak bir geçiş (ör. taslaktan doğrudan imzaya)
// sızarsa, "imza altına alınmış" bir sözleşmenin aslında hiç gözden
// geçirilmediği anlamına gelir.

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

console.log('\nİzin verilen geçişler — mutlu yol');
check('DRAFT -> SUBMIT -> SUBMITTED', nextStatus('DRAFT', 'SUBMIT') === 'SUBMITTED');
check('SUBMITTED -> SIGN -> SIGNED', nextStatus('SUBMITTED', 'SIGN') === 'SIGNED');
check('SIGNED -> ACTIVATE -> ACTIVE', nextStatus('SIGNED', 'ACTIVATE') === 'ACTIVE');
check('ACTIVE -> EXPIRE -> EXPIRED', nextStatus('ACTIVE', 'EXPIRE') === 'EXPIRED');

console.log('\nYasak geçişler — taslaktan doğrudan imzaya ATLANAMAZ');
check('DRAFT -> SIGN reddedilir', nextStatus('DRAFT', 'SIGN') === null);
check('DRAFT -> ACTIVATE reddedilir', nextStatus('DRAFT', 'ACTIVATE') === null);
check('SUBMITTED -> ACTIVATE reddedilir (önce imza şart)', nextStatus('SUBMITTED', 'ACTIVATE') === null);
check('EXPIRED bir daha ACTIVE olamaz', nextStatus('EXPIRED', 'ACTIVATE') === null);
check('TERMINATED bir daha hiçbir şey olamaz', allowedActions('TERMINATED').length === 0);

console.log('\nFesih hem imzalıyken hem yürürlükteyken mümkün');
check('SIGNED -> TERMINATE izinli', canTransition('SIGNED', 'TERMINATE'));
check('ACTIVE -> TERMINATE izinli', canTransition('ACTIVE', 'TERMINATE'));
check('DRAFT -> TERMINATE izinli DEĞİL (henüz imzalanmamışı feshetmek anlamsız)', !canTransition('DRAFT', 'TERMINATE'));

console.log('\nRevizyon yalnızca imzadan ÖNCE');
check('SUBMITTED -> BACK_TO_DRAFT izinli', canTransition('SUBMITTED', 'BACK_TO_DRAFT'));
check('SIGNED -> BACK_TO_DRAFT İZİNLİ DEĞİL (imzalıyı sessizce taslağa döndürme)', !canTransition('SIGNED', 'BACK_TO_DRAFT'));

console.log('\nDüzenlenebilirlik ve sipariş türetme');
check('yalnızca DRAFT düzenlenebilir', isEditable('DRAFT') && !isEditable('SUBMITTED') && !isEditable('ACTIVE'));
check('sipariş yalnızca ACTIVE\'ten türetilebilir', canCreateOrder('ACTIVE') && !canCreateOrder('SIGNED') && !canCreateOrder('DRAFT'));

console.log('\nTarih doğrulama');
check('bitiş başlangıçtan önce ise hata', validateContractDates('2026-06-01', '2026-01-01') !== null);
check('bitiş başlangıçtan sonra ise sorun yok', validateContractDates('2026-01-01', '2026-06-01') === null);
check('ikisi de yoksa (süresiz sözleşme) sorun yok', validateContractDates(undefined, undefined) === null);
check('yalnızca biri varsa sorun yok (henüz eksik, hata değil)', validateContractDates('2026-01-01', undefined) === null);

console.log('\nSözleşme toplamı');
check(
  'iki kalemin toplamı doğru',
  contractTotal([
    { quantity: 100, unitPrice: 12.5 },
    { quantity: 50, unitPrice: 20 }
  ]) === 2250
);
check('sayı olmayan kalem toplamı BOZMAZ, null döner', contractTotal([{ quantity: 'abc', unitPrice: 10 }]) === null);
check('boş liste toplamı 0', contractTotal([]) === 0);

console.log(`\n${pass}/${pass + fail} geçti.`);
if (fail > 0) process.exit(1);

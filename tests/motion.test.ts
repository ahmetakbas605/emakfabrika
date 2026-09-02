import { resolveMotionTier, clampTier, MOTION_DURATIONS } from '../src/lib/motion';

// Görsel Yenileme Faz 0 — hareket bütçesi saf bir fonksiyon, bu yüzden bu
// paket diğer 17 paketin aksine MySQL'e HİÇ dokunmaz (saniyenin altında
// çalışır). Buradaki asıl risk sessiz: yanlış bir ön ek, bir veri-giriş
// ekranını farkında olmadan "sahne" yapar ve operatörü her açılışta 520ms
// bekletir — ekranda hata görünmez, yalnızca iş yavaşlar. Bu yüzden
// kademelerin ROTADAN doğru türediği tek tek kanıtlanıyor.

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

console.log('\nSahne (STAGE) rotaları');
check('/login sahne', resolveMotionTier('/login') === 'STAGE');
check('/dashboard sahne', resolveMotionTier('/dashboard') === 'STAGE');
check('/dashboard/ (sondaki slash) sahne', resolveMotionTier('/dashboard/') === 'STAGE');
check('/dashboard/bi sahne', resolveMotionTier('/dashboard/bi') === 'STAGE');
check('/dashboard/holding sahne', resolveMotionTier('/dashboard/holding') === 'STAGE');
check('/dashboard/security/audit sahne (alt rota miras alır)', resolveMotionTier('/dashboard/security/audit') === 'STAGE');

console.log('\nTezgâh (WORKBENCH) rotaları — veri girişi');
check('muhasebe fişi tezgâh', resolveMotionTier('/dashboard/departments/abc/journals/new') === 'WORKBENCH');
check('üretim emri tezgâh', resolveMotionTier('/dashboard/production/orders') === 'WORKBENCH');
check('MES duruş tezgâh', resolveMotionTier('/dashboard/mes') === 'WORKBENCH');
check('satınalma tezgâh', resolveMotionTier('/dashboard/procurement/rfqs/1/evaluate') === 'WORKBENCH');
check('master data tezgâh', resolveMotionTier('/dashboard/master-data/products') === 'WORKBENCH');
check('İK izin tezgâh', resolveMotionTier('/dashboard/hr/leave') === 'WORKBENCH');

console.log('\nEn uzun eşleşme kazanır — /dashboard STAGE olsa bile alt rotalar kendi kademesinde');
check('/dashboard exact iken /dashboard/production tezgâh kalır', resolveMotionTier('/dashboard/production') === 'WORKBENCH');
check('/dashboard/quality/ncr tezgâh', resolveMotionTier('/dashboard/quality/ncr') === 'WORKBENCH');

console.log('\nVarsayılan (FLOW) — kuralı olmayan yeni modül');
check('bilinmeyen rota akış', resolveMotionTier('/dashboard/yeni-modul') === 'FLOW');
check('onay kutusu akış', resolveMotionTier('/dashboard/approvals') === 'FLOW');
check('kök akış', resolveMotionTier('/') === 'FLOW');

console.log('\nTek yönlü kısıtlama — düşürülebilir, YÜKSELTİLEMEZ');
check('tezgâh sahneye YÜKSELTİLEMEZ', clampTier('WORKBENCH', 'STAGE') === 'WORKBENCH');
check('sahne tezgâha düşürülebilir', clampTier('STAGE', 'WORKBENCH') === 'WORKBENCH');
check('akış tezgâha düşürülebilir', clampTier('FLOW', 'WORKBENCH') === 'WORKBENCH');
check('akış sahneye YÜKSELTİLEMEZ', clampTier('FLOW', 'STAGE') === 'FLOW');

console.log('\nSüreler — CSS ile tek kaynak sözleşmesi');
check('tezgâh sayfa süresi 120ms (Doherty eşiğinin çok altında)', MOTION_DURATIONS.WORKBENCH.page === 120);
check('tezgâh < akış < sahne', MOTION_DURATIONS.WORKBENCH.page < MOTION_DURATIONS.FLOW.page && MOTION_DURATIONS.FLOW.page < MOTION_DURATIONS.STAGE.page);

console.log(`\n${pass}/${pass + fail} geçti.`);
if (fail > 0) process.exit(1);

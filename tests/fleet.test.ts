import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users, serviceDeskTickets, maintenanceWorkOrders, workOrders } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createDepartment } from '../src/lib/departments';
import { createLocation, listLocations } from '../src/lib/it/locations';
import { createEamAsset, getEamAsset, listEamAssets, listEamAssetTypes } from '../src/lib/eam/assets';
import { createVehicle, getVehicle, listVehicles, changeVehicleStatus, createVehicleInsurance, listVehicleInsurances, listExpiringVehicleDocuments } from '../src/lib/fleet/vehicles';
import { recordVehicleExpense, listVehicleExpenses, getVehicleFuelEfficiency } from '../src/lib/fleet/expenses';
import { createMaintenancePlan, listFleetMaintenancePlans, runDueMaintenanceGeneration, revertAssetAfterMaintenanceIfApplicable } from '../src/lib/it/maintenance';
import { transitionTicket } from '../src/lib/it/tickets';
import { FleetError } from '../src/lib/fleet/errors';

// Holding ERP Faz 7 (Filo + Tesis) — Diğer kalıcı test paketleriyle AYNI
// disiplin: gerçek MySQL'e karşı, mock YOK. npm run test:fleet. Bu testin
// odağı: (1) maintenancePlans'ın ÜÇÜNCÜ varlık türü (vehicleId) Faz 6'daki
// AYNI departman-yönlendirme + otomatik durum geri dönüşü desenini doğru
// uyguluyor mu, (2) "Tesis" yarısının EAM'e eklenen locationId/yeni asset
// tipleri gerçekten çalışıyor mu, (3) yakıt verimliliği hesabı TAM doğru mu.

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

async function main() {
  const companyId = newId();
  const adminId = newId();

  await db.insert(companies).values({ id: companyId, name: 'FLEET TEST A.Ş.', taxId: '9999999999', taxOffice: 'Test V.D.' });
  await db.insert(users).values([
    { id: adminId, companyId, fullName: 'Filo Yöneticisi', email: `test-${Date.now()}-admin@fleet.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true }
  ]);

  try {
    console.log('--- Tesis: it_locations İLK GERÇEK tüketicisi + EAM\'e locationId + 2 yeni asset tipi ---');
    const buildingId = await createLocation(companyId, { locationType: 'BUILDING', name: 'Fabrika A' });
    const floorId = await createLocation(companyId, { locationType: 'FLOOR', name: '1. Kat', parentLocationId: buildingId });
    const locations = await listLocations(companyId);
    check('2 konum oluşturuldu ve listelendi (Bina + Kat)', locations.length === 2);
    check('Kat, Bina\'yı üst konum olarak taşıyor', locations.find((l) => l.id === floorId)?.parentLocationId === buildingId);

    const assetTypes = await listEamAssetTypes();
    check('CAMERA ve ACCESS_CONTROL yeni asset tipleri seed edildi', assetTypes.some((t) => t.code === 'CAMERA') && assetTypes.some((t) => t.code === 'ACCESS_CONTROL'));

    const cameraId = await createEamAsset(companyId, { assetTypeCode: 'CAMERA', code: 'CAM-1', name: 'Giriş Kamerası', locationId: floorId });
    const eamAssets = await listEamAssets(companyId);
    const camera = eamAssets.find((a) => a.id === cameraId);
    check('kamera 1. Kat konumuna doğru bağlandı', camera?.locationName === '1. Kat');

    console.log('--- Filo: Araç + Ruhsat + Sigorta + yaklaşan sona erme raporu ---');
    const bakimDeptId = await createDepartment(companyId, { departmentTypeCode: 'WAREHOUSE', name: 'Bakım' });
    const soonExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const farExpiry = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const vehicleId = await createVehicle(companyId, { plateNo: '34 TEST 01', brand: 'Ford', model: 'Transit', fuelType: 'DIESEL', registrationExpiryDate: soonExpiry, departmentId: bakimDeptId });
    const vehicle2Id = await createVehicle(companyId, { plateNo: '34 TEST 02', brand: 'Renault', model: 'Master', registrationExpiryDate: farExpiry });
    const vehicles = await listVehicles(companyId);
    check('2 araç oluşturuldu ve listelendi', vehicles.length === 2);

    await createVehicleInsurance(companyId, { vehicleId, policyNo: 'POL-001', provider: 'Test Sigorta', coverageType: 'Kasko', startDate: '2026-01-01', endDate: soonExpiry, premium: 5000 });
    let invalidPolicyRejected = false;
    try {
      await createVehicleInsurance(companyId, { vehicleId, policyNo: 'POL-BAD', startDate: '2026-06-01', endDate: '2026-01-01' });
    } catch (err) {
      invalidPolicyRejected = err instanceof FleetError;
    }
    check('bitişi başlangıçtan önce olan poliçe reddedildi', invalidPolicyRejected);

    const insurances = await listVehicleInsurances(companyId, vehicleId);
    check('poliçe listelendi (1)', insurances.length === 1);

    const expiringDocs = await listExpiringVehicleDocuments(companyId, 30);
    check(`30 gün içinde sona erecek belgeler doğru (ruhsat+poliçe=2, 2. araç HARİÇ): ${expiringDocs.length}`, expiringDocs.length === 2);
    check('2. aracın (200 gün sonra biten ruhsatı) rapora dahil EDİLMEDİĞİ doğrulandı', !expiringDocs.some((d) => d.vehicleId === vehicle2Id));

    console.log('--- Bakım planı: vehicleId ÜÇÜNCÜ varlık türü, KENDİ departmanına yönleniyor ---');
    const today = new Date().toISOString().slice(0, 10);
    const fleetPlanId = await createMaintenancePlan(companyId, { vehicleId, departmentId: bakimDeptId, title: 'Periyodik Bakım', maintenanceType: 'PREVENTIVE', frequency: 'MONTHLY', intervalValue: 1, startDate: today });
    const fleetPlans = await listFleetMaintenancePlans(companyId);
    check('listFleetMaintenancePlans yalnızca araç planını görüyor (1)', fleetPlans.length === 1 && fleetPlans[0].id === fleetPlanId);

    const genResult = await runDueMaintenanceGeneration(companyId, bakimDeptId, adminId);
    check(`iş emri üretildi (1): ${genResult.generatedCount}`, genResult.generatedCount === 1);

    const [fleetWorkOrder] = await db.select().from(maintenanceWorkOrders).where(eq(maintenanceWorkOrders.maintenancePlanId, fleetPlanId));
    const [ticket] = await db.select({ id: serviceDeskTickets.id, departmentId: serviceDeskTickets.departmentId }).from(workOrders).innerJoin(serviceDeskTickets, eq(serviceDeskTickets.id, workOrders.ticketId)).where(eq(workOrders.id, fleetWorkOrder.workOrderId));
    check('aracın bakım ticket\'ı KENDİ departmanına (Bakım) düştü', ticket.departmentId === bakimDeptId);

    await changeVehicleStatus(companyId, vehicleId, 'UNDER_MAINTENANCE');
    check('araç UNDER_MAINTENANCE olarak işaretlendi', (await getVehicle(companyId, vehicleId)).status === 'UNDER_MAINTENANCE');

    for (const step of ['ASSIGNED', 'ACCEPTED', 'WORKING', 'TESTING', 'RESOLVED', 'USER_APPROVAL_PENDING', 'CLOSED']) {
      await transitionTicket(companyId, ticket.id, step, adminId);
    }
    await revertAssetAfterMaintenanceIfApplicable(companyId, ticket.id, adminId);
    check('ticket CLOSED olunca araç OTOMATİK ACTIVE\'e döndü', (await getVehicle(companyId, vehicleId)).status === 'ACTIVE');

    console.log('--- Yakıt verimliliği (talep üzerine hesaplanan rapor) ---');
    await recordVehicleExpense(companyId, adminId, { vehicleId: vehicle2Id, expenseType: 'FUEL', expenseDate: '2026-03-01', amount: 2000, quantity: 40, odometerKm: 10000 });
    await recordVehicleExpense(companyId, adminId, { vehicleId: vehicle2Id, expenseType: 'FUEL', expenseDate: '2026-03-15', amount: 2500, quantity: 50, odometerKm: 10600 });
    await recordVehicleExpense(companyId, adminId, { vehicleId: vehicle2Id, expenseType: 'HGS', expenseDate: '2026-03-10', amount: 150 });
    await recordVehicleExpense(companyId, adminId, { vehicleId: vehicle2Id, expenseType: 'FUEL', expenseDate: '2026-04-01', amount: 999, quantity: 10, odometerKm: 99999 }); // dönem DIŞI

    const expenses = await listVehicleExpenses(companyId, vehicle2Id);
    check('4 gider kaydı listelendi', expenses.length === 4);

    const efficiency = await getVehicleFuelEfficiency(companyId, vehicle2Id, '2026-03-01', '2026-03-31');
    check(`toplam yakıt tutarı doğru (2000+2500=4500, Nisan+HGS HARİÇ): ${efficiency.totalFuelAmount}`, efficiency.totalFuelAmount === 4500);
    check(`toplam litre doğru (40+50=90): ${efficiency.totalFuelLiters}`, efficiency.totalFuelLiters === 90);
    check(`ortalama birim fiyat doğru (4500/90=50): ${efficiency.avgCostPerLiter}`, efficiency.avgCostPerLiter === 50);
    check(`toplam km doğru (10600-10000=600): ${efficiency.totalKm}`, efficiency.totalKm === 600);
    check(`km/litre TAM doğru (600/90=6.667): ${efficiency.kmPerLiter}`, Math.abs((efficiency.kmPerLiter ?? 0) - 600 / 90) < 0.0001);

    const singleReadingResult = await getVehicleFuelEfficiency(companyId, vehicle2Id, '2026-03-01', '2026-03-01');
    check('tek okuma varken km/litre dürüstçe null (mesafe TÜRETİLEMEZ)', singleReadingResult.totalKm === null && singleReadingResult.kmPerLiter === null);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    // service_desk_tickets silinince ticket_status_history/work_orders/
    // maint_work_orders'ın HEPSİ onDelete:'cascade' ile OTOMATİK gider.
    await cleanupConn.query(`DELETE FROM service_desk_tickets WHERE company_id = ?`, [companyId]);
    const dependentFirst = [
      'maint_plans', 'vehicle_expenses', 'vehicle_insurances', 'vehicles',
      'eam_assets', 'it_locations', 'departments'
    ];
    for (const table of dependentFirst) {
      await cleanupConn.query(`DELETE FROM \`${table}\` WHERE company_id = ?`, [companyId]);
    }
    await cleanupConn.query('DELETE FROM companies WHERE id = ?', [companyId]);
    await cleanupConn.end();
  }

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} başarısız ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('TEST SÜRECİ HATASI:', err);
  process.exit(1);
});

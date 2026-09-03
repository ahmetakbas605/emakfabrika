// Kalite (muayene+NCR), Bakım/EAM (varlık+bakım planı), Filo (gider+
// sigorta), Projeler (proje+kilometre taşı+görev+hakediş), Vendor.
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and } from 'drizzle-orm';
import {
  products, vehicles, users, departments, checklistTemplates,
  qualityInspections, ncrRecords,
  eamAssets, eamAssetTypes, maintenancePlans,
  vehicleExpenses, vehicleInsurances,
  projects, projectMilestones, projectTasks, projProgressPayments,
  vendors
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d';

function id() { return crypto.randomUUID(); }

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  const connection = await mysql.createConnection(url!);
  const db = drizzle(connection, { mode: 'default' });

  try {
    const productRows = await db.select().from(products).where(eq(products.companyId, COMPANY_ID));
    const productBySku = Object.fromEntries(productRows.map((p) => [p.sku, p.id]));
    const [uretimDept] = await db.select().from(departments).where(and(eq(departments.companyId, COMPANY_ID), eq(departments.departmentTypeCode, 'IT')));
    const vehicleRows = await db.select().from(vehicles).where(eq(vehicles.companyId, COMPANY_ID));
    const kamyonet = vehicleRows.find((v) => v.plateNo === '41 ABC 123');
    const forklift = vehicleRows.find((v) => v.plateNo === 'FL-01');

    // ================= KALİTE =================
    const existingInsp = await db.select({ inspectionNo: qualityInspections.inspectionNo }).from(qualityInspections).where(eq(qualityInspections.companyId, COMPANY_ID));
    if (!existingInsp.some((i) => i.inspectionNo === 'MUY20260001')) {
      const inspectionId = id();
      await db.insert(qualityInspections).values({
        id: inspectionId, companyId: COMPANY_ID, inspectionNo: 'MUY20260001', type: 'FINAL', sourceType: 'PRODUCTION_ORDER', sourceId: crypto.randomUUID(),
        productId: productBySku['URN-001'], inspectedQty: '65.000000', passedQty: '61.000000', failedQty: '4.000000', result: 'CONDITIONAL',
        notes: 'Kaynak dikişinde 4 adet üründe gözle görülür çapak tespit edildi, rework gerekiyor.', inspectedByUserId: ADMIN_USER_ID
      });
      // NCR (mevcut 1'e ek) — bu muayeneden doğan.
      await db.insert(ncrRecords).values({
        id: id(), companyId: COMPANY_ID, ncrNo: 'NCR20260002', inspectionId, productId: productBySku['URN-001'],
        title: 'Kaynak dikişinde çapak', description: 'Final muayenede 4 adet vanada kaynak dikişi çapağı tespit edildi.',
        severity: 'MINOR', status: 'CORRECTIVE_ACTION', rootCause: 'Kaynak robotu parametre sapması.', correctiveAction: 'Etkilenen 4 adet rework hattına alındı.',
        assignedToUserId: ADMIN_USER_ID, createdByUserId: ADMIN_USER_ID
      });
      console.log('Kalite: 1 muayene (CONDITIONAL), 1 NCR eklendi.');
    }

    // ================= BAKIM / EAM =================
    const eamTypes = await db.select({ code: eamAssetTypes.code }).from(eamAssetTypes).limit(3);
    const existingEam = await db.select({ code: eamAssets.code }).from(eamAssets).where(eq(eamAssets.companyId, COMPANY_ID));
    let compressorId: string | undefined;
    if (!existingEam.some((e) => e.code === 'EKP-002')) {
      compressorId = id();
      await db.insert(eamAssets).values({
        id: compressorId, companyId: COMPANY_ID, assetTypeCode: eamTypes[0]?.code ?? 'HVAC', code: 'EKP-002', name: 'Hava Kompresörü',
        manufacturer: 'Atlas Copco', model: 'GA30', serialNumber: 'AC-2024-8871', status: 'IN_SERVICE', responsibleUserId: ADMIN_USER_ID, purchaseDate: '2024-05-01'
      });
      console.log('EAM: 1 varlık eklendi (Hava Kompresörü).');
    } else {
      const [existing] = await db.select({ id: eamAssets.id }).from(eamAssets).where(and(eq(eamAssets.companyId, COMPANY_ID), eq(eamAssets.code, 'EKP-002')));
      compressorId = existing.id;
    }

    const existingPlan = await db.select({ title: maintenancePlans.title }).from(maintenancePlans).where(eq(maintenancePlans.companyId, COMPANY_ID));
    if (!existingPlan.some((p) => p.title === 'Kompresör Aylık Bakım') && compressorId) {
      await db.insert(maintenancePlans).values({
        id: id(), companyId: COMPANY_ID, eamAssetId: compressorId, departmentId: uretimDept?.id, title: 'Kompresör Aylık Bakım',
        maintenanceType: 'PREVENTIVE', frequency: 'MONTHLY', intervalValue: 1, startDate: '2026-01-01', nextDueDate: '2026-10-01',
        assignedTechnicianId: ADMIN_USER_ID, estimatedDurationMinutes: 90
      });
      console.log('EAM: 1 bakım planı eklendi (aylık, kompresör).');
    }

    // ================= FİLO — Gider / Sigorta =================
    if (kamyonet) {
      const existingExp = await db.select().from(vehicleExpenses).where(eq(vehicleExpenses.vehicleId, kamyonet.id));
      if (existingExp.length === 0) {
        await db.insert(vehicleExpenses).values([
          { id: id(), companyId: COMPANY_ID, vehicleId: kamyonet.id, expenseType: 'FUEL', expenseDate: '2026-08-15', amount: '2450.000000', quantity: '85.500000', odometerKm: '42150.00', createdByUserId: ADMIN_USER_ID },
          { id: id(), companyId: COMPANY_ID, vehicleId: kamyonet.id, expenseType: 'TOLL', expenseDate: '2026-08-20', amount: '340.000000', odometerKm: '42580.00', createdByUserId: ADMIN_USER_ID }
        ]);
      }
      const existingIns = await db.select().from(vehicleInsurances).where(eq(vehicleInsurances.vehicleId, kamyonet.id));
      if (existingIns.length === 0) {
        await db.insert(vehicleInsurances).values({ id: id(), companyId: COMPANY_ID, vehicleId: kamyonet.id, policyNo: 'POL-2026-33210', provider: 'Anadolu Sigorta', coverageType: 'Kasko', startDate: '2026-03-15', endDate: '2027-03-15', premium: '18500.000000' });
      }
      console.log('Filo: 2 gider, 1 sigorta poliçesi eklendi.');
    }

    // ================= PROJELER =================
    const existingProjects = await db.select({ code: projects.code }).from(projects).where(eq(projects.companyId, COMPANY_ID));
    if (!existingProjects.some((p) => p.code === 'PRJ-2026-01')) {
      const projectId = id();
      await db.insert(projects).values({
        id: projectId, companyId: COMPANY_ID, code: 'PRJ-2026-01', name: 'Yapı İnşaat — Şantiye Vana Tedariki', description: 'Yapı İnşaat A.Ş. şantiyesi için endüstriyel vana ve boru tedariki projesi.',
        status: 'ACTIVE', startDate: '2026-08-01', endDate: '2026-12-31', budgetAmount: '620000.000000', managerUserId: ADMIN_USER_ID, createdByUserId: ADMIN_USER_ID
      });
      const milestone1 = id();
      const milestone2 = id();
      await db.insert(projectMilestones).values([
        { id: milestone1, companyId: COMPANY_ID, projectId, name: 'İlk Parti Teslim', targetDate: '2026-09-30', status: 'COMPLETED', completedAt: new Date('2026-09-28') },
        { id: milestone2, companyId: COMPANY_ID, projectId, name: 'Final Teslim', targetDate: '2026-12-15', status: 'PENDING' }
      ]);
      await db.insert(projectTasks).values([
        { id: id(), companyId: COMPANY_ID, projectId, name: 'Tedarik planı hazırlığı', status: 'DONE', assignedToUserId: ADMIN_USER_ID, startDate: '2026-08-01', dueDate: '2026-08-10', completedAt: new Date('2026-08-09') },
        { id: id(), companyId: COMPANY_ID, projectId, name: 'İkinci parti üretim takibi', status: 'IN_PROGRESS', assignedToUserId: ADMIN_USER_ID, startDate: '2026-09-15', dueDate: '2026-11-30' }
      ]);
      await db.insert(projProgressPayments).values({
        id: id(), companyId: COMPANY_ID, projectId, milestoneId: milestone1, paymentNo: 'HKD-2026-001', periodStart: '2026-08-01', periodEnd: '2026-09-30',
        amount: '250000.000000', status: 'APPROVED', paymentDate: '2026-10-05', notes: 'İlk parti tesliminin hakedişi.', createdByUserId: ADMIN_USER_ID
      });
      console.log('Proje: 1 proje, 2 kilometre taşı, 2 görev, 1 hakediş eklendi.');
    }

    // ================= VENDOR (IT tarafı — muhasebeye opsiyonel bağlı) ===
    const existingVendors = await db.select({ name: vendors.name }).from(vendors).where(eq(vendors.companyId, COMPANY_ID));
    if (!existingVendors.some((v) => v.name === 'TechSis Bilgi Teknolojileri')) {
      await db.insert(vendors).values({ id: id(), companyId: COMPANY_ID, name: 'TechSis Bilgi Teknolojileri', contactName: 'Deniz Bulut', contactEmail: 'destek@techsis.com.tr', contactPhone: '02123456789' });
      console.log('IT: 1 vendor eklendi.');
    }

    console.log('\n=== BATCH 5 (Kalite/EAM/Filo/Projeler) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 5 başarısız:', err); process.exit(1); });

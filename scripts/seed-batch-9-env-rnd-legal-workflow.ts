// Çevre (sayaç+okuma, emisyon, atık), Ar-Ge (prototip+lab testi),
// Hukuk (legal hold), İş Akışı (workflow_rules).
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import {
  users, legalContracts,
  energyMeters, energyReadings, envEmissionRecords, envWasteRecords,
  rndPrototypes, rndLabTests,
  legalHolds, workflowRules
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d';

function id() { return crypto.randomUUID(); }

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  const connection = await mysql.createConnection(url!);
  const db = drizzle(connection, { mode: 'default' });

  try {
    // ================= ÇEVRE =================
    const existingMeter = await db.select({ code: energyMeters.code }).from(energyMeters).where(eq(energyMeters.companyId, COMPANY_ID));
    let meterId: string;
    if (!existingMeter.some((m) => m.code === 'ENJ-01')) {
      meterId = id();
      await db.insert(energyMeters).values({ id: meterId, companyId: COMPANY_ID, code: 'ENJ-01', name: 'Fabrika Ana Elektrik Sayacı', energyType: 'ELECTRICITY', unit: 'kWh' });
      await db.insert(energyReadings).values({ id: id(), companyId: COMPANY_ID, meterId, periodStart: '2026-08-01', periodEnd: '2026-08-31', consumption: '48500.000000', cost: '97000.000000', recordedByUserId: ADMIN_USER_ID });
      console.log('Çevre: 1 enerji sayacı, 1 okuma eklendi.');
    }
    const existingEmission = await db.select().from(envEmissionRecords).where(eq(envEmissionRecords.companyId, COMPANY_ID));
    if (existingEmission.length === 0) {
      await db.insert(envEmissionRecords).values({ id: id(), companyId: COMPANY_ID, recordDate: '2026-08-31', emissionType: 'CO2', quantity: '12.400000', unit: 'ton', source: 'Doğalgaz kazanı + üretim hattı elektrik tüketimi', createdByUserId: ADMIN_USER_ID });
    }
    const existingWaste = await db.select().from(envWasteRecords).where(eq(envWasteRecords.companyId, COMPANY_ID));
    if (existingWaste.length === 0) {
      await db.insert(envWasteRecords).values({ id: id(), companyId: COMPANY_ID, recordDate: '2026-08-31', wasteType: 'RECYCLABLE', quantity: '3.200000', unit: 'ton', disposalMethod: 'RECYCLING', disposalCompany: 'Kocaeli Geri Dönüşüm A.Ş.', notes: 'Kesim hattı metal talaşı.', createdByUserId: ADMIN_USER_ID });
    }
    console.log('Çevre: 1 emisyon kaydı, 1 atık kaydı eklendi.');

    // ================= AR-GE =================
    const existingProto = await db.select({ prototypeNo: rndPrototypes.prototypeNo }).from(rndPrototypes).where(eq(rndPrototypes.companyId, COMPANY_ID));
    if (!existingProto.some((p) => p.prototypeNo === 'PRT-2026-001')) {
      const prototypeId = id();
      await db.insert(rndPrototypes).values({ id: prototypeId, companyId: COMPANY_ID, prototypeNo: 'PRT-2026-001', name: 'Yüksek Basınç Dayanımlı Vana Prototipi', version: 2, status: 'TESTING', description: 'Mevcut vana gövdesinin 25 bar yerine 40 bar basınca dayanıklı yeni versiyonu.', createdByUserId: ADMIN_USER_ID });
      await db.insert(rndLabTests).values({ id: id(), companyId: COMPANY_ID, prototypeId, testNo: 'TST-2026-001', testName: 'Basınç Dayanım Testi', testDate: '2026-08-25', status: 'COMPLETED', resultSummary: '42 bar basınca kadar sızdırmazlık korundu, hedef 40 bar aşıldı.', performedByUserId: ADMIN_USER_ID });
      console.log('Ar-Ge: 1 prototip, 1 lab testi eklendi.');
    }

    // ================= HUKUK — Legal Hold =================
    const [existingLegalContract] = await db.select({ id: legalContracts.id }).from(legalContracts).where(eq(legalContracts.companyId, COMPANY_ID)).limit(1);
    const existingHold = await db.select().from(legalHolds).where(eq(legalHolds.companyId, COMPANY_ID));
    if (existingHold.length === 0 && existingLegalContract) {
      await db.insert(legalHolds).values({ id: id(), companyId: COMPANY_ID, entityType: 'LEGAL_CONTRACT', entityId: existingLegalContract.id, reason: 'Devam eden tedarikçi ihtilafı nedeniyle sözleşme kayıtları saklama altına alındı.', active: true, createdByUserId: ADMIN_USER_ID });
      console.log('Hukuk: 1 legal hold eklendi.');
    }

    // ================= İŞ AKIŞI =================
    const existingRule = await db.select({ name: workflowRules.name }).from(workflowRules).where(eq(workflowRules.companyId, COMPANY_ID));
    if (!existingRule.some((r) => r.name === 'Yüksek Tutarlı Satınalma Talebi Onayı')) {
      await db.insert(workflowRules).values({
        id: id(), companyId: COMPANY_ID, documentType: 'PROC_REQUEST', name: 'Yüksek Tutarlı Satınalma Talebi Onayı',
        conditions: { minAmount: 100000 }, approvalChain: [{ role: 'PURCHASING_MANAGER' }, { role: 'FACTORY_ADMIN' }], priority: 1, active: true
      });
      console.log('İş Akışı: 1 kural eklendi (100.000 TL üzeri satınalma talebi -> 2 aşamalı onay).');
    }

    console.log('\n=== BATCH 9 (Çevre/Ar-Ge/Hukuk/İş Akışı) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 9 başarısız:', err); process.exit(1); });

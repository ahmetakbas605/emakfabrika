// Core Security: Erişim Bölgesi/Grubu/Kartı/Logu, Break-Glass, KVKK Veri
// Sahibi Talebi, Saklama Politikası, Güvenlik Olayı, Kullanıcı Cihazı,
// Kişisel Veri Envanteri.
//
// BİLİNÇLİ OLARAK ATLANANLAR: role_conflict_rules ve it_policies.
// role_conflict_rules GÖRÜNTÜLEME verisi DEĞİL — lib/security/sod.ts
// bunu OKUYUP gerçek onay eylemlerini ENGELLER (CREATOR_CANNOT_APPROVE).
// Bu demo şirkette TEK admin hem oluşturup hem onaylıyor; bir kural
// eklemek demoyu "boş ekran" yerine "gizemce engellenen eylem" yapardı
// — test verisi eklerken davranışı DEĞİŞTİRMEMEK bu betiklerin ortak
// ilkesi (Faz 0'ın "çalışan sistemi bozma" disiplini burada da geçerli).
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and } from 'drizzle-orm';
import {
  employees, users, branches, pdksDevices,
  accessZones, accessGroups, accessGroupZones, accessGroupMembers, accessCards, accessLogs,
  breakGlassAccess, dataSubjectRequests, retentionPolicies,
  securityEvents, userDevices, personalDataInventory
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d';

function id() { return crypto.randomUUID(); }

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  const connection = await mysql.createConnection(url!);
  const db = drizzle(connection, { mode: 'default' });

  try {
    const [branch] = await db.select({ id: branches.id }).from(branches).where(eq(branches.companyId, COMPANY_ID));
    const empRows = await db.select({ id: employees.id, firstName: employees.firstName }).from(employees).where(eq(employees.companyId, COMPANY_ID));
    const ali = empRows.find((e) => e.firstName === 'Ali');
    const [pdksDevice] = await db.select({ id: pdksDevices.id }).from(pdksDevices).where(eq(pdksDevices.companyId, COMPANY_ID));

    // ================= ERİŞİM KONTROLÜ =================
    const existingZone = await db.select({ code: accessZones.code }).from(accessZones).where(eq(accessZones.companyId, COMPANY_ID));
    let serverRoomZoneId: string;
    if (!existingZone.some((z) => z.code === 'ZN-SRV')) {
      serverRoomZoneId = id();
      await db.insert(accessZones).values({ id: serverRoomZoneId, companyId: COMPANY_ID, code: 'ZN-SRV', name: 'Sunucu Odası', branchId: branch?.id, description: 'Yalnızca IT personeline açık, sıkı erişim.' });
    } else {
      const [existing] = await db.select({ id: accessZones.id }).from(accessZones).where(and(eq(accessZones.companyId, COMPANY_ID), eq(accessZones.code, 'ZN-SRV')));
      serverRoomZoneId = existing.id;
    }

    const existingGroup = await db.select({ code: accessGroups.code }).from(accessGroups).where(eq(accessGroups.companyId, COMPANY_ID));
    let itGroupId: string;
    if (!existingGroup.some((g) => g.code === 'AG-IT')) {
      itGroupId = id();
      await db.insert(accessGroups).values({ id: itGroupId, companyId: COMPANY_ID, code: 'AG-IT', name: 'IT Personeli', description: 'Sunucu odası ve ağ dolaplarına erişim yetkisi.' });
      await db.insert(accessGroupZones).values({ id: id(), groupId: itGroupId, zoneId: serverRoomZoneId });
    } else {
      const [existing] = await db.select({ id: accessGroups.id }).from(accessGroups).where(and(eq(accessGroups.companyId, COMPANY_ID), eq(accessGroups.code, 'AG-IT')));
      itGroupId = existing.id;
    }

    if (ali) {
      const existingMember = await db.select().from(accessGroupMembers).where(and(eq(accessGroupMembers.groupId, itGroupId), eq(accessGroupMembers.employeeId, ali.id)));
      if (existingMember.length === 0) {
        await db.insert(accessGroupMembers).values({ id: id(), companyId: COMPANY_ID, groupId: itGroupId, employeeId: ali.id, validFrom: '2026-01-01' });
      }
      const existingCard = await db.select().from(accessCards).where(and(eq(accessCards.companyId, COMPANY_ID), eq(accessCards.employeeId, ali.id)));
      let cardId: string | undefined;
      if (existingCard.length === 0) {
        cardId = id();
        await db.insert(accessCards).values({ id: cardId, companyId: COMPANY_ID, employeeId: ali.id, cardNumber: 'KRT-000123', status: 'ACTIVE' });
      } else {
        cardId = existingCard[0].id;
      }
      if (pdksDevice) {
        const existingLog = await db.select().from(accessLogs).where(and(eq(accessLogs.employeeId, ali.id), eq(accessLogs.zoneId, serverRoomZoneId)));
        if (existingLog.length === 0) {
          await db.insert(accessLogs).values([
            { id: id(), companyId: COMPANY_ID, deviceId: pdksDevice.id, zoneId: serverRoomZoneId, cardId, employeeId: ali.id, accessAt: new Date('2026-09-01T09:10:00'), result: 'GRANTED' },
            { id: id(), companyId: COMPANY_ID, deviceId: pdksDevice.id, zoneId: serverRoomZoneId, employeeId: ali.id, accessAt: new Date('2026-08-30T23:40:00'), result: 'DENIED', reason: 'Mesai saati dışı, yetki yok.' }
          ]);
        }
      }
    }
    console.log('Erişim Kontrolü: 1 bölge, 1 grup, 1 üyelik, 1 kart, 2 log eklendi.');

    // ================= BREAK-GLASS =================
    const existingBg = await db.select().from(breakGlassAccess).where(eq(breakGlassAccess.companyId, COMPANY_ID));
    if (existingBg.length === 0) {
      await db.insert(breakGlassAccess).values({ id: id(), companyId: COMPANY_ID, requestedByUserId: ADMIN_USER_ID, reason: 'Üretim sunucusunda acil disk arızası, IT müdürüne ulaşılamadı.', ticketReference: 'TKT20260101', scope: 'Sunucu Odası — SRV-001', status: 'EXPIRED', approvedByUserId: ADMIN_USER_ID, startAt: new Date('2026-08-28T02:00:00'), endAt: new Date('2026-08-28T04:00:00') });
      console.log('Break-Glass: 1 kayıt eklendi (süresi dolmuş).');
    }

    // ================= KVKK VERİ SAHİBİ TALEBİ =================
    const existingDsr = await db.select({ requestNo: dataSubjectRequests.requestNo }).from(dataSubjectRequests).where(eq(dataSubjectRequests.companyId, COMPANY_ID));
    if (!existingDsr.some((d) => d.requestNo === 'KVKK20260001')) {
      await db.insert(dataSubjectRequests).values({ id: id(), companyId: COMPANY_ID, requestNo: 'KVKK20260001', requestType: 'ACCESS', subjectName: 'Eski Çalışan Talebi', subjectIdentifier: '***-masked-***', description: 'Eski bir çalışan, işten ayrılış sürecinde kendisiyle ilgili tutulan verilerin bir kopyasını talep etti.', status: 'APPROVED', createdByUserId: ADMIN_USER_ID, submittedAt: new Date('2026-08-20'), completedAt: new Date('2026-08-25') });
      console.log('KVKK: 1 veri sahibi talebi eklendi.');
    }

    // ================= SAKLAMA POLİTİKASI =================
    const existingRet = await db.select({ dataType: retentionPolicies.dataType }).from(retentionPolicies).where(eq(retentionPolicies.companyId, COMPANY_ID));
    if (!existingRet.some((r) => r.dataType === 'Muhasebe Fişleri')) {
      await db.insert(retentionPolicies).values({ id: id(), companyId: COMPANY_ID, dataType: 'Muhasebe Fişleri', legalBasis: 'VUK madde 253 — 5 yıl saklama zorunluluğu.', retentionYears: 5, startEvent: 'Fiş kayıt tarihi', deleteMethod: 'ARCHIVE', legalHoldSupported: true });
      console.log('KVKK: 1 saklama politikası eklendi.');
    }

    // ================= GÜVENLİK OLAYI =================
    const existingSecEvt = await db.select().from(securityEvents).where(eq(securityEvents.companyId, COMPANY_ID));
    if (existingSecEvt.length === 0) {
      await db.insert(securityEvents).values({ id: id(), companyId: COMPANY_ID, eventType: 'REPEATED_FAILED_LOGIN', riskLevel: 'MEDIUM', description: 'Aynı IP adresinden 5 dakika içinde 6 başarısız giriş denemesi tespit edildi.', status: 'RESOLVED', resolvedByUserId: ADMIN_USER_ID, resolvedAt: new Date('2026-08-29T10:15:00'), resolutionNote: 'İlgili kullanıcı ile görüşüldü, unutulan şifre olduğu doğrulandı.' });
      console.log('Güvenlik: 1 olay eklendi (çözümlenmiş).');
    }

    // ================= KULLANICI CİHAZI (mobil) =================
    const existingDevice = await db.select().from(userDevices).where(eq(userDevices.userId, ADMIN_USER_ID));
    if (existingDevice.length === 0) {
      await db.insert(userDevices).values({ id: id(), companyId: COMPANY_ID, userId: ADMIN_USER_ID, platform: 'ANDROID', appVersion: '1.4.2', osVersion: '14', trusted: true });
      console.log('Güvenlik: 1 kullanıcı cihazı eklendi.');
    }

    // ================= KİŞİSEL VERİ ENVANTERİ =================
    const existingPdi = await db.select().from(personalDataInventory).where(eq(personalDataInventory.companyId, COMPANY_ID));
    if (existingPdi.length === 0) {
      await db.insert(personalDataInventory).values([
        { id: id(), companyId: COMPANY_ID, tableName: 'employees', columnName: 'identity_reference', dataCategory: 'Kimlik', classification: 'SPECIAL_CATEGORY', purpose: 'Yasal bordro/SGK bildirimleri', legalBasis: 'İş Kanunu', encryptionRequired: true, maskingRequired: true, exportAllowed: false },
        { id: id(), companyId: COMPANY_ID, tableName: 'employee_contracts', columnName: 'base_salary', dataCategory: 'Finansal', classification: 'FINANCIAL', purpose: 'Bordro hesaplama', legalBasis: 'İş sözleşmesi', encryptionRequired: false, maskingRequired: true, exportAllowed: false }
      ]);
      console.log('KVKK: 2 kişisel veri envanteri kaydı eklendi.');
    }

    console.log('\n=== BATCH 10 (Core Security) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 10 başarısız:', err); process.exit(1); });

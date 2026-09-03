// IT modülü: Varlık, Konum, Ağ (VLAN/Subnet), CMDB, Bilgi Bankası,
// Incident/Problem/Değişiklik, Servis Masası Ticket'ı, SLA, Yedekleme,
// İzleme Hedefi. network_credentials (şifreli alan) BİLİNÇLİ OLARAK
// atlandı — gerçek şifreleme formatını riske atmaktansa boş bırakmak
// yeğdir (yanlış "şifreli" veri, decrypt denemesinde sessizce bozulabilir).
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and } from 'drizzle-orm';
import {
  users, departments, branches,
  itAssets, itLocations,
  networkSubnets, networkVlans,
  configurationItems,
  kbCategories, kbArticles,
  incidents, problems, changes,
  serviceDeskTickets, slaPolicies,
  backupJobs, monitorTargets
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d';

function id() { return crypto.randomUUID(); }

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  const connection = await mysql.createConnection(url!);
  const db = drizzle(connection, { mode: 'default' });

  try {
    const [itDept] = await db.select().from(departments).where(and(eq(departments.companyId, COMPANY_ID), eq(departments.departmentTypeCode, 'IT')));
    const [branch] = await db.select({ id: branches.id }).from(branches).where(eq(branches.companyId, COMPANY_ID));
    const itUsers = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.companyId, COMPANY_ID));
    const itMudur = itUsers.find((u) => u.email === 'it.mudur@denemeahmet.local')?.id ?? ADMIN_USER_ID;

    // ================= KONUM =================
    const existingLoc = await db.select({ name: itLocations.name }).from(itLocations).where(eq(itLocations.companyId, COMPANY_ID));
    let serverRoomId: string;
    if (!existingLoc.some((l) => l.name === 'Sunucu Odası')) {
      serverRoomId = id();
      await db.insert(itLocations).values({ id: serverRoomId, companyId: COMPANY_ID, branchId: branch?.id, locationType: 'DATA_CENTER', name: 'Sunucu Odası', rackUnits: 42 });
      console.log('IT: 1 konum eklendi (Sunucu Odası).');
    } else {
      const [existing] = await db.select({ id: itLocations.id }).from(itLocations).where(and(eq(itLocations.companyId, COMPANY_ID), eq(itLocations.name, 'Sunucu Odası')));
      serverRoomId = existing.id;
    }

    // ================= AĞ (VLAN + Subnet) =================
    const existingVlan = await db.select({ vlanNumber: networkVlans.vlanNumber }).from(networkVlans).where(eq(networkVlans.companyId, COMPANY_ID));
    let vlanId: string | undefined;
    if (!existingVlan.some((v) => v.vlanNumber === 10)) {
      vlanId = id();
      await db.insert(networkVlans).values({ id: vlanId, companyId: COMPANY_ID, branchId: branch?.id, vlanNumber: 10, name: 'Üretim VLAN', gateway: '10.10.0.1', dhcpEnabled: true, purpose: 'Üretim hattı cihazları', networkZone: 'OT', securityLevel: 'MEDIUM' });
    }
    const existingSubnet = await db.select({ cidr: networkSubnets.cidr }).from(networkSubnets).where(eq(networkSubnets.companyId, COMPANY_ID));
    if (!existingSubnet.some((s) => s.cidr === '10.10.0.0/24')) {
      await db.insert(networkSubnets).values({ id: id(), companyId: COMPANY_ID, branchId: branch?.id, cidr: '10.10.0.0/24', gateway: '10.10.0.1', dnsPrimary: '8.8.8.8', dnsSecondary: '8.8.4.4', vlanId, dhcpEnabled: true, description: 'Üretim hattı ağı.' });
    }
    console.log('IT: 1 VLAN, 1 subnet eklendi.');

    // ================= VARLIK =================
    const existingAssets = await db.select({ assetTag: itAssets.assetTag }).from(itAssets).where(eq(itAssets.companyId, COMPANY_ID));
    let serverId: string;
    if (!existingAssets.some((a) => a.assetTag === 'SRV-001')) {
      serverId = id();
      await db.insert(itAssets).values({ id: serverId, companyId: COMPANY_ID, branchId: branch?.id, locationId: serverRoomId, departmentId: itDept?.id, assetTypeCode: 'SERVER', assetTag: 'SRV-001', name: 'Ana Uygulama Sunucusu', manufacturer: 'Dell', model: 'PowerEdge R750', serialNumber: 'DL-2024-77821', status: 'IN_SERVICE', createdByUserId: ADMIN_USER_ID });
    } else {
      const [existing] = await db.select({ id: itAssets.id }).from(itAssets).where(and(eq(itAssets.companyId, COMPANY_ID), eq(itAssets.assetTag, 'SRV-001')));
      serverId = existing.id;
    }
    const existingLaptop = await db.select({ assetTag: itAssets.assetTag }).from(itAssets).where(eq(itAssets.companyId, COMPANY_ID));
    if (!existingLaptop.some((a) => a.assetTag === 'LT-014')) {
      await db.insert(itAssets).values({ id: id(), companyId: COMPANY_ID, branchId: branch?.id, departmentId: itDept?.id, assetTypeCode: 'LAPTOP', assetTag: 'LT-014', name: 'Dizüstü Bilgisayar - Muhasebe', manufacturer: 'Lenovo', model: 'ThinkPad T14', serialNumber: 'LN-2025-33410', status: 'ASSIGNED', createdByUserId: ADMIN_USER_ID });
    }
    console.log('IT: 2 varlık eklendi (sunucu + dizüstü).');

    // ================= CMDB =================
    const existingCi = await db.select({ ciKey: configurationItems.ciKey }).from(configurationItems).where(eq(configurationItems.companyId, COMPANY_ID));
    if (!existingCi.some((c) => c.ciKey === 'CI-ERP-APP')) {
      await db.insert(configurationItems).values({ id: id(), companyId: COMPANY_ID, ciType: 'APPLICATION', linkedAssetId: serverId, name: 'emakfabrika ERP Uygulaması', ciKey: 'CI-ERP-APP', status: 'ACTIVE' });
      console.log('IT: 1 CMDB kaydı eklendi.');
    }

    // ================= BİLGİ BANKASI =================
    const existingKbCat = await db.select({ name: kbCategories.name }).from(kbCategories).where(eq(kbCategories.companyId, COMPANY_ID));
    let kbCatId: string;
    if (!existingKbCat.some((c) => c.name === 'Sık Sorulan Sorular')) {
      kbCatId = id();
      await db.insert(kbCategories).values({ id: kbCatId, companyId: COMPANY_ID, name: 'Sık Sorulan Sorular' });
    } else {
      const [existing] = await db.select({ id: kbCategories.id }).from(kbCategories).where(and(eq(kbCategories.companyId, COMPANY_ID), eq(kbCategories.name, 'Sık Sorulan Sorular')));
      kbCatId = existing.id;
    }
    const existingKb = await db.select({ title: kbArticles.title }).from(kbArticles).where(eq(kbArticles.companyId, COMPANY_ID));
    if (!existingKb.some((a) => a.title === 'Şifremi unuttum, ne yapmalıyım?')) {
      await db.insert(kbArticles).values({ id: id(), companyId: COMPANY_ID, categoryId: kbCatId, title: 'Şifremi unuttum, ne yapmalıyım?', content: 'Giriş ekranındaki "Şifremi unuttum" bağlantısına tıklayıp kayıtlı e-posta adresinize gelen bağlantıyla yeni şifre belirleyebilirsiniz. Sorun devam ederse IT Servis Masası\'na ticket açın.', authorUserId: itMudur, viewCount: 42 });
      console.log('IT: 1 KB kategorisi, 1 makale eklendi.');
    }

    // ================= INCIDENT / PROBLEM / DEĞİŞİKLİK =================
    const existingInc = await db.select({ title: incidents.title }).from(incidents).where(eq(incidents.companyId, COMPANY_ID));
    if (!existingInc.some((i) => i.title === 'ERP uygulaması yavaşladı')) {
      await db.insert(incidents).values({ id: id(), companyId: COMPANY_ID, title: 'ERP uygulaması yavaşladı', description: 'Öğleden sonra 14:00-15:30 arası uygulama yanıt süreleri normalin 5 katına çıktı.', severity: 'HIGH', status: 'RESOLVED', openedByUserId: itMudur, resolvedAt: new Date('2026-08-28T15:45:00') });
    }
    const existingProb = await db.select({ title: problems.title }).from(problems).where(eq(problems.companyId, COMPANY_ID));
    if (!existingProb.some((p) => p.title === 'Sunucu disk I/O darboğazı')) {
      await db.insert(problems).values({ id: id(), companyId: COMPANY_ID, title: 'Sunucu disk I/O darboğazı', rootCause: 'Veritabanı disk dizisi eski nesil HDD, yoğun saatlerde IOPS yetersiz kalıyor.', status: 'ROOT_CAUSE_IDENTIFIED', openedByUserId: itMudur });
    }
    const existingChg = await db.select({ title: changes.title }).from(changes).where(eq(changes.companyId, COMPANY_ID));
    if (!existingChg.some((c) => c.title === 'Veritabanı disklerini SSD\'ye yükselt')) {
      await db.insert(changes).values({ id: id(), companyId: COMPANY_ID, title: "Veritabanı disklerini SSD'ye yükselt", description: 'Disk I/O darboğazını çözmek için sunucu disk dizisi NVMe SSD ile değiştirilecek.', riskLevel: 'MEDIUM', impactLevel: 'HIGH', status: 'SCHEDULED', requestedByUserId: itMudur, scheduledAt: new Date('2026-09-20T22:00:00') });
    }
    console.log('IT: 1 incident, 1 problem, 1 değişiklik eklendi.');

    // ================= SLA + SERVİS MASASI =================
    const existingSla = await db.select({ priority: slaPolicies.priority }).from(slaPolicies).where(eq(slaPolicies.companyId, COMPANY_ID));
    let slaId: string | undefined;
    if (!existingSla.some((s) => s.priority === 'HIGH')) {
      slaId = id();
      await db.insert(slaPolicies).values({ id: slaId, companyId: COMPANY_ID, name: 'Yüksek Öncelik SLA', priority: 'HIGH', responseMinutes: 30, resolutionHours: 4, escalationChain: ['SERVICE_DESK_AGENT', 'IT_MANAGER'] });
    } else {
      const [existing] = await db.select({ id: slaPolicies.id }).from(slaPolicies).where(and(eq(slaPolicies.companyId, COMPANY_ID), eq(slaPolicies.priority, 'HIGH')));
      slaId = existing.id;
    }
    const existingTicket = await db.select({ ticketNo: serviceDeskTickets.ticketNo }).from(serviceDeskTickets).where(eq(serviceDeskTickets.companyId, COMPANY_ID));
    if (!existingTicket.some((t) => t.ticketNo === 'TKT20260101') && itDept) {
      await db.insert(serviceDeskTickets).values({
        id: id(), companyId: COMPANY_ID, departmentId: itDept.id, ticketNo: 'TKT20260101', ticketType: 'STANDARD',
        title: 'Yazıcı kağıt sıkışması', description: 'Muhasebe ofisindeki yazıcı sürekli kağıt sıkıştırıyor.', category: 'Donanım',
        priority: 'NORMAL', status: 'ASSIGNED', requestedByUserId: ADMIN_USER_ID, relatedAssetId: serverId, slaPolicyId: slaId, slaDueAt: new Date('2026-09-04T12:00:00')
      });
      console.log('IT: 1 SLA politikası, 1 servis masası ticket\'ı eklendi.');
    }

    // ================= YEDEKLEME + İZLEME =================
    const existingBackup = await db.select().from(backupJobs).where(eq(backupJobs.assetId, serverId));
    if (existingBackup.length === 0) {
      await db.insert(backupJobs).values({ id: id(), companyId: COMPANY_ID, assetId: serverId, source: '/var/lib/mysql', destination: 's3://emakfabrika-backup/db', schedule: '0 2 * * *', retentionDays: 30, encryption: true });
    }
    const existingMonitor = await db.select().from(monitorTargets).where(eq(monitorTargets.assetId, serverId));
    if (existingMonitor.length === 0) {
      await db.insert(monitorTargets).values({ id: id(), companyId: COMPANY_ID, assetId: serverId, targetType: 'PING', intervalSeconds: 60 });
    }
    console.log('IT: 1 yedekleme işi, 1 izleme hedefi eklendi.');

    console.log('\n=== BATCH 7 (IT) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 7 başarısız:', err); process.exit(1); });

// Denetimde kalan GERÇEK boşluklar (Batch 11 sonrası hâlâ boş, ama
// kasıtlı-hariç listesinde OLMAYAN tablolar):
//   - work_orders / technician_locations / work_order_parts: Saha Servisi
//     (Faz 8) demo şirkette HİÇ kullanılmamış — mevcut 4 satır BAŞKA bir
//     şirkete ait (denetimde yanlışlıkla "dolu" görünüyordu çünkü bu alt
//     tabloların company_id kolonu yok, global sayılıyorlardı).
//   - sw_installations: IT Varlık Yönetimi'nin "hangi varlıkta hangi
//     yazılım kurulu" ekranı boştu.
//   - ip_addresses / ip_assignments: IPAM ekranı — NOT: "boş" adresler
//     CIDR aralığından UI'de hesaplanır (lib/it/ipam.ts), yalnızca GERÇEKTEN
//     atanmış adresler satır tutar; bu yüzden 1 ASSIGNED örnek yeterli.
//   - wh_locations: Depo Lokasyon (Zone/Aisle/Rack/Shelf/Bin) kırılımı.
//   - tax_rules / withholding_rules / exchange_rates: Mevzuat motoru ve
//     kur tablosu — şirket kapsamlı DEĞİL, genel referans verisi.
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and } from 'drizzle-orm';
import {
  serviceDeskTickets, itAssets, networkSubnets, networkInterfaces, softwareProducts, warehouses, users,
  workOrders, technicianLocations, workOrderParts, stockItems, stockMovements,
  softwareInstallations,
  ipAddresses, ipAssignments,
  whLocations,
  taxRules, withholdingRules, exchangeRates
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d';

function id() { return crypto.randomUUID(); }

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  const connection = await mysql.createConnection(url!);
  const db = drizzle(connection, { mode: 'default' });

  try {
    // ================= SAHA SERVİSİ (work_orders) =================
    const [ticket] = await db.select({ id: serviceDeskTickets.id }).from(serviceDeskTickets).where(eq(serviceDeskTickets.companyId, COMPANY_ID)).limit(1);
    const existingWo = await db.select().from(workOrders).where(eq(workOrders.companyId, COMPANY_ID));
    if (existingWo.length === 0 && ticket) {
      const workOrderId = id();
      await db.insert(workOrders).values({ id: workOrderId, companyId: COMPANY_ID, ticketId: ticket.id, arrivedAt: new Date('2026-08-29T09:30:00'), arrivalLatitude: '40.7659000', arrivalLongitude: '29.4344000', customerName: 'Fabrika Sahası — Gebze', signatureNote: 'Sunucu disk değişimi tamamlandı, müşteri onayı alındı.' });
      await db.insert(technicianLocations).values({ id: id(), userId: ADMIN_USER_ID, workOrderId, latitude: '40.7659000', longitude: '29.4344000', source: 'ARRIVAL_BUTTON', recordedAt: new Date('2026-08-29T09:30:00') });

      const [defaultWh] = await db.select().from(warehouses).where(eq(warehouses.companyId, COMPANY_ID)).limit(1);
      const [diskItem] = await db.select().from(stockItems).where(eq(stockItems.companyId, COMPANY_ID)).limit(1);
      if (diskItem && defaultWh) {
        const movementId = id();
        await db.insert(stockMovements).values({ id: movementId, companyId: COMPANY_ID, warehouseId: defaultWh.id, stockItemId: diskItem.id, movementType: 'OUT', quantity: '1.000000', unitCost: '3500.000000', sourceType: 'WORK_ORDER', sourceId: workOrderId, description: 'Saha servisi parça tüketimi', transactionDate: '2026-08-29', createdByUserId: ADMIN_USER_ID });
        await db.insert(workOrderParts).values({ id: id(), workOrderId, stockItemId: diskItem.id, stockMovementId: movementId, quantity: '1.000000', unitCost: '3500.000000', billable: true, consumedAt: new Date('2026-08-29T09:45:00'), consumedByUserId: ADMIN_USER_ID });
      }
      console.log('Saha Servisi: 1 work order, 1 teknisyen konumu' + (diskItem ? ', 1 parça tüketimi' : '') + ' eklendi.');
    }

    // ================= IT — YAZILIM KURULUMU =================
    const [server2] = await db.select().from(itAssets).where(and(eq(itAssets.companyId, COMPANY_ID), eq(itAssets.assetTag, 'SRV-001')));
    const [erpProduct] = await db.select().from(softwareProducts).where(eq(softwareProducts.companyId, COMPANY_ID)).limit(1);
    if (server2 && erpProduct) {
      const existingInstall = await db.select().from(softwareInstallations).where(and(eq(softwareInstallations.companyId, COMPANY_ID), eq(softwareInstallations.assetId, server2.id)));
      if (existingInstall.length === 0) {
        await db.insert(softwareInstallations).values({ id: id(), companyId: COMPANY_ID, productId: erpProduct.id, assetId: server2.id, installedVersion: '2026.3', installedAt: new Date('2026-02-05') });
        console.log('IT: 1 yazılım kurulumu eklendi.');
      }
    }

    // ================= IPAM =================
    const [subnet] = await db.select().from(networkSubnets).where(eq(networkSubnets.companyId, COMPANY_ID)).limit(1);
    const [iface] = await db.select().from(networkInterfaces).where(and(eq(networkInterfaces.companyId, COMPANY_ID), eq(networkInterfaces.assetId, server2?.id ?? ''))).limit(1);
    if (subnet) {
      const existingIp = await db.select().from(ipAddresses).where(and(eq(ipAddresses.subnetId, subnet.id), eq(ipAddresses.ipAddress, '10.10.0.10')));
      let ipId: string;
      if (existingIp.length === 0) {
        ipId = id();
        await db.insert(ipAddresses).values({ id: ipId, subnetId: subnet.id, ipAddress: '10.10.0.10', ipVersion: 'IPV4', status: 'ASSIGNED' });
      } else {
        ipId = existingIp[0].id;
      }
      if (iface && server2) {
        const existingAssignment = await db.select().from(ipAssignments).where(eq(ipAssignments.ipAddressId, ipId));
        if (existingAssignment.length === 0) {
          await db.insert(ipAssignments).values({ id: id(), ipAddressId: ipId, assetId: server2.id, networkInterfaceId: iface.id, assignmentType: 'STATIC', assignedAt: new Date('2024-02-01') });
        }
      }
      console.log('IPAM: 1 IP adresi (ASSIGNED), 1 atama eklendi.');
    }

    // ================= DEPO LOKASYONU =================
    const whRows = await db.select().from(warehouses).where(eq(warehouses.companyId, COMPANY_ID));
    const anaDepo = whRows.find((w) => w.name === 'Ana Mamul Deposu');
    const existingLoc = await db.select({ code: whLocations.code }).from(whLocations).where(eq(whLocations.warehouseId, anaDepo?.id ?? ''));
    if (anaDepo && !existingLoc.some((l) => l.code === 'A-01')) {
      const zoneId = id();
      await db.insert(whLocations).values({ id: zoneId, warehouseId: anaDepo.id, locationType: 'ZONE', code: 'A', name: 'A Bölgesi' });
      const aisleId = id();
      await db.insert(whLocations).values({ id: aisleId, warehouseId: anaDepo.id, parentLocationId: zoneId, locationType: 'AISLE', code: 'A-01', name: 'A Koridoru 1' });
      const rackId = id();
      await db.insert(whLocations).values({ id: rackId, warehouseId: anaDepo.id, parentLocationId: aisleId, locationType: 'RACK', code: 'A-01-R1', name: 'Raf 1' });
      await db.insert(whLocations).values({ id: id(), warehouseId: anaDepo.id, parentLocationId: rackId, locationType: 'SHELF', code: 'A-01-R1-S1', name: 'Göz 1' });
      console.log('Depo: 4 seviyeli lokasyon hiyerarşisi eklendi (Zone->Aisle->Rack->Shelf).');
    }

    // ================= MEVZUAT MOTORU (genel referans) =================
    const existingTaxRule = await db.select({ ruleCode: taxRules.ruleCode }).from(taxRules);
    if (!existingTaxRule.some((r) => r.ruleCode === 'KDV-GENEL-20')) {
      await db.insert(taxRules).values({ id: id(), ruleCode: 'KDV-GENEL-20', ruleName: 'Genel Oranlı KDV', description: 'Türkiye genel KDV oranı.', effectiveFrom: '2023-07-10', country: 'TR', calculationMethod: 'PERCENTAGE', rate: '0.200000', status: 'ACTIVE', sourceReference: '3065 sayılı KDV Kanunu, 2023/7 sayılı BKK' });
      console.log('Mevzuat: 1 vergi kuralı eklendi (KDV %20).');
    }
    const existingWhRule = await db.select({ ruleCode: withholdingRules.ruleCode }).from(withholdingRules);
    if (!existingWhRule.some((r) => r.ruleCode === 'TEVKIFAT-9-10-HIZMET')) {
      await db.insert(withholdingRules).values({ id: id(), ruleCode: 'TEVKIFAT-9-10-HIZMET', ruleName: 'Hizmet İşlerinde KDV Tevkifatı', description: 'Belirli hizmet alımlarında uygulanan kısmi tevkifat oranı.', effectiveFrom: '2023-07-10', sector: 'Hizmet', rate: '0.900000', fractionLabel: '9/10', status: 'ACTIVE', sourceReference: 'KDV Genel Uygulama Tebliği' });
      console.log('Mevzuat: 1 tevkifat kuralı eklendi (9/10).');
    }

    // ================= KUR TABLOSU =================
    const existingRate = await db.select().from(exchangeRates).where(and(eq(exchangeRates.currencyCode, 'USD'), eq(exchangeRates.rateDate, '2026-09-01')));
    if (existingRate.length === 0) {
      await db.insert(exchangeRates).values([
        { id: id(), currencyCode: 'USD', rateDate: '2026-09-01', rate: '34.250000', rateType: 'CENTRAL_BANK', source: 'TCMB' },
        { id: id(), currencyCode: 'EUR', rateDate: '2026-09-01', rate: '37.100000', rateType: 'CENTRAL_BANK', source: 'TCMB' }
      ]);
      console.log('Kur Tablosu: 2 kur eklendi (USD, EUR — 2026-09-01, TCMB).');
    }

    console.log('\n=== BATCH 12 (Kalan gerçek boşluklar) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 12 başarısız:', err); process.exit(1); });

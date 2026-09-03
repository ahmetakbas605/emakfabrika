// seed-batch-1-foundation.ts ilk çalıştırmada party_roles'te (Anadolu/
// Marmara için CUSTOMER rolü ZATEN vardı) durdu — brands/product_cats/
// units/products/parties/price_list_items'a kadar olan kısım BAŞARIYLA
// eklendi. Bu betik oradan DEVAM eder: gereken ID'leri DOĞAL ANAHTARLA
// (ad/kod/sku) veritabanından okur, yeniden üretmez; kalan tüm ekleri
// (party_roles eksikleri, adres/kontak, ödeme vadesi, fiyat listesi,
// muhasebe hesapları, masraf merkezi, bütçe, depo, filo, sabit kıymet,
// çek, kasa/banka) yapar.
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and, inArray } from 'drizzle-orm';
import {
  brands, productCats, products, units,
  parties, partyRoles, partyAddresses, partyContacts, productSuppliers,
  paymentTerms, priceLists, priceListItems,
  accountingAccounts,
  branches, warehouses, stockItems,
  vehicles, fixedAssets, checks, cashAccounts, bankAccounts,
  budgets, budgetItems, costCenters
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d';

function id() { return crypto.randomUUID(); }

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  const connection = await mysql.createConnection(url!);
  const db = drizzle(connection, { mode: 'default' });

  try {
    // --- Daha önce eklenenlerin ID'lerini DOĞAL ANAHTARLA oku ---
    const brandRows = await db.select().from(brands).where(eq(brands.companyId, COMPANY_ID));
    const brandByName = Object.fromEntries(brandRows.map((b) => [b.name, b.id]));

    const catRows = await db.select().from(productCats).where(eq(productCats.companyId, COMPANY_ID));
    const catByCode = Object.fromEntries(catRows.map((c) => [c.code, c.id]));

    const unitRows = await db.select().from(units).where(eq(units.companyId, COMPANY_ID));
    const unitByCode = Object.fromEntries(unitRows.map((u) => [u.code, u.id]));

    const productRows = await db.select().from(products).where(eq(products.companyId, COMPANY_ID));
    const productBySku = Object.fromEntries(productRows.map((p) => [p.sku, p.id]));

    const partyRows = await db.select().from(parties).where(eq(parties.companyId, COMPANY_ID));
    const partyByCode = Object.fromEntries(partyRows.map((p) => [p.code, p.id]));
    const partyIdAnadolu = partyByCode['CARI2026000001'];
    const partyIdMarmara = partyByCode['CARI2026000002'];
    const partyIdCelikTedarik = partyByCode['CARI2026000003'];
    const partyIdEgeLojistik = partyByCode['CARI2026000004'];
    const partyIdYapiInsaat = partyByCode['CARI2026000005'];

    console.log('Okunan doğal anahtarlar:', { brands: Object.keys(brandByName), cats: Object.keys(catByCode), units: Object.keys(unitByCode), products: Object.keys(productBySku), parties: Object.keys(partyByCode) });

    // --- party_roles: yalnızca EKSİK olanları ekle ---
    const existingRoles = await db.select().from(partyRoles).where(inArray(partyRoles.partyId, [partyIdAnadolu, partyIdMarmara, partyIdCelikTedarik, partyIdEgeLojistik, partyIdYapiInsaat]));
    const existingKey = new Set(existingRoles.map((r) => `${r.partyId}:${r.role}`));
    const desiredRoles: { partyId: string; role: 'CUSTOMER' | 'SUPPLIER' }[] = [
      { partyId: partyIdAnadolu, role: 'CUSTOMER' },
      { partyId: partyIdMarmara, role: 'CUSTOMER' },
      { partyId: partyIdMarmara, role: 'SUPPLIER' },
      { partyId: partyIdCelikTedarik, role: 'SUPPLIER' },
      { partyId: partyIdEgeLojistik, role: 'SUPPLIER' },
      { partyId: partyIdYapiInsaat, role: 'CUSTOMER' }
    ];
    const missingRoles = desiredRoles.filter((r) => !existingKey.has(`${r.partyId}:${r.role}`));
    if (missingRoles.length > 0) {
      await db.insert(partyRoles).values(missingRoles.map((r) => ({ id: id(), partyId: r.partyId, role: r.role })));
    }
    console.log(`party_roles: ${missingRoles.length} yeni satır eklendi (${desiredRoles.length - missingRoles.length} zaten vardı).`);

    // --- Adres / Kontak / Tedarikçi eşleme (yalnızca yoksa) ---
    const existingAddr = await db.select({ partyId: partyAddresses.partyId }).from(partyAddresses).where(inArray(partyAddresses.partyId, [partyIdAnadolu, partyIdCelikTedarik]));
    if (!existingAddr.some((a) => a.partyId === partyIdAnadolu)) {
      await db.insert(partyAddresses).values({ id: id(), partyId: partyIdAnadolu, addressType: 'BILLING', label: 'Merkez', addressLine: 'Organize Sanayi Bölgesi 5. Cadde No:12', city: 'Kocaeli', district: 'Gebze', isDefault: true });
    }
    if (!existingAddr.some((a) => a.partyId === partyIdCelikTedarik)) {
      await db.insert(partyAddresses).values({ id: id(), partyId: partyIdCelikTedarik, addressType: 'SHIPPING', label: 'Fabrika', addressLine: 'Çayırova OSB 3. Sokak No:7', city: 'Kocaeli', district: 'Çayırova', isDefault: true });
    }

    const existingContact = await db.select({ partyId: partyContacts.partyId }).from(partyContacts).where(inArray(partyContacts.partyId, [partyIdAnadolu, partyIdCelikTedarik]));
    if (!existingContact.some((c) => c.partyId === partyIdAnadolu)) {
      await db.insert(partyContacts).values({ id: id(), partyId: partyIdAnadolu, fullName: 'Serkan Yılmaz', title: 'Satınalma Müdürü', email: 'serkan.yilmaz@anadolusanayi.com.tr', phone: '05321112233', isPrimary: true });
    }
    if (!existingContact.some((c) => c.partyId === partyIdCelikTedarik)) {
      await db.insert(partyContacts).values({ id: id(), partyId: partyIdCelikTedarik, fullName: 'Elif Şahin', title: 'Satış Temsilcisi', email: 'elif.sahin@celiktedarik.com.tr', phone: '05339998877', isPrimary: true });
    }

    const existingSupplier = await db.select().from(productSuppliers).where(and(eq(productSuppliers.productId, productBySku['URN-004']), eq(productSuppliers.supplierPartyId, partyIdCelikTedarik)));
    if (existingSupplier.length === 0) {
      await db.insert(productSuppliers).values({ id: id(), productId: productBySku['URN-004'], supplierPartyId: partyIdCelikTedarik, supplierSku: 'CT-SAC-2MM', purchasePrice: '28.500000', currencyCode: 'TRY', leadTimeDays: 7, minOrderQty: '500.000000' });
    }
    console.log('Adres/kontak/tedarikçi eşleme tamam.');

    // --- Ödeme vadesi ---
    const existingTerms = await db.select({ code: paymentTerms.code }).from(paymentTerms).where(eq(paymentTerms.companyId, COMPANY_ID));
    const existingTermCodes = new Set(existingTerms.map((t) => t.code));
    const paymentTermIds = { pesin: id(), net30: id(), net60: id() };
    const termsToAdd = [
      { id: paymentTermIds.pesin, code: 'PESIN', name: 'Peşin', netDays: 0 },
      { id: paymentTermIds.net30, code: 'NET30', name: '30 Gün Vadeli', netDays: 30 },
      { id: paymentTermIds.net60, code: 'NET60', name: '60 Gün Vadeli', netDays: 60 }
    ].filter((t) => !existingTermCodes.has(t.code));
    if (termsToAdd.length > 0) {
      await db.insert(paymentTerms).values(termsToAdd.map((t) => ({ id: t.id, companyId: COMPANY_ID, code: t.code, name: t.name, netDays: t.netDays })));
    }
    console.log(`Ödeme vadesi: ${termsToAdd.length} yeni (toplam istenen 3).`);

    // --- Fiyat listesi (price_list_items zaten 1 satır var — muhtemelen
    // eski bir manuel test, dokunulmadı; YENİ bir liste ekleniyor) ---
    const existingPriceList = await db.select({ id: priceLists.id }).from(priceLists).where(and(eq(priceLists.companyId, COMPANY_ID), eq(priceLists.name, '2026 Genel Fiyat Listesi')));
    if (existingPriceList.length === 0) {
      const priceListId = id();
      await db.insert(priceLists).values({ id: priceListId, companyId: COMPANY_ID, name: '2026 Genel Fiyat Listesi', currencyCode: 'TRY', validFrom: '2026-01-01' });
      await db.insert(priceListItems).values([
        { id: id(), priceListId, productId: productBySku['URN-001'], price: '1250.000000' },
        { id: id(), priceListId, productId: productBySku['URN-002'], price: '8400.000000' },
        { id: id(), priceListId, productId: productBySku['URN-006'], price: '145.000000' }
      ]);
      console.log('Fiyat listesi eklendi (3 kalem).');
    } else {
      console.log('Fiyat listesi zaten vardı, atlandı.');
    }

    // --- Muhasebe hesap planı eksikleri ---
    const existingAccounts = await db.select({ code: accountingAccounts.code }).from(accountingAccounts).where(eq(accountingAccounts.companyId, COMPANY_ID));
    const existingAccountCodes = new Set(existingAccounts.map((a) => a.code));
    const acctIds = { stok: id(), kdvIndirilecek: id(), kdvHesaplanan: id(), tesisMakine: id(), demirbas: id(), birikmisAmortisman: id(), amortismanGideri: id(), alinanCekler: id(), verilenCekler: id(), pazarlamaKasa: id() };
    const acctsToAdd = [
      { id: acctIds.stok, code: '153', name: 'Ticari Mallar', normalBalance: 'DEBIT' as const, accountType: 'ASSET' as const },
      { id: acctIds.kdvIndirilecek, code: '191', name: 'İndirilecek KDV', normalBalance: 'DEBIT' as const, accountType: 'ASSET' as const },
      { id: acctIds.kdvHesaplanan, code: '391', name: 'Hesaplanan KDV', normalBalance: 'CREDIT' as const, accountType: 'LIABILITY' as const },
      { id: acctIds.tesisMakine, code: '253', name: 'Tesis, Makine ve Cihazlar', normalBalance: 'DEBIT' as const, accountType: 'ASSET' as const },
      { id: acctIds.demirbas, code: '255', name: 'Demirbaşlar', normalBalance: 'DEBIT' as const, accountType: 'ASSET' as const },
      { id: acctIds.birikmisAmortisman, code: '257', name: 'Birikmiş Amortismanlar', normalBalance: 'CREDIT' as const, accountType: 'ASSET' as const },
      { id: acctIds.amortismanGideri, code: '770', name: 'Genel Yönetim Giderleri - Amortisman', normalBalance: 'DEBIT' as const, accountType: 'EXPENSE' as const },
      { id: acctIds.alinanCekler, code: '101', name: 'Alınan Çekler', normalBalance: 'DEBIT' as const, accountType: 'ASSET' as const },
      { id: acctIds.verilenCekler, code: '103', name: 'Verilen Çekler ve Ödeme Emirleri', normalBalance: 'CREDIT' as const, accountType: 'LIABILITY' as const },
      { id: acctIds.pazarlamaKasa, code: '100.02', name: 'Pazarlama Mağaza Kasası', normalBalance: 'DEBIT' as const, accountType: 'ASSET' as const }
    ].filter((a) => !existingAccountCodes.has(a.code));
    if (acctsToAdd.length > 0) {
      await db.insert(accountingAccounts).values(acctsToAdd.map((a) => ({ id: a.id, companyId: COMPANY_ID, code: a.code, name: a.name, normalBalance: a.normalBalance, accountType: a.accountType })));
    }
    const allAccounts = await db.select().from(accountingAccounts).where(eq(accountingAccounts.companyId, COMPANY_ID));
    const acctByCode = Object.fromEntries(allAccounts.map((a) => [a.code, a.id]));
    console.log(`Muhasebe hesabı: ${acctsToAdd.length} yeni (toplam ${allAccounts.length}).`);

    // --- Masraf merkezi ---
    const existingCC = await db.select({ code: costCenters.code }).from(costCenters).where(eq(costCenters.companyId, COMPANY_ID));
    const existingCCCodes = new Set(existingCC.map((c) => c.code));
    const costCenterIds = { uretim: id(), satis: id(), genelYonetim: id() };
    const ccToAdd = [
      { id: costCenterIds.uretim, code: 'CC-URT', name: 'Üretim' },
      { id: costCenterIds.satis, code: 'CC-SAT', name: 'Satış & Pazarlama' },
      { id: costCenterIds.genelYonetim, code: 'CC-GNL', name: 'Genel Yönetim' }
    ].filter((c) => !existingCCCodes.has(c.code));
    if (ccToAdd.length > 0) await db.insert(costCenters).values(ccToAdd.map((c) => ({ id: c.id, companyId: COMPANY_ID, code: c.code, name: c.name })));
    const allCC = await db.select().from(costCenters).where(eq(costCenters.companyId, COMPANY_ID));
    const ccByCode = Object.fromEntries(allCC.map((c) => [c.code, c.id]));

    // --- Bütçe ---
    const existingBudget = await db.select({ id: budgets.id }).from(budgets).where(and(eq(budgets.companyId, COMPANY_ID), eq(budgets.name, '2026 Yıllık Bütçe')));
    if (existingBudget.length === 0) {
      const budgetId = id();
      await db.insert(budgets).values({ id: budgetId, companyId: COMPANY_ID, name: '2026 Yıllık Bütçe', periodStart: '2026-01-01', periodEnd: '2026-12-31', status: 'ACTIVE' });
      await db.insert(budgetItems).values([
        { id: id(), budgetId, accountId: acctByCode['770'], costCenterId: ccByCode['CC-URT'], month: 1, plannedAmount: '15000.000000' },
        { id: id(), budgetId, accountId: acctByCode['770'], costCenterId: ccByCode['CC-URT'], month: 2, plannedAmount: '15000.000000' }
      ]);
      console.log('Bütçe eklendi (2 kalem).');
    } else {
      console.log('Bütçe zaten vardı, atlandı.');
    }

    // --- Şube / Depo / Stok kartı ---
    const existingBranch = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.companyId, COMPANY_ID), eq(branches.name, 'Merkez Fabrika')));
    const branchId = existingBranch.length > 0 ? existingBranch[0].id : id();
    if (existingBranch.length === 0) {
      await db.insert(branches).values({ id: branchId, companyId: COMPANY_ID, name: 'Merkez Fabrika', address: 'Organize Sanayi Bölgesi 2. Cadde No:8', city: 'Kocaeli', district: 'Gebze' });
    }

    const existingWh = await db.select({ name: warehouses.name }).from(warehouses).where(eq(warehouses.companyId, COMPANY_ID));
    const existingWhNames = new Set(existingWh.map((w) => w.name));
    const warehouseIds = { anaDepo: id(), hammaddeDepo: id() };
    const whToAdd = [
      { id: warehouseIds.anaDepo, name: 'Ana Mamul Deposu' },
      { id: warehouseIds.hammaddeDepo, name: 'Hammadde Deposu' }
    ].filter((w) => !existingWhNames.has(w.name));
    if (whToAdd.length > 0) await db.insert(warehouses).values(whToAdd.map((w) => ({ id: w.id, companyId: COMPANY_ID, branchId, name: w.name })));

    const existingSi = await db.select({ sku: stockItems.sku }).from(stockItems).where(eq(stockItems.companyId, COMPANY_ID));
    const existingSiSkus = new Set(existingSi.map((s) => s.sku));
    const siToAdd = [
      { sku: 'URN-001', name: 'Endüstriyel Vana', unit: 'ADET', currentQty: '340.000000', avgCost: '780.000000', productId: productBySku['URN-001'], minQty: '50.000000' },
      { sku: 'URN-002', name: 'Endüstriyel Su Pompası', unit: 'ADET', currentQty: '85.000000', avgCost: '5200.000000', productId: productBySku['URN-002'], minQty: '15.000000' },
      { sku: 'URN-003', name: 'M12 Altı Köşe Civata', unit: 'ADET', currentQty: '18000.000000', avgCost: '3.200000', productId: productBySku['URN-003'], minQty: '2000.000000' },
      { sku: 'URN-004', name: 'Sıcak Haddelenmiş Çelik Sac', unit: 'KG', currentQty: '42500.000000', avgCost: '28.500000', productId: productBySku['URN-004'], minQty: '5000.000000' },
      { sku: 'URN-005', name: 'Çelik Boru Profil 40x40', unit: 'M', currentQty: '6200.000000', avgCost: '65.000000', productId: productBySku['URN-005'], minQty: '500.000000' },
      { sku: 'URN-006', name: 'Vana Conta Seti', unit: 'ADET', currentQty: '890.000000', avgCost: '42.000000', productId: productBySku['URN-006'], minQty: '100.000000' }
    ].filter((s) => !existingSiSkus.has(s.sku));
    if (siToAdd.length > 0) await db.insert(stockItems).values(siToAdd.map((s) => ({ id: id(), companyId: COMPANY_ID, ...s })));
    console.log(`Depo: ${whToAdd.length} yeni depo, ${siToAdd.length} yeni stok kartı.`);

    // --- Filo ---
    const existingVeh = await db.select({ plateNo: vehicles.plateNo }).from(vehicles).where(eq(vehicles.companyId, COMPANY_ID));
    const existingPlates = new Set(existingVeh.map((v) => v.plateNo));
    const vehToAdd = [
      { plateNo: '41 ABC 123', brand: 'Ford', model: 'Transit', year: 2023, fuelType: 'DIESEL' as const, status: 'ACTIVE' as const, registrationExpiryDate: '2027-03-15', purchaseDate: '2023-03-10' },
      { plateNo: 'FL-01', brand: 'Toyota', model: '02-8FD25', year: 2022, fuelType: 'DIESEL' as const, status: 'ACTIVE' as const, purchaseDate: '2022-06-01' }
    ].filter((v) => !existingPlates.has(v.plateNo));
    if (vehToAdd.length > 0) await db.insert(vehicles).values(vehToAdd.map((v) => ({ id: id(), companyId: COMPANY_ID, ...v })));
    console.log(`Filo: ${vehToAdd.length} yeni araç.`);

    // --- Sabit kıymet ---
    const existingFa = await db.select({ name: fixedAssets.name }).from(fixedAssets).where(eq(fixedAssets.companyId, COMPANY_ID));
    const existingFaNames = new Set(existingFa.map((f) => f.name));
    const faToAdd = [
      { name: 'CNC Torna Tezgahı', accountingAccountId: acctByCode['253'], accumDeprAccountId: acctByCode['257'], deprExpAccountId: acctByCode['770'], purchaseDate: '2024-02-01', purchaseCost: '850000.000000', usefulLifeYears: 10 },
      { name: 'Ofis Bilgisayarları (10 adet)', accountingAccountId: acctByCode['255'], accumDeprAccountId: acctByCode['257'], deprExpAccountId: acctByCode['770'], purchaseDate: '2025-01-15', purchaseCost: '180000.000000', usefulLifeYears: 4 }
    ].filter((f) => !existingFaNames.has(f.name));
    if (faToAdd.length > 0) await db.insert(fixedAssets).values(faToAdd.map((f) => ({ id: id(), companyId: COMPANY_ID, depreciationMethod: 'STRAIGHT_LINE' as const, status: 'ACTIVE' as const, createdByUserId: ADMIN_USER_ID, ...f })));

    // --- Çek ---
    const existingChecks = await db.select({ checkNo: checks.checkNo }).from(checks).where(eq(checks.companyId, COMPANY_ID));
    const existingCheckNos = new Set(existingChecks.map((c) => c.checkNo));
    const checksToAdd = [
      { direction: 'RECEIVED' as const, checkNo: 'CK-100234', bankName: 'Ziraat Bankası', partyName: 'Anadolu Sanayi A.Ş.', amount: '45000.000000', dueDate: '2026-11-15', status: 'PORTFOYDE', accountingAccountId: acctByCode['101'] },
      { direction: 'ISSUED' as const, checkNo: 'CK-500891', bankName: 'İş Bankası', partyName: 'Çelik Tedarik San. Tic. A.Ş.', amount: '28500.000000', dueDate: '2026-10-01', status: 'PORTFOYDE', accountingAccountId: acctByCode['103'] }
    ].filter((c) => !existingCheckNos.has(c.checkNo));
    if (checksToAdd.length > 0) await db.insert(checks).values(checksToAdd.map((c) => ({ id: id(), companyId: COMPANY_ID, createdByUserId: ADMIN_USER_ID, ...c })));
    console.log(`Sabit kıymet: ${faToAdd.length} yeni. Çek: ${checksToAdd.length} yeni.`);

    // --- Kasa / Banka ---
    const existingCash = await db.select({ name: cashAccounts.name }).from(cashAccounts).where(eq(cashAccounts.companyId, COMPANY_ID));
    let cashAccountId: string;
    if (!existingCash.some((c) => c.name === 'Merkez Kasa')) {
      cashAccountId = id();
      await db.insert(cashAccounts).values({ id: cashAccountId, companyId: COMPANY_ID, name: 'Merkez Kasa', accountingAccountId: acctByCode['100'] ?? (await db.select({ id: accountingAccounts.id }).from(accountingAccounts).where(and(eq(accountingAccounts.companyId, COMPANY_ID), eq(accountingAccounts.code, '100'))))[0].id, currency: 'TRY' });
    } else {
      console.log('Merkez Kasa zaten vardı.');
    }

    const existingBank = await db.select({ name: bankAccounts.name }).from(bankAccounts).where(eq(bankAccounts.companyId, COMPANY_ID));
    if (!existingBank.some((b) => b.name === 'Ziraat Bankası TL Hesabı')) {
      const acct102 = await db.select({ id: accountingAccounts.id }).from(accountingAccounts).where(and(eq(accountingAccounts.companyId, COMPANY_ID), eq(accountingAccounts.code, '102')));
      await db.insert(bankAccounts).values({ id: id(), companyId: COMPANY_ID, name: 'Ziraat Bankası TL Hesabı', iban: 'TR330006100519786457841326', accountingAccountId: acct102[0].id, currency: 'TRY' });
    } else {
      console.log('Banka hesabı zaten vardı.');
    }
    console.log('Kasa/Banka tamam.');

    console.log('\n=== BATCH 1 (devam) TAMAMLANDI ===');
    console.log(JSON.stringify({ warehouseIds, branchId, acctByCode, ccByCode, partyIds: { partyIdAnadolu, partyIdMarmara, partyIdCelikTedarik, partyIdEgeLojistik, partyIdYapiInsaat }, productBySku, unitByCode }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 1 devam başarısız:', err); process.exit(1); });

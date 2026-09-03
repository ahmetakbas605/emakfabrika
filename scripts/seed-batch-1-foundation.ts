// Demo şirkete (Deneme Ahmet A.Ş.) TEMEL veri — Ana Veri, Muhasebe Hesap
// Planı, Depo, Araç/Filo, Sabit Kıymet, Çek, Kasa/Banka, Bütçe.
//
// Kullanıcının isteği: "tüm ekranlara test verisi gir, boş ekran
// istemiyorum." Denetim (audit_tables.ts benzeri) 128 boş tablo buldu —
// bu, o listeyi kapatan bir dizi betikten İLKİ (temel/bağımlılığı olan
// diğer her şeyin üzerine kurulduğu katman).
//
// Bağlantıyı migrate.ts/ensure-department.ts gibi KENDİSİ kurar;
// src/db/client.ts `import 'server-only'` içerir, Next.js dışında
// çalışmaz. nextDocumentNo da server-only olduğu için AYNI atomik
// desen (INSERT...ON DUPLICATE + UPDATE +1) burada BİREBİR tekrarlanır
// — doc_number_seqs sayacı gerçek uygulamayla PAYLAŞILIR, ileride
// gerçek bir kayıt açıldığında numara ÇAKIŞMAZ.
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and, sql } from 'drizzle-orm';
import {
  companies, departments, users, employees,
  brands, productCats, products, units, priceLists, priceListItems,
  parties, partyRoles, partyAddresses, partyContacts, productSuppliers,
  paymentTerms, docNumberSeqs,
  accountingAccounts,
  branches, warehouses, stockItems,
  vehicles, fixedAssets, checks, cashAccounts, bankAccounts,
  budgets, budgetItems, costCenters
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d'; // admin@denemeahmet.local
const YEAR = 2026;

function id() { return crypto.randomUUID(); }

async function nextDocNo(db: ReturnType<typeof drizzle>, sequenceKey: string, prefix: string, padding = 6): Promise<string> {
  await db.insert(docNumberSeqs).values({ companyId: COMPANY_ID, sequenceKey, year: YEAR, lastNumber: 0 }).onDuplicateKeyUpdate({ set: { lastNumber: sql`last_number` } });
  await db.update(docNumberSeqs).set({ lastNumber: sql`${docNumberSeqs.lastNumber} + 1` }).where(and(eq(docNumberSeqs.companyId, COMPANY_ID), eq(docNumberSeqs.sequenceKey, sequenceKey), eq(docNumberSeqs.year, YEAR)));
  const [row] = await db.select({ lastNumber: docNumberSeqs.lastNumber }).from(docNumberSeqs).where(and(eq(docNumberSeqs.companyId, COMPANY_ID), eq(docNumberSeqs.sequenceKey, sequenceKey), eq(docNumberSeqs.year, YEAR))).limit(1);
  return `${prefix}${YEAR}${String(row!.lastNumber).padStart(padding, '0')}`;
}

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL yok');
  const connection = await mysql.createConnection(url);
  const db = drizzle(connection, { mode: 'default' });

  try {
    // ================= ANA VERİ =================
    const brandIds = { vana: id(), pompa: id() };
    await db.insert(brands).values([
      { id: brandIds.vana, companyId: COMPANY_ID, name: 'Vanotek' },
      { id: brandIds.pompa, companyId: COMPANY_ID, name: 'AquaFlow' }
    ]);

    const catIds = { hammadde: id(), yariMamul: id(), mamul: id(), yedekParca: id() };
    await db.insert(productCats).values([
      { id: catIds.hammadde, companyId: COMPANY_ID, code: 'HAM', name: 'Hammadde' },
      { id: catIds.yariMamul, companyId: COMPANY_ID, code: 'YMM', name: 'Yarı Mamul' },
      { id: catIds.mamul, companyId: COMPANY_ID, code: 'MMU', name: 'Mamul' },
      { id: catIds.yedekParca, companyId: COMPANY_ID, code: 'YPC', name: 'Yedek Parça' }
    ]);

    // Birimler: mevcut ADET'e ek olarak KG ve TON. TON->KG çevrimi, Faz 2
    // Kantar'ın "birim çevrimi yoksa tahmin yürütme" kuralının GERÇEKTEN
    // çalışabilmesi için lazım — bugüne kadar tek birim (ADET) vardı.
    const unitIds = { adet: '304f8801-24d5-4c24-91e8-5fa2138fc82f', kg: id(), ton: id(), metre: id() };
    await db.insert(units).values([
      { id: unitIds.kg, companyId: COMPANY_ID, code: 'KG', name: 'Kilogram' },
      { id: unitIds.metre, companyId: COMPANY_ID, code: 'M', name: 'Metre' }
    ]);
    await db.insert(units).values([
      { id: unitIds.ton, companyId: COMPANY_ID, code: 'TON', name: 'Ton', baseUnitId: unitIds.kg, conversionFactor: '1000.000000' }
    ]);

    const productIds = {
      vana: '346dc71a-e61e-4c72-91cf-4c8683d58ce1', // mevcut
      pompa: id(), civata: id(), celikSac: id(), boruProfil: id(), contaSeti: id()
    };
    await db.insert(products).values([
      { id: productIds.pompa, companyId: COMPANY_ID, sku: 'URN-002', name: 'Endüstriyel Su Pompası', brandId: brandIds.pompa, categoryId: catIds.mamul, productType: 'STOCK_ITEM', baseUnitId: unitIds.adet, taxRatePercent: '20.00', createdByUserId: ADMIN_USER_ID },
      { id: productIds.civata, companyId: COMPANY_ID, sku: 'URN-003', name: 'M12 Altı Köşe Civata', categoryId: catIds.yedekParca, productType: 'STOCK_ITEM', baseUnitId: unitIds.adet, taxRatePercent: '20.00', createdByUserId: ADMIN_USER_ID },
      { id: productIds.celikSac, companyId: COMPANY_ID, sku: 'URN-004', name: 'Sıcak Haddelenmiş Çelik Sac', categoryId: catIds.hammadde, productType: 'STOCK_ITEM', baseUnitId: unitIds.kg, taxRatePercent: '20.00', createdByUserId: ADMIN_USER_ID },
      { id: productIds.boruProfil, companyId: COMPANY_ID, sku: 'URN-005', name: 'Çelik Boru Profil 40x40', categoryId: catIds.yariMamul, productType: 'STOCK_ITEM', baseUnitId: unitIds.metre, taxRatePercent: '20.00', createdByUserId: ADMIN_USER_ID },
      { id: productIds.contaSeti, companyId: COMPANY_ID, sku: 'URN-006', name: 'Vana Conta Seti', categoryId: catIds.yedekParca, productType: 'STOCK_ITEM', baseUnitId: unitIds.adet, taxRatePercent: '20.00', createdByUserId: ADMIN_USER_ID }
    ]);

    const partyIds = {
      anadolu: '49696dd5-da3c-4fdb-aa9f-25c0cd9c8d72', // mevcut, müşteri
      marmara: '9421c6c4-9066-4409-86f8-a5102e3473cc', // mevcut
      celikTedarik: id(), egeLojistik: id(), yapiInsaat: id()
    };
    await db.insert(parties).values([
      { id: partyIds.celikTedarik, companyId: COMPANY_ID, partyType: 'COMPANY', code: 'CARI2026000003', legalName: 'Çelik Tedarik San. Tic. A.Ş.', taxNumber: '1112223334', taxOffice: 'Gebze Vergi Dairesi', phone: '02625551010', email: 'satis@celiktedarik.com.tr', createdByUserId: ADMIN_USER_ID },
      { id: partyIds.egeLojistik, companyId: COMPANY_ID, partyType: 'COMPANY', code: 'CARI2026000004', legalName: 'Ege Lojistik ve Nakliyat Ltd. Şti.', taxNumber: '2223334445', taxOffice: 'Bornova Vergi Dairesi', phone: '02323332020', email: 'info@egelojistik.com.tr', createdByUserId: ADMIN_USER_ID },
      // "müteahhit firma" — Faz 4 Satınalma köprüsünün ihtiyaç duyduğu
      // profil (Pazarlama sözleşmesinin karşı tarafı müteahhit olabilir).
      { id: partyIds.yapiInsaat, companyId: COMPANY_ID, partyType: 'COMPANY', code: 'CARI2026000005', legalName: 'Yapı İnşaat ve Taahhüt A.Ş.', taxNumber: '3334445556', taxOffice: 'Kadıköy Vergi Dairesi', phone: '02165553030', email: 'proje@yapiinsaat.com.tr', createdByUserId: ADMIN_USER_ID }
    ]);
    await db.insert(partyRoles).values([
      { id: id(), partyId: partyIds.anadolu, role: 'CUSTOMER' },
      { id: id(), partyId: partyIds.marmara, role: 'CUSTOMER' },
      { id: id(), partyId: partyIds.marmara, role: 'SUPPLIER' },
      { id: id(), partyId: partyIds.celikTedarik, role: 'SUPPLIER' },
      { id: id(), partyId: partyIds.egeLojistik, role: 'SUPPLIER' },
      { id: id(), partyId: partyIds.yapiInsaat, role: 'CUSTOMER' }
    ]);
    await db.insert(partyAddresses).values([
      { id: id(), partyId: partyIds.anadolu, addressType: 'BILLING', label: 'Merkez', addressLine: 'Organize Sanayi Bölgesi 5. Cadde No:12', city: 'Kocaeli', district: 'Gebze', isDefault: true },
      { id: id(), partyId: partyIds.celikTedarik, addressType: 'SHIPPING', label: 'Fabrika', addressLine: 'Çayırova OSB 3. Sokak No:7', city: 'Kocaeli', district: 'Çayırova', isDefault: true }
    ]);
    await db.insert(partyContacts).values([
      { id: id(), partyId: partyIds.anadolu, fullName: 'Serkan Yılmaz', title: 'Satınalma Müdürü', email: 'serkan.yilmaz@anadolusanayi.com.tr', phone: '05321112233', isPrimary: true },
      { id: id(), partyId: partyIds.celikTedarik, fullName: 'Elif Şahin', title: 'Satış Temsilcisi', email: 'elif.sahin@celiktedarik.com.tr', phone: '05339998877', isPrimary: true }
    ]);
    await db.insert(productSuppliers).values([
      { id: id(), productId: productIds.celikSac, supplierPartyId: partyIds.celikTedarik, supplierSku: 'CT-SAC-2MM', purchasePrice: '28.500000', currencyCode: 'TRY', leadTimeDays: 7, minOrderQty: '500.000000' }
    ]);

    const paymentTermIds = { pesin: id(), net30: id(), net60: id() };
    await db.insert(paymentTerms).values([
      { id: paymentTermIds.pesin, companyId: COMPANY_ID, code: 'PESIN', name: 'Peşin', netDays: 0 },
      { id: paymentTermIds.net30, companyId: COMPANY_ID, code: 'NET30', name: '30 Gün Vadeli', netDays: 30 },
      { id: paymentTermIds.net60, companyId: COMPANY_ID, code: 'NET60', name: '60 Gün Vadeli', netDays: 60 }
    ]);

    const priceListId = id();
    await db.insert(priceLists).values({ id: priceListId, companyId: COMPANY_ID, name: '2026 Genel Fiyat Listesi', currencyCode: 'TRY', validFrom: '2026-01-01' });
    await db.insert(priceListItems).values([
      { id: id(), priceListId, productId: productIds.vana, price: '1250.000000' },
      { id: id(), priceListId, productId: productIds.pompa, price: '8400.000000' },
      { id: id(), priceListId, productId: productIds.contaSeti, price: '145.000000' }
    ]);

    console.log('Ana veri: 2 marka, 4 kategori, 3 birim, 5 ürün (toplam 6), 3 yeni cari (toplam 5), 3 ödeme vadesi, 1 fiyat listesi (3 kalem).');

    // ================= MUHASEBE HESAP PLANI (eksikler) =================
    const acctIds = {
      stok: id(), kdvIndirilecek: id(), kdvHesaplanan: id(),
      tesisMakine: id(), demirbas: id(), birikmisAmortisman: id(),
      amortismanGideri: id(), alinanCekler: id(), verilenCekler: id(),
      pazarlamaKasa: id()
    };
    await db.insert(accountingAccounts).values([
      { id: acctIds.stok, companyId: COMPANY_ID, code: '153', name: 'Ticari Mallar', normalBalance: 'DEBIT', accountType: 'ASSET' },
      { id: acctIds.kdvIndirilecek, companyId: COMPANY_ID, code: '191', name: 'İndirilecek KDV', normalBalance: 'DEBIT', accountType: 'ASSET' },
      { id: acctIds.kdvHesaplanan, companyId: COMPANY_ID, code: '391', name: 'Hesaplanan KDV', normalBalance: 'CREDIT', accountType: 'LIABILITY' },
      { id: acctIds.tesisMakine, companyId: COMPANY_ID, code: '253', name: 'Tesis, Makine ve Cihazlar', normalBalance: 'DEBIT', accountType: 'ASSET' },
      { id: acctIds.demirbas, companyId: COMPANY_ID, code: '255', name: 'Demirbaşlar', normalBalance: 'DEBIT', accountType: 'ASSET' },
      { id: acctIds.birikmisAmortisman, companyId: COMPANY_ID, code: '257', name: 'Birikmiş Amortismanlar', normalBalance: 'CREDIT', accountType: 'ASSET' },
      { id: acctIds.amortismanGideri, companyId: COMPANY_ID, code: '770', name: 'Genel Yönetim Giderleri - Amortisman', normalBalance: 'DEBIT', accountType: 'EXPENSE' },
      { id: acctIds.alinanCekler, companyId: COMPANY_ID, code: '101', name: 'Alınan Çekler', normalBalance: 'DEBIT', accountType: 'ASSET' },
      { id: acctIds.verilenCekler, companyId: COMPANY_ID, code: '103', name: 'Verilen Çekler ve Ödeme Emirleri', normalBalance: 'CREDIT', accountType: 'LIABILITY' },
      { id: acctIds.pazarlamaKasa, companyId: COMPANY_ID, code: '100.02', name: 'Pazarlama Mağaza Kasası', normalBalance: 'DEBIT', accountType: 'ASSET' }
    ]);
    console.log('Muhasebe: 10 yeni hesap eklendi (toplam 16).');

    // ================= COST CENTERS =================
    const costCenterIds = { uretim: id(), satis: id(), genelYonetim: id() };
    await db.insert(costCenters).values([
      { id: costCenterIds.uretim, companyId: COMPANY_ID, code: 'CC-URT', name: 'Üretim' },
      { id: costCenterIds.satis, companyId: COMPANY_ID, code: 'CC-SAT', name: 'Satış & Pazarlama' },
      { id: costCenterIds.genelYonetim, companyId: COMPANY_ID, code: 'CC-GNL', name: 'Genel Yönetim' }
    ]);

    // ================= BÜTÇE =================
    const budgetId = id();
    await db.insert(budgets).values({ id: budgetId, companyId: COMPANY_ID, name: '2026 Yıllık Bütçe', periodStart: '2026-01-01', periodEnd: '2026-12-31', status: 'ACTIVE' });
    await db.insert(budgetItems).values([
      { id: id(), budgetId, accountId: acctIds.amortismanGideri, costCenterId: costCenterIds.uretim, month: 1, plannedAmount: '15000.000000' },
      { id: id(), budgetId, accountId: acctIds.amortismanGideri, costCenterId: costCenterIds.uretim, month: 2, plannedAmount: '15000.000000' }
    ]);
    console.log('3 masraf merkezi, 1 bütçe (2 kalem) eklendi.');

    // ================= DEPO =================
    const branchId = id();
    await db.insert(branches).values({ id: branchId, companyId: COMPANY_ID, name: 'Merkez Fabrika', address: 'Organize Sanayi Bölgesi 2. Cadde No:8', city: 'Kocaeli', district: 'Gebze' });

    const warehouseIds = { anaDepo: id(), hammaddeDepo: id() };
    await db.insert(warehouses).values([
      { id: warehouseIds.anaDepo, companyId: COMPANY_ID, branchId, name: 'Ana Mamul Deposu' },
      { id: warehouseIds.hammaddeDepo, companyId: COMPANY_ID, branchId, name: 'Hammadde Deposu' }
    ]);

    const stockItemIds = {
      vana: id(), pompa: id(), civata: id(), celikSac: id(), boruProfil: id(), contaSeti: id()
    };
    await db.insert(stockItems).values([
      { id: stockItemIds.vana, companyId: COMPANY_ID, sku: 'URN-001', name: 'Endüstriyel Vana', unit: 'ADET', currentQty: '340.000000', avgCost: '780.000000', productId: productIds.vana, minQty: '50.000000' },
      { id: stockItemIds.pompa, companyId: COMPANY_ID, sku: 'URN-002', name: 'Endüstriyel Su Pompası', unit: 'ADET', currentQty: '85.000000', avgCost: '5200.000000', productId: productIds.pompa, minQty: '15.000000' },
      { id: stockItemIds.civata, companyId: COMPANY_ID, sku: 'URN-003', name: 'M12 Altı Köşe Civata', unit: 'ADET', currentQty: '18000.000000', avgCost: '3.200000', productId: productIds.civata, minQty: '2000.000000' },
      { id: stockItemIds.celikSac, companyId: COMPANY_ID, sku: 'URN-004', name: 'Sıcak Haddelenmiş Çelik Sac', unit: 'KG', currentQty: '42500.000000', avgCost: '28.500000', productId: productIds.celikSac, minQty: '5000.000000' },
      { id: stockItemIds.boruProfil, companyId: COMPANY_ID, sku: 'URN-005', name: 'Çelik Boru Profil 40x40', unit: 'M', currentQty: '6200.000000', avgCost: '65.000000', productId: productIds.boruProfil, minQty: '500.000000' },
      { id: stockItemIds.contaSeti, companyId: COMPANY_ID, sku: 'URN-006', name: 'Vana Conta Seti', unit: 'ADET', currentQty: '890.000000', avgCost: '42.000000', productId: productIds.contaSeti, minQty: '100.000000' }
    ]);
    console.log('1 şube, 2 depo, 6 stok kartı eklendi.');

    // ================= FİLO =================
    const vehicleIds = { kamyonet: id(), forklift: id() };
    await db.insert(vehicles).values([
      { id: vehicleIds.kamyonet, companyId: COMPANY_ID, plateNo: '41 ABC 123', brand: 'Ford', model: 'Transit', year: 2023, fuelType: 'DIESEL', status: 'ACTIVE', registrationExpiryDate: '2027-03-15', departmentId: null, purchaseDate: '2023-03-10' },
      { id: vehicleIds.forklift, companyId: COMPANY_ID, plateNo: 'FL-01', brand: 'Toyota', model: '02-8FD25', year: 2022, fuelType: 'DIESEL', status: 'ACTIVE', purchaseDate: '2022-06-01' }
    ]);
    console.log('2 araç eklendi (mevcut 1 ile toplam 3).');

    // ================= SABİT KIYMET =================
    await db.insert(fixedAssets).values([
      {
        id: id(), companyId: COMPANY_ID, name: 'CNC Torna Tezgahı',
        accountingAccountId: acctIds.tesisMakine, accumDeprAccountId: acctIds.birikmisAmortisman, deprExpAccountId: acctIds.amortismanGideri,
        purchaseDate: '2024-02-01', purchaseCost: '850000.000000', usefulLifeYears: 10, depreciationMethod: 'STRAIGHT_LINE', status: 'ACTIVE', createdByUserId: ADMIN_USER_ID
      },
      {
        id: id(), companyId: COMPANY_ID, name: 'Ofis Bilgisayarları (10 adet)',
        accountingAccountId: acctIds.demirbas, accumDeprAccountId: acctIds.birikmisAmortisman, deprExpAccountId: acctIds.amortismanGideri,
        purchaseDate: '2025-01-15', purchaseCost: '180000.000000', usefulLifeYears: 4, depreciationMethod: 'STRAIGHT_LINE', status: 'ACTIVE', createdByUserId: ADMIN_USER_ID
      }
    ]);

    // ================= ÇEK =================
    await db.insert(checks).values([
      { id: id(), companyId: COMPANY_ID, direction: 'RECEIVED', checkNo: 'CK-100234', bankName: 'Ziraat Bankası', partyName: 'Anadolu Sanayi A.Ş.', amount: '45000.000000', dueDate: '2026-11-15', status: 'PORTFOYDE', accountingAccountId: acctIds.alinanCekler, createdByUserId: ADMIN_USER_ID },
      { id: id(), companyId: COMPANY_ID, direction: 'ISSUED', checkNo: 'CK-500891', bankName: 'İş Bankası', partyName: 'Çelik Tedarik San. Tic. A.Ş.', amount: '28500.000000', dueDate: '2026-10-01', status: 'PORTFOYDE', accountingAccountId: acctIds.verilenCekler, createdByUserId: ADMIN_USER_ID }
    ]);
    console.log('2 sabit kıymet, 2 çek eklendi.');

    // ================= KASA / BANKA =================
    const cashAccountId = id();
    await db.insert(cashAccounts).values({ id: cashAccountId, companyId: COMPANY_ID, name: 'Merkez Kasa', accountingAccountId: '51d71288-b949-4e3b-86dd-6dd37d2fe9dd', currency: 'TRY' });
    const bankAccountId = id();
    await db.insert(bankAccounts).values({ id: bankAccountId, companyId: COMPANY_ID, name: 'Ziraat Bankası TL Hesabı', iban: 'TR330006100519786457841326', accountingAccountId: '1e982f97-61cf-402c-8931-39d43ec44bae', currency: 'TRY' });
    console.log('1 kasa hesabı, 1 banka hesabı eklendi.');

    console.log('\n=== BATCH 1 TAMAMLANDI ===');
    console.log(JSON.stringify({
      brandIds, catIds, unitIds, productIds, partyIds, paymentTermIds, priceListId,
      acctIds, costCenterIds, budgetId, branchId, warehouseIds, stockItemIds,
      vehicleIds, cashAccountId, bankAccountId
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Batch 1 başarısız:', err);
  process.exit(1);
});

// Güvenlik denetimi 2026-09-03, bulgu 2.12 — "sistemik izolasyon kontrolü
// altyapısı hâlâ yok" önerisinin İLK adımı. Tam bir ESLint AST kuralı
// (her lib fonksiyonunun ilk parametresinin companyId olmasını zorlayan)
// bu tek oturumda güvenilir biçimde ayarlanamayacak kadar büyük bir iş
// (rapor kendi içinde "1-2 gün" tahmini veriyor) — bunun yerine, iki
// denetim turunun (2026-08-29, 2026-09-02) ve bu üçüncü turun (bulgu 2.7)
// YAKALADIĞI GERÇEK hata sınıfını doğrudan hedefleyen, daha dar ama
// BUGÜN çalışan bir sezgisel tarayıcı: schema.ts'te company_id kolonu
// olan bir tabloya src/lib/**/*.ts içinde yapılan her `.from(tablo)`
// sorgusu için, AYNI ifade içinde `.companyId` referansı var mı diye bakar.
//
// BİLİNÇLİ SINIRLAR (yanlış-pozitif üretmemek için OLDUĞU GİBİ bırakıldı,
// "mükemmel" bir araç yerine "bugün gerçekten çalışan" bir araç tercih
// edildi — madde 150'nin "spekülatif altyapı kurma" ilkesiyle AYNI ruh):
//   - Yalnızca .from(X)'i AYNI satır/ifade içinde (sonraki ';' karakterine
//     kadar) tarar — çok satırlı, karmaşık join zincirleri kaçabilir.
//   - "companyId" DEĞİŞKEN ADI arar, gerçek SQL semantiğini anlamaz —
//     ör. bir alt sorguda companyId geçiyor ama YANLIŞ tabloya ait olabilir
//     (bu script bunu AYIRT EDEMEZ, yalnızca "hiç geçmiyor" durumunu yakalar).
//   - tx.select/db.select DIŞINDA (ör. Drizzle'ın relational query API'si)
//     kullanım varsa görmez — bu kod tabanında şu an KULLANILMIYOR (grep
//     ile doğrulandı), ama gelecekte eklenirse bu script güncellenmeli.
//   - `known safe` olarak işaretli satırlar İÇİN BİLE gerçek bir güvenlik
//     garantisi VERMEZ — yalnızca "burada dikkatli bak" işareti koyar.
//   - BİLİNEN yanlış-pozitif kaynağı: fonksiyonun dönüş tipi SATIR İÇİ bir
//     nesne tipi içeriyorsa (ör. `Promise<{ id: string; result: 'A'|'B' }>`),
//     bu regex-tabanlı tarayıcı fonksiyonun GERÇEK gövdesini değil, dönüş
//     tipinin İÇİNDEKİ süslü parantezleri fonksiyon gövdesi sanabilir —
//     `lib/hr/access.ts:recordAccessAttempt` bunun CANLI bir örneği (satır
//     128'de companyId AÇIKÇA var ama araç yine de bulguya ekliyor). Bu
//     GERÇEK bir sınırlama, bir AST parser'ı olmadan (ör. ts-morph)
//     sağlam biçimde çözülemez — 2026-09-03 denetiminde 113 bulgudan
//     14'e düşürüldü (fonksiyon-gövdesi kapsamına genişletilerek), ama
//     KALAN 14'ün TAMAMI henüz tek tek elle doğrulanmadı — bir sonraki
//     adım bu listeyi elle gözden geçirmek, sonra (isteğe bağlı) ts-morph
//     gibi gerçek bir TS AST kütüphanesiyle sıfır-yanlış-pozitif bir
//     ikinci sürüm yazmak.
//
// Kullanım: npx tsx scripts/check-company-scoping.ts
import fs from 'fs';
import path from 'path';

function walk(dir: string): string[] {
  let results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(walk(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) results.push(full);
  }
  return results;
}

function loadCompanyScopedTables(): Map<string, string> {
  // Map: TS değişken adı (ör. "approvalInstances") -> DB tablo adı (ör. "approval_instances")
  const schemaSrc = fs.readFileSync('src/db/schema.ts', 'utf8');
  const tableMap = new Map<string, string>();
  // Her "export const X = mysqlTable('y', { ... }" bloğunu bul, blok
  // İÇİNDE "companyId:" var mı bak (basit parantez dengeleme).
  const tableDeclRe = /export const (\w+) = mysqlTable\('([\w_]+)',\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = tableDeclRe.exec(schemaSrc))) {
    const [, varName, dbName] = m;
    const blockStart = m.index + m[0].length;
    let depth = 1;
    let i = blockStart;
    while (depth > 0 && i < schemaSrc.length) {
      if (schemaSrc[i] === '{') depth++;
      else if (schemaSrc[i] === '}') depth--;
      i++;
    }
    const block = schemaSrc.slice(blockStart, i);
    if (/\bcompanyId:\s*char\(/.test(block)) {
      tableMap.set(varName, dbName);
    }
  }
  return tableMap;
}

interface Finding {
  file: string;
  line: number;
  table: string;
  snippet: string;
}

// İlk sürüm yalnızca AYNI ifadeye bakıyordu — bu kod tabanının EN YAYGIN
// deseninde (bir `conditions`/`where` dizisi ÖNCEKİ satırlarda kurulup
// sonra .where(and(...conditions)) ile kullanılması) companyId filtresi
// başka bir satırda olduğu için 113 sonucun çoğu YANLIŞ-POZİTİFTİ. Bunun
// yerine ".from(" çağrısını saran EN YAKIN fonksiyon gövdesinin TAMAMINI
// tara — daha az hassas (companyId fonksiyonda başka bir amaçla da
// geçebilir) ama bu kod tabanının gerçek yazım deseniyle çok daha uyumlu.
function findEnclosingFunctionBody(src: string, index: number): string {
  // İlk sürüm ")" ile "{" arasında dönüş TİPİ ek açıklaması (ör.
  // "): Promise<void> {") varsa eşleşmiyordu — bu TypeScript'te neredeyse
  // HER fonksiyonda var, bu yüzden neredeyse HER çağrı yedek (-1) dala
  // düşüyor ve gerçek fonksiyon sınırı yerine dar bir ±500 karakterlik
  // pencereye güveniyordu. ":[^{]*" ekleyerek dönüş tipini de kapsandı.
  const fnStartRe = /(function\s*\w*\s*\([^)]*\)\s*(?::[^{]*)?\{|=>\s*\{|:\s*async\s*\([^)]*\)\s*(?::[^{]*)?=>\s*\{)/g;
  let lastStart = -1;
  let m: RegExpExecArray | null;
  while ((m = fnStartRe.exec(src)) && m.index < index) {
    lastStart = m.index + m[0].length;
  }
  if (lastStart === -1) return src.slice(Math.max(0, index - 500), index + 500);

  let depth = 1;
  let i = lastStart;
  while (depth > 0 && i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(lastStart, i);
}

function scanFile(file: string, companyScopedTables: Map<string, string>): Finding[] {
  const src = fs.readFileSync(file, 'utf8');
  const findings: Finding[] = [];
  const fromRe = /\.from\((\w+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(src))) {
    const table = m[1];
    if (!companyScopedTables.has(table)) continue;

    const scope = findEnclosingFunctionBody(src, m.index);
    if (!scope.includes('.companyId') && !scope.includes('companyId,') && !scope.includes('companyId:')) {
      const lineStart = src.lastIndexOf('\n', m.index) + 1;
      const stmtEnd = src.indexOf(';', m.index);
      const stmt = src.slice(lineStart, stmtEnd === -1 ? m.index + 200 : stmtEnd + 1);
      const line = src.slice(0, m.index).split('\n').length;
      findings.push({ file, line, table: companyScopedTables.get(table)!, snippet: stmt.trim().slice(0, 160) });
    }
  }
  return findings;
}

function main() {
  const companyScopedTables = loadCompanyScopedTables();
  console.log(`${companyScopedTables.size} şirket-kapsamlı tablo (company_id kolonu olan) bulundu.\n`);

  const files = walk('src/lib');
  const allFindings: Finding[] = [];
  for (const file of files) {
    allFindings.push(...scanFile(file, companyScopedTables));
  }

  if (allFindings.length === 0) {
    console.log('Hiçbir bulgu yok — src/lib altında .companyId referansı olmayan bir company_id-kapsamlı .from() sorgusu bulunamadı.');
    return;
  }

  console.log(`${allFindings.length} potansiyel bulgu (İNCELENMESİ önerilir, her biri GERÇEK bir hata anlamına GELMEZ):\n`);
  for (const f of allFindings) {
    console.log(`${f.file}:${f.line}  [${f.table}]`);
    console.log(`    ${f.snippet}`);
  }
}

main();

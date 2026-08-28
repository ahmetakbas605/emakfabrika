// DATABASE-ARCHITECTURE.md §2'deki karar: MySQL 8.4'te native UUID tipi yok,
// CHAR(36) + uygulama-katmanı üretim seçildi. Tüm ID üretimi TEK bu fonksiyondan
// geçer — ileride BINARY(16)'ya geçilirse (gerçek, ölçülmüş bir performans
// sorunu çıkarsa) yalnızca burası değişir, çağıran kod hiç değişmez.
export function newId(): string {
  return crypto.randomUUID();
}

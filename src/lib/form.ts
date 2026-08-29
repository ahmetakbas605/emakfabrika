// emakerp/src/lib/form.ts ile BİREBİR aynı, kanıtlanmış gerçek bulgu: Zod
// v4'te ".optional()" yalnızca "undefined" kabul eder, "null" DEĞİL — ama
// FormData.get() dolu olmayan/formda hiç bulunmayan bir alan için "null"
// döner. Bu proje kendi Çek/Senet formunda AYNI hatayla karşılaştı
// ("Invalid input: expected string, received null" — note alanı formda hiç
// yoktu). TÜM action dosyalarında opsiyonel form alanları için kullanılır.
export function optionalField(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

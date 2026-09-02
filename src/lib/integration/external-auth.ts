import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth';

// emakerp'in kendi girişi başarısız olduğunda, aynı e-posta/şifrenin
// emakfabrika'da geçerli olup olmadığını sormak için çağırdığı servisler-
// arası kontrol (kullanıcının açık isteği: "emakerp'e giren kişi aslında
// fabrika kullanıcısıysa oraya yönlendirilsin"). API katmanı
// (app/api/v1/auth/verify-external) paylaşılan bir sırla korunur — bu
// fonksiyonun kendisi yalnızca DOĞRULAMA yapar, oturum/token ÜRETMEZ.
//
// BİLİNÇLİ OLARAK failedLoginAttempts'e DOKUNMUYORUZ — bu, GERÇEK bir
// emakfabrika giriş denemesi değil, emakerp'in tarafında başarısız olmuş
// bir denemenin "acaba burada mı" kontrolü. Kilitleme sayacını burada da
// artırmak, yanlışlıkla emakerp'e giren meşru bir emakfabrika kullanıcısını
// KENDİ hesabından kilitleyebilirdi — web/mobil giriş akışları zaten
// KENDİ başarısız-deneme sayaçlarını (lib/dal.ts, lib/mobile-auth.ts)
// tutuyor, bu uç onları TEKRARLAMAZ.
export async function verifyExternalCredentials(email: string, password: string): Promise<boolean> {
  const [found] = await db.select({ passwordHash: users.passwordHash, active: users.active }).from(users).where(eq(users.email, email)).limit(1);
  if (!found || !found.active) return false;
  return verifyPassword(password, found.passwordHash);
}

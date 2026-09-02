import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth';
import { signExternalHandoffToken } from '@/lib/session';

// emakerp'in kendi girişi başarısız olduğunda, aynı e-posta/şifrenin
// emakfabrika'da geçerli olup olmadığını sormak ve öyleyse kullanıcının
// oturumunu doğrudan açacak bir "handoff" token'ı üretmek için çağırdığı
// servisler-arası kontrol (kullanıcının açık isteği: "emakerp'e giren
// kişi aslında fabrika kullanıcısıysa oraya yönlendirilsin, şifreyi
// tekrar yazmasın"). API katmanı (app/api/v1/auth/handoff) paylaşılan bir
// sırla korunur.
//
// BİLİNÇLİ OLARAK failedLoginAttempts'e DOKUNMUYORUZ — bu, GERÇEK bir
// emakfabrika giriş denemesi değil, emakerp'in tarafında başarısız olmuş
// bir denemenin "acaba burada mı" kontrolü. Kilitleme sayacını burada da
// artırmak, yanlışlıkla emakerp'e giren meşru bir emakfabrika kullanıcısını
// KENDİ hesabından kilitleyebilirdi — web/mobil giriş akışları zaten
// KENDİ başarısız-deneme sayaçlarını (lib/dal.ts, lib/mobile-auth.ts)
// tutuyor, bu uç onları TEKRARLAMAZ.
//
// MFA etkin kullanıcılar İÇİN token ÜRETİLMEZ (null döner) — emakerp'te
// doğrulanmış bir şifre, emakfabrika'nın KENDİ ikinci faktörünü (TOTP)
// atlamak için yeterli bir gerekçe DEĞİL; böyle bir kullanıcı normal
// /login akışına (kendi MFA adımıyla) düşer.
export async function issueExternalHandoffToken(email: string, password: string): Promise<string | null> {
  const [found] = await db.select({ id: users.id, companyId: users.companyId, passwordHash: users.passwordHash, active: users.active, mfaEnabled: users.mfaEnabled }).from(users).where(eq(users.email, email)).limit(1);
  if (!found || !found.active || found.mfaEnabled) return null;
  if (!verifyPassword(password, found.passwordHash)) return null;
  return signExternalHandoffToken({ userId: found.id, companyId: found.companyId });
}

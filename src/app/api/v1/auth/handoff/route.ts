import { NextResponse } from 'next/server';
import * as z from 'zod';
import { issueExternalHandoffToken } from '@/lib/integration/external-auth';

const Schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

// emakerp'in login'i başarısız olduğunda çağırdığı ikinci adım (bkz.
// verify-external route'un dosya-başı yorumu — AYNI paylaşılan sır ve
// numaralandırma-karşıtı yanıt disiplini). Bu uç ek olarak, doğrulama
// başarılıysa TEK KULLANIMLIK, 60 saniyelik bir "handoff" token'ı da
// üretir — emakerp bu token'ı /auth/handoff?token=... ile emakfabrika'ya
// geri yönlendirerek kullanıcının şifreyi İKİNCİ KEZ girmesine gerek
// kalmadan (MFA etkin değilse) doğrudan oturumunu açar.
export async function POST(request: Request) {
  const sharedSecret = process.env.EXTERNAL_AUTH_SHARED_SECRET;
  if (!sharedSecret || request.headers.get('x-internal-api-key') !== sharedSecret) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'E-posta ve şifre gereklidir.' }, { status: 400 });

  const token = await issueExternalHandoffToken(parsed.data.email, parsed.data.password);
  return NextResponse.json({ token });
}

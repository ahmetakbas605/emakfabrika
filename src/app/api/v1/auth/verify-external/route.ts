import { NextResponse } from 'next/server';
import * as z from 'zod';
import { verifyExternalCredentials } from '@/lib/integration/external-auth';

const Schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

// Genel kullanıcıya YÖNELİK bir uç DEĞİL — yalnızca emakerp'in kendi
// sunucu tarafından, kendi girişi başarısız olduğunda çağırdığı,
// servisler-arası bir kontrol. Paylaşılan sırla (X-Internal-Api-Key,
// EXTERNAL_AUTH_SHARED_SECRET) korunur — sır yoksa/yanlışsa istek e-posta/
// şifreye HİÇ bakılmadan 401 ile reddedilir. Sır doğru olsa bile yanıt
// yalnızca {valid: boolean} — e-postanın var olup olmadığı ile şifrenin
// yanlış olduğu ASLA ayrıştırılmaz (numaralandırma saldırısına karşı,
// lib/dal.ts'in kendi giriş hata mesajı deseniyle AYNI ilke).
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

  const valid = await verifyExternalCredentials(parsed.data.email, parsed.data.password);
  return NextResponse.json({ valid });
}

import { NextResponse } from 'next/server';
import * as z from 'zod';
import { mobileLogin } from '@/lib/mobile-auth';

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  rememberDays: z.number().optional()
});

// ITAndroid ve gelecekteki tüm departman mobil uygulamalarının GİRİŞ ucu —
// departmandan bağımsız (kimlik doğrulama, departman erişimi değil).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'E-posta ve şifre gereklidir.' }, { status: 400 });
  }

  const result = await mobileLogin(parsed.data.email, parsed.data.password, parsed.data.rememberDays ?? 30);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ user: result.user, token: result.token });
}

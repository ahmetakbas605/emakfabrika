import 'server-only';

// Core Security Faz 3 (rapor §05, §09) — API/Server Component katmanında
// uygulanır (madde 9'un "frontend'de DEĞİL, API response'unda da kontrol"
// şartı). Çağıran taraf (örn. lib/hr/employees.ts:getEmployee) canUnmask
// kararını requireDepartmentAccess'in 'view_sensitive' iznine göre verir.

export function maskIdentityReference(value: string | null | undefined, canUnmask: boolean): string | null {
  if (!value) return value ?? null;
  if (canUnmask) return value;
  const tail = value.slice(-2);
  return `${'*'.repeat(Math.max(value.length - 2, 3))}${tail}`;
}

export function maskPhone(value: string | null | undefined, canUnmask: boolean): string | null {
  if (!value) return value ?? null;
  if (canUnmask) return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${digits.slice(0, 4)} *** ** ${digits.slice(-2)}`;
}

export function maskSalary(value: string | null | undefined, canUnmask: boolean): string | null {
  if (!canUnmask) return value ? 'GİZLİ' : null;
  return value ?? null;
}

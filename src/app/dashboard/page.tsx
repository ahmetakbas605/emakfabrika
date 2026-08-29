import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listUserDepartmentAccess } from '@/lib/permissions';
import { listCompanyDepartments } from '@/lib/departments';
import { logout } from '@/actions/auth';

export default async function DashboardPage() {
  const session = await requireSession();

  // Fabrika yöneticisi TÜM departmanları görür (açık bir atama olmasa bile —
  // bkz. lib/dal.ts:requireDepartmentAccess'teki AYNI fallback); diğer
  // kullanıcılar yalnızca açıkça atandıkları departmanları görür.
  const items = session.isFactoryAdmin
    ? (await listCompanyDepartments(session.companyId)).map((d) => ({ departmentId: d.id, departmentName: d.name, roleName: 'Fabrika Yöneticisi' }))
    : (await listUserDepartmentAccess(session.id)).map((a) => ({ departmentId: a.departmentId, departmentName: a.departmentName, roleName: a.roleName }));

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>{session.companyName}</h1>
          <p style={{ margin: '4px 0 0', color: '#666' }}>{session.fullName} — {session.email}{session.isFactoryAdmin ? ' (Fabrika Yöneticisi)' : ''}</p>
        </div>
        <form action={logout}>
          <button type="submit" style={{ padding: '8px 14px', cursor: 'pointer' }}>Çıkış Yap</button>
        </form>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/dashboard/approvals" style={{ display: 'inline-block', padding: '8px 14px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: '#111' }}>Onay Kutusu</Link>
        <Link href="/dashboard/procurement" style={{ display: 'inline-block', padding: '8px 14px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: '#111' }}>Satınalma Talepleri</Link>
        {session.isFactoryAdmin ? (
          <>
            <Link href="/dashboard/master-data/parties" style={{ display: 'inline-block', padding: '8px 14px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: '#111' }}>Master Data (Cari/Ürün/Birim/Döviz)</Link>
            <Link href="/dashboard/org" style={{ display: 'inline-block', padding: '8px 14px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: '#111' }}>Organizasyon</Link>
            <Link href="/dashboard/workflow/rules" style={{ display: 'inline-block', padding: '8px 14px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: '#111' }}>Onay Kuralları</Link>
          </>
        ) : null}
      </div>

      <h2 style={{ fontSize: 16 }}>Departmanlarım</h2>
      {items.length === 0 ? (
        <p style={{ color: '#666' }}>Henüz hiçbir departmana atanmadınız.</p>
      ) : (
        <ul>
          {items.map((a) => (
            <li key={a.departmentId}>
              <Link href={`/dashboard/departments/${a.departmentId}`}>{a.departmentName}</Link> — {a.roleName}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

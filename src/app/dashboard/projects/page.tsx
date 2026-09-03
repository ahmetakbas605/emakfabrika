import Link from 'next/link';
import { requireSession, listCompanyUsers } from '@/lib/dal';
import { listProjects } from '@/lib/projects/projects';
import { listCompanyDepartments } from '@/lib/departments';
import { CreateProjectForm } from '@/components/projects/project-forms';

const STATUS_LABELS: Record<string, string> = { PLANNING: 'Planlama', ACTIVE: 'Aktif', ON_HOLD: 'Beklemede', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal' };

export default async function ProjectsPage() {
  const session = await requireSession();
  const [projects, users, departments] = await Promise.all([
    listProjects(session.companyId), listCompanyUsers(session.companyId), listCompanyDepartments(session.companyId)
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Proje Yönetimi</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Proje/görev/milestone/bütçe/hakediş. Satın Alma talepleri opsiyonel olarak bir projeye bağlanabilir.</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Proje Oluştur</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateProjectForm users={users.map((u) => ({ id: u.id, fullName: u.fullName }))} departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Projeler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Yönetici</th>
            <th style={{ padding: '6px 8px' }}>Departman</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Bütçe</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{p.code}</td>
              <td style={{ padding: '6px 8px' }}>{p.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.managerName ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.departmentName ?? '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{p.budgetAmount ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[p.status]}</td>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/projects/${p.id}`}>Detay →</Link></td>
            </tr>
          ))}
          {projects.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz proje yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

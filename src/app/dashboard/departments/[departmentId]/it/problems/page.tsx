import { requireDepartmentAccess } from '@/lib/dal';
import { listProblems } from '@/lib/it/problems';
import { listIncidents } from '@/lib/it/incidents';
import { ProblemForm } from '@/components/it/problem-form';
import { ProblemStatusForm } from '@/components/it/problem-status-form';
import { LinkIncidentProblemForm } from '@/components/it/link-incident-problem-form';

export default async function ProblemsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [problems, incidents] = await Promise.all([listProblems(session.companyId), listIncidents(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Problemler</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Problem kapandığında bağlı incident&apos;lar otomatik kapanmaz (SERVICE-DESK.md §5).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Başlık</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>Kök Neden</th>
            <th style={{ padding: '6px 8px' }}>Açan</th>
            <th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {problems.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{p.title}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{p.status}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.rootCause || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.openedByName}</td>
              <td style={{ padding: '6px 8px' }}>{access.permissions.update ? <ProblemStatusForm departmentId={departmentId} problemId={p.id} currentStatus={p.status} currentRootCause={p.rootCause} /> : null}</td>
            </tr>
          ))}
          {problems.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz problem yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? <div style={{ marginBottom: 16 }}><ProblemForm departmentId={departmentId} /></div> : null}
      {access.permissions.update && problems.length > 0 && incidents.length > 0 ? (
        <LinkIncidentProblemForm departmentId={departmentId} problems={problems.map((p) => ({ id: p.id, title: p.title }))} incidents={incidents.map((i) => ({ id: i.id, title: i.title }))} />
      ) : null}
    </div>
  );
}

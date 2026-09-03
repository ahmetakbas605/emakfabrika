import Link from 'next/link';
import { requireSession, listCompanyUsers } from '@/lib/dal';
import { listPendingApprovalsForUser } from '@/lib/workflow/engine';
import { listWarehouses } from '@/lib/warehouse';
import { ApprovalActionForm } from '@/components/workflow/approval-action-form';

export default async function ApprovalsInboxPage() {
  const session = await requireSession();
  const [pending, users, warehouses] = await Promise.all([listPendingApprovalsForUser(session.companyId, session.id), listCompanyUsers(session.companyId), listWarehouses(session.companyId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Onay Kutusu</h1>
        <Link href="/dashboard/approvals/delegations" style={{ fontSize: 13 }}>Vekaletlerim</Link>
      </div>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Doğrudan size atanan veya şu an vekaletini taşıdığınız bekleyen onaylar.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Belge Türü</th>
            <th style={{ padding: '6px 8px' }}>Talep Eden</th>
            <th style={{ padding: '6px 8px' }}>Tarih</th>
            <th style={{ padding: '6px 8px' }}>Adım</th>
            <th style={{ padding: '6px 8px' }}>Karar</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((p) => (
            <tr key={p.stepId} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{p.documentType}</td>
              <td style={{ padding: '6px 8px' }}>{p.submittedByName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{new Date(p.createdAt).toLocaleString('tr-TR')}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.stepOrder + 1}. adım</td>
              <td style={{ padding: '6px 8px' }}>
                <ApprovalActionForm stepId={p.stepId} users={users.map((u) => ({ id: u.id, fullName: u.fullName }))} documentType={p.documentType} warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))} />
              </td>
            </tr>
          ))}
          {pending.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Bekleyen onayınız yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

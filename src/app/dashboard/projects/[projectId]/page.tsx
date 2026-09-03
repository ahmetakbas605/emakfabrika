import { requireSession, listCompanyUsers } from '@/lib/dal';
import { getProject, listProjectTasks, listMilestones } from '@/lib/projects/projects';
import { listProgressPayments } from '@/lib/projects/progress-payments';
import { getProjectBudgetStatus } from '@/lib/projects/budget';
import {
  CreateProjectTaskForm, CompleteProjectTaskButton, CreateMilestoneForm, CompleteMilestoneButton,
  CreateProgressPaymentForm, ApproveProgressPaymentButton, MarkProgressPaymentPaidForm
} from '@/components/projects/project-forms';

const STATUS_LABELS: Record<string, string> = { PLANNING: 'Planlama', ACTIVE: 'Aktif', ON_HOLD: 'Beklemede', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal' };
const TASK_STATUS_LABELS: Record<string, string> = { TODO: 'Yapılacak', IN_PROGRESS: 'Devam Ediyor', DONE: 'Tamamlandı', CANCELLED: 'İptal' };
const PAYMENT_STATUS_LABELS: Record<string, string> = { DRAFT: 'Taslak', APPROVED: 'Onaylandı', PAID: 'Ödendi' };

function fmt(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await requireSession();

  const [project, tasks, milestones, payments, budgetStatus, users] = await Promise.all([
    getProject(session.companyId, projectId), listProjectTasks(session.companyId, projectId), listMilestones(session.companyId, projectId),
    listProgressPayments(session.companyId, projectId), getProjectBudgetStatus(session.companyId, projectId), listCompanyUsers(session.companyId)
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{project.code} — {project.name}</h1>
        <span style={{ fontWeight: 600 }}>{STATUS_LABELS[project.status]}</span>
      </div>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>{project.description || 'Açıklama yok.'}</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Bütçe Durumu</h2>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <Stat label="Bütçe" value={fmt(budgetStatus.budgetAmount)} big />
        <Stat label="Satın Alma Taahhüdü" value={fmt(budgetStatus.committedAmount)} />
        <Stat label="Ödenen Hakediş" value={fmt(budgetStatus.paidAmount)} />
        <Stat label="Kalan Bütçe" value={fmt(budgetStatus.remainingBudget)} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Görev Ekle</h2>
      <div style={{ marginBottom: 20 }}>
        <CreateProjectTaskForm projectId={project.id} tasks={tasks.map((t) => ({ id: t.id, name: t.name }))} users={users.map((u) => ({ id: u.id, fullName: u.fullName }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Görevler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Atanan</th><th style={{ padding: '6px 8px' }}>Bitiş</th>
            <th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{t.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{t.assignedToName ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{t.dueDate ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{TASK_STATUS_LABELS[t.status]}</td>
              <td style={{ padding: '6px 8px' }}>{t.status === 'TODO' || t.status === 'IN_PROGRESS' ? <CompleteProjectTaskButton taskId={t.id} projectId={project.id} /> : null}</td>
            </tr>
          ))}
          {tasks.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz görev yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Milestone Ekle</h2>
      <div style={{ marginBottom: 20 }}><CreateMilestoneForm projectId={project.id} /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Milestone'lar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Hedef Tarih</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((m) => (
            <tr key={m.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{m.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{m.targetDate}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{m.status === 'COMPLETED' ? 'Tamamlandı' : 'Bekliyor'}</td>
              <td style={{ padding: '6px 8px' }}>{m.status === 'PENDING' ? <CompleteMilestoneButton milestoneId={m.id} projectId={project.id} /> : null}</td>
            </tr>
          ))}
          {milestones.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz milestone yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Hakediş Oluştur</h2>
      <div style={{ marginBottom: 20 }}>
        <CreateProgressPaymentForm projectId={project.id} milestones={milestones.map((m) => ({ id: m.id, name: m.name }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Hakedişler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Dönem</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Tutar</th>
            <th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{p.paymentNo}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.periodStart} — {p.periodEnd}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{p.amount}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{PAYMENT_STATUS_LABELS[p.status]}</td>
              <td style={{ padding: '6px 8px' }}>
                {p.status === 'DRAFT' ? <ApproveProgressPaymentButton paymentId={p.id} projectId={project.id} /> : null}
                {p.status === 'APPROVED' ? <MarkProgressPaymentPaidForm paymentId={p.id} projectId={project.id} /> : null}
              </td>
            </tr>
          ))}
          {payments.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz hakediş yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--dim-border-soft)', borderRadius: 6, padding: '10px 16px', minWidth: 110 }}>
      <div style={{ fontSize: big ? 26 : 20, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>{label}</div>
    </div>
  );
}

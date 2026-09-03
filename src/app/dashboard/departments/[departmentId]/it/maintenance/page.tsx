import Link from 'next/link';
import { requireDepartmentAccess, listCompanyUsers } from '@/lib/dal';
import { listMaintenancePlans, listMaintenanceWorkOrders } from '@/lib/it/maintenance';
import { listAssets } from '@/lib/it/assets';
import { listChecklistTemplates } from '@/lib/it/field-service';
import { MaintenancePlanForm } from '@/components/it/maintenance-plan-form';
import { RunMaintenanceGenerationButton } from '@/components/it/run-maintenance-generation-button';

const TYPE_LABELS: Record<string, string> = { PREVENTIVE: 'Önleyici', CORRECTIVE: 'Düzeltici', PREDICTIVE: 'Kestirimci', INSPECTION: 'Denetim', CALIBRATION: 'Kalibrasyon' };
const FREQ_LABELS: Record<string, string> = { DAILY: 'Günlük', WEEKLY: 'Haftalık', MONTHLY: 'Aylık', QUARTERLY: '3 Aylık', ANNUAL: 'Yıllık' };

export default async function MaintenancePage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [plans, generatedWorkOrders, assets, companyUsers, checklistTemplates] = await Promise.all([
    listMaintenancePlans(session.companyId), listMaintenanceWorkOrders(session.companyId),
    listAssets(session.companyId), listCompanyUsers(session.companyId), listChecklistTemplates(session.companyId)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Bakım Planları (Maintenance)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Vadesi gelen planlar için otomatik work order üretimi bugün elle tetiklenir — gerçek bir zamanlayıcı henüz yok (MAINTENANCE.md §2).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Başlık</th>
            <th style={{ padding: '6px 8px' }}>Varlık</th>
            <th style={{ padding: '6px 8px' }}>Tip</th>
            <th style={{ padding: '6px 8px' }}>Sıklık</th>
            <th style={{ padding: '6px 8px' }}>Sonraki Vade</th>
            <th style={{ padding: '6px 8px' }}>Teknisyen</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{p.title}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.assetTag ?? 'Genel'}</td>
              <td style={{ padding: '6px 8px' }}>{TYPE_LABELS[p.maintenanceType]}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.intervalValue > 1 ? `${p.intervalValue} ` : ''}{FREQ_LABELS[p.frequency]}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{p.nextDueDate}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.assignedTechnicianName ?? '—'}</td>
            </tr>
          ))}
          {plans.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz bakım planı yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.configure ? <div style={{ marginBottom: 24 }}><RunMaintenanceGenerationButton departmentId={departmentId} /></div> : null}

      {access.permissions.configure ? (
        <div style={{ marginBottom: 24 }}>
          <MaintenancePlanForm departmentId={departmentId} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} users={companyUsers} checklistTemplates={checklistTemplates.map((t) => ({ id: t.id, name: t.name }))} />
        </div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Üretilmiş Bakım İşleri</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Plan</th>
            <th style={{ padding: '6px 8px' }}>Ticket</th>
            <th style={{ padding: '6px 8px' }}>Varlık</th>
            <th style={{ padding: '6px 8px' }}>Planlanan Tarih</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {generatedWorkOrders.map((w) => (
            <tr key={w.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{w.planTitle}</td>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/departments/${departmentId}/it/field-service/${w.workOrderId}`}>{w.ticketNo}</Link></td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{w.assetTag ?? 'Genel'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{w.scheduledDate}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{w.ticketStatus}</td>
            </tr>
          ))}
          {generatedWorkOrders.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz üretilmiş bakım işi yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

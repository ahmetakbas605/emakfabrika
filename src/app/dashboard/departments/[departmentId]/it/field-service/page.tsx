import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { listWorkOrders, listUnstartedFieldServiceTickets, listChecklistTemplates, getItPolicies } from '@/lib/it/field-service';
import { WorkOrderForm } from '@/components/it/work-order-form';
import { ChecklistTemplateForm } from '@/components/it/checklist-template-form';
import { LocationPolicyForm } from '@/components/it/location-policy-form';

export default async function FieldServicePage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [workOrders, unstartedTickets, templates, policies] = await Promise.all([
    listWorkOrders(session.companyId), listUnstartedFieldServiceTickets(session.companyId), listChecklistTemplates(session.companyId), getItPolicies(session.companyId)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Saha İşleri (Field Service)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Bir work order, saha (FIELD_SERVICE) tipi ticket&apos;ın konum/checklist/malzeme ekli hâlidir (FIELD-SERVICE.md §1).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Ticket</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>Varış</th>
            <th style={{ padding: '6px 8px' }}>Müşteri</th>
          </tr>
        </thead>
        <tbody>
          {workOrders.map((w) => (
            <tr key={w.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}><Link href={`/dashboard/departments/${departmentId}/it/field-service/${w.id}`}>{w.ticketNo}</Link> — {w.title}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{w.status}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{w.arrivedAt ? new Date(w.arrivedAt).toLocaleString('tr-TR') : '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{w.customerName ?? '—'}</td>
            </tr>
          ))}
          {workOrders.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz work order yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? <div style={{ marginBottom: 24 }}><WorkOrderForm departmentId={departmentId} tickets={unstartedTickets} /></div> : null}

      {access.permissions.configure ? (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Konum Politikası</h2>
          <div style={{ marginBottom: 20 }}><LocationPolicyForm departmentId={departmentId} enabled={policies.continuousLocationTrackingEnabled} /></div>

          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Checklist Şablonları</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
                <th style={{ padding: '6px 8px' }}>Kod</th>
                <th style={{ padding: '6px 8px' }}>Ad</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{t.code}</td>
                  <td style={{ padding: '6px 8px' }}>{t.name}</td>
                </tr>
              ))}
              {templates.length === 0 ? <tr><td colSpan={2} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz şablon yok.</td></tr> : null}
            </tbody>
          </table>
          <ChecklistTemplateForm departmentId={departmentId} />
        </>
      ) : null}
    </div>
  );
}

import { requireDepartmentAccess } from '@/lib/dal';
import { getWorkOrder, getWorkOrderChecklist, listChecklistTemplates, listWorkOrderParts } from '@/lib/it/field-service';
import { listWarehouses, listStockItems } from '@/lib/warehouse';
import { MarkArrivedForm } from '@/components/it/mark-arrived-form';
import { AttachChecklistForm } from '@/components/it/attach-checklist-form';
import { ChecklistItemToggle } from '@/components/it/checklist-item-toggle';
import { ConsumePartForm } from '@/components/it/consume-part-form';
import { SignatureForm } from '@/components/it/signature-form';

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ departmentId: string; workOrderId: string }> }) {
  const { departmentId, workOrderId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [workOrder, checklist, templates, parts, warehouses, stockItems] = await Promise.all([
    getWorkOrder(session.companyId, workOrderId),
    getWorkOrderChecklist(workOrderId),
    listChecklistTemplates(session.companyId),
    listWorkOrderParts(workOrderId),
    listWarehouses(session.companyId),
    listStockItems(session.companyId)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{workOrder.ticketNo} — {workOrder.title}</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Ticket durumu: <b>{workOrder.status}</b></p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Varış</h2>
      {workOrder.arrivedAt ? (
        <p style={{ marginBottom: 20, fontSize: 13, color: 'var(--dim-on-surface-variant)' }}>Varış zamanı: {new Date(workOrder.arrivedAt).toLocaleString('tr-TR')} — konum: {workOrder.arrivalLatitude}, {workOrder.arrivalLongitude}</p>
      ) : access.permissions.update ? (
        <div style={{ marginBottom: 20 }}><MarkArrivedForm departmentId={departmentId} workOrderId={workOrderId} /></div>
      ) : <p style={{ marginBottom: 20, fontSize: 13, color: 'var(--dim-slate)' }}>Henüz varış kaydedilmedi.</p>}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Checklist</h2>
      {checklist ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {checklist.items.map((item) => (
            access.permissions.update
              ? <ChecklistItemToggle key={item.id} departmentId={departmentId} workOrderId={workOrderId} itemId={item.id} label={item.label} checked={item.checked} />
              : <p key={item.id} style={{ fontSize: 13 }}>{item.checked ? '☑' : '☐'} {item.label}</p>
          ))}
          {checklist.items.length === 0 ? <p style={{ color: 'var(--dim-slate)', fontSize: 13 }}>Checklist boş.</p> : null}
        </div>
      ) : access.permissions.update ? (
        <div style={{ marginBottom: 20 }}><AttachChecklistForm departmentId={departmentId} workOrderId={workOrderId} templates={templates.map((t) => ({ id: t.id, name: t.name }))} /></div>
      ) : <p style={{ marginBottom: 20, fontSize: 13, color: 'var(--dim-slate)' }}>Henüz checklist eklenmedi.</p>}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Kullanılan Malzemeler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Malzeme</th>
            <th style={{ padding: '6px 8px' }}>Miktar</th>
            <th style={{ padding: '6px 8px' }}>Birim Maliyet</th>
            <th style={{ padding: '6px 8px' }}>Faturalanabilir</th>
            <th style={{ padding: '6px 8px' }}>Tüketen</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{p.sku} — {p.name}</td>
              <td style={{ padding: '6px 8px' }}>{Number(p.quantity).toFixed(2)}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{Number(p.unitCost).toFixed(2)}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.billable ? 'Evet' : 'Hayır'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.consumedByName}</td>
            </tr>
          ))}
          {parts.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz malzeme tüketimi yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.update ? (
        <div style={{ marginBottom: 24 }}>
          <ConsumePartForm departmentId={departmentId} workOrderId={workOrderId} warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))} stockItems={stockItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, currentQty: s.currentQty }))} />
        </div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Müşteri Onayı</h2>
      {workOrder.signatureNote ? (
        <p style={{ fontSize: 13, color: 'var(--dim-on-surface-variant)' }}>{workOrder.customerName}: &quot;{workOrder.signatureNote}&quot;</p>
      ) : access.permissions.update ? (
        <SignatureForm departmentId={departmentId} workOrderId={workOrderId} />
      ) : <p style={{ fontSize: 13, color: 'var(--dim-slate)' }}>Henüz onay alınmadı.</p>}
    </div>
  );
}

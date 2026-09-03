import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { listWarehouses } from '@/lib/warehouse';
import { WarehouseForm } from '@/components/warehouse-form';

export default async function WarehousesPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const warehouses = await listWarehouses(session.companyId);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Depolar</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Depo departmanı — minimal başlangıç, ihtiyaç oldukça genişletilecek.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Ad</th>
          </tr>
        </thead>
        <tbody>
          {warehouses.map((w) => (
            <tr key={w.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/departments/${departmentId}/warehouses/${w.id}`}>{w.name}</Link></td>
            </tr>
          ))}
          {warehouses.length === 0 ? <tr><td style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz depo yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? <WarehouseForm departmentId={departmentId} /> : null}
    </div>
  );
}

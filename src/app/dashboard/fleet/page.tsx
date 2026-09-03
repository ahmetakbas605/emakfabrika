import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listVehicles, listVehicleInsurances, listExpiringVehicleDocuments } from '@/lib/fleet/vehicles';
import { listFleetMaintenancePlans, listMaintenanceWorkOrders } from '@/lib/it/maintenance';
import { listCompanyDepartments } from '@/lib/departments';
import { CreateVehicleForm, CreateVehicleInsuranceForm, CreateFleetMaintenancePlanForm, RunFleetMaintenanceGenerationButton } from '@/components/fleet/fleet-forms';

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', UNDER_MAINTENANCE: 'Bakımda', OUT_OF_SERVICE: 'Servis Dışı', SOLD: 'Satıldı' };
const FUEL_LABELS: Record<string, string> = { DIESEL: 'Dizel', GASOLINE: 'Benzin', LPG: 'LPG', ELECTRIC: 'Elektrik', HYBRID: 'Hibrit' };
const FREQUENCY_LABELS: Record<string, string> = { DAILY: 'Günlük', WEEKLY: 'Haftalık', MONTHLY: 'Aylık', QUARTERLY: '3 Aylık', ANNUAL: 'Yıllık' };

export default async function FleetPage() {
  const session = await requireSession();
  const [vehicles, insurances, expiringDocs, departments, plans, workOrders] = await Promise.all([
    listVehicles(session.companyId), listVehicleInsurances(session.companyId), listExpiringVehicleDocuments(session.companyId, 30), listCompanyDepartments(session.companyId),
    listFleetMaintenancePlans(session.companyId), listMaintenanceWorkOrders(session.companyId)
  ]);
  const fleetWorkOrders = workOrders.filter((w) => w.plateNo);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Filo (Araç Bakım/Ruhsat/Sigorta)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>IT'nin mevcut bakım plan/iş emri motoru üzerine kuruldu. Yakıt/HGS giderleri <Link href="/dashboard/fleet/expenses">ayrı sayfada</Link>.</p>

      {expiringDocs.length > 0 ? (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 8, color: 'var(--dim-danger)' }}>30 Gün İçinde Sona Erecek Belgeler ({expiringDocs.length})</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Plaka</th><th style={{ padding: '6px 8px' }}>Belge</th><th style={{ padding: '6px 8px' }}>Son Tarih</th></tr></thead>
            <tbody>
              {expiringDocs.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{d.plateNo}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{d.detail}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--dim-danger)', fontWeight: 600 }}>{d.expiryDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <div style={{ marginBottom: 20 }}><RunFleetMaintenanceGenerationButton /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Araç Ekle</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateVehicleForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Araçlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Plaka</th><th style={{ padding: '6px 8px' }}>Marka/Model</th><th style={{ padding: '6px 8px' }}>Yakıt</th>
            <th style={{ padding: '6px 8px' }}>Ruhsat Bitiş</th><th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr key={v.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{v.plateNo}</td>
              <td style={{ padding: '6px 8px' }}>{v.brand} {v.model}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{FUEL_LABELS[v.fuelType]}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{v.registrationExpiryDate ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600, color: v.status === 'UNDER_MAINTENANCE' ? '#a60' : v.status === 'ACTIVE' ? '#080' : 'var(--dim-danger)' }}>{STATUS_LABELS[v.status]}</td>
            </tr>
          ))}
          {vehicles.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz araç yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Sigorta Poliçesi Ekle</h2>
      {vehicles.length === 0 ? (
        <p style={{ color: 'var(--dim-danger)', fontSize: 13, marginBottom: 24 }}>Önce en az bir araç eklenmeli.</p>
      ) : (
        <div style={{ marginBottom: 24 }}><CreateVehicleInsuranceForm vehicles={vehicles.map((v) => ({ id: v.id, plateNo: v.plateNo }))} /></div>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Sigorta Poliçeleri</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Plaka</th><th style={{ padding: '6px 8px' }}>Poliçe No</th><th style={{ padding: '6px 8px' }}>Şirket</th><th style={{ padding: '6px 8px' }}>Kapsam</th><th style={{ padding: '6px 8px' }}>Bitiş</th></tr></thead>
        <tbody>
          {insurances.map((i) => (
            <tr key={i.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{i.plateNo}</td>
              <td style={{ padding: '6px 8px' }}>{i.policyNo}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{i.provider || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{i.coverageType || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{i.endDate}</td>
            </tr>
          ))}
          {insurances.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz poliçe yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Bakım Planı Oluştur</h2>
      {vehicles.length === 0 ? (
        <p style={{ color: 'var(--dim-danger)', fontSize: 13, marginBottom: 24 }}>Önce en az bir araç eklenmeli.</p>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <CreateFleetMaintenancePlanForm vehicles={vehicles.map((v) => ({ id: v.id, plateNo: v.plateNo }))} departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
        </div>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Bakım Planları</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Başlık</th><th style={{ padding: '6px 8px' }}>Araç</th><th style={{ padding: '6px 8px' }}>Tip</th>
            <th style={{ padding: '6px 8px' }}>Sıklık</th><th style={{ padding: '6px 8px' }}>Sıradaki Tarih</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{p.title}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)', fontFamily: 'monospace' }}>{p.plateNo}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.maintenanceType}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{FREQUENCY_LABELS[p.frequency]}{p.intervalValue > 1 ? ` (${p.intervalValue})` : ''}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.nextDueDate}</td>
            </tr>
          ))}
          {plans.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz bakım planı yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Bakım İş Emirleri</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Plan</th><th style={{ padding: '6px 8px' }}>Araç</th><th style={{ padding: '6px 8px' }}>Ticket</th>
            <th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>Planlanan Tarih</th>
          </tr>
        </thead>
        <tbody>
          {fleetWorkOrders.map((w) => (
            <tr key={w.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{w.planTitle}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)', fontFamily: 'monospace' }}>{w.plateNo}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{w.ticketNo}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{w.ticketStatus}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{w.scheduledDate}</td>
            </tr>
          ))}
          {fleetWorkOrders.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz bakım iş emri yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

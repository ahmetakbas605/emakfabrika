import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listEamAssets, listEamAssetTypes, listBranches } from '@/lib/eam/assets';
import { listLocations } from '@/lib/it/locations';
import { listEamMaintenancePlans, listMaintenanceWorkOrders } from '@/lib/it/maintenance';
import { listCompanyDepartments } from '@/lib/departments';
import { CreateEamAssetForm, CreateEamMaintenancePlanForm, RunEamMaintenanceGenerationButton, CreateLocationForm } from '@/components/eam/eam-forms';

const STATUS_LABELS: Record<string, string> = { IN_SERVICE: 'Serviste', UNDER_MAINTENANCE: 'Bakımda', OUT_OF_SERVICE: 'Servis Dışı', DECOMMISSIONED: 'Hizmetten Kaldırıldı' };
const FREQUENCY_LABELS: Record<string, string> = { DAILY: 'Günlük', WEEKLY: 'Haftalık', MONTHLY: 'Aylık', QUARTERLY: '3 Aylık', ANNUAL: 'Yıllık' };

export default async function EamPage() {
  const session = await requireSession();
  const [assets, assetTypes, branches, locations, departments, plans, workOrders] = await Promise.all([
    listEamAssets(session.companyId), listEamAssetTypes(), listBranches(session.companyId), listLocations(session.companyId), listCompanyDepartments(session.companyId),
    listEamMaintenancePlans(session.companyId), listMaintenanceWorkOrders(session.companyId)
  ]);
  const eamWorkOrders = workOrders.filter((w) => w.eamAssetCode);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>EAM (Genel Bakım — Fabrika Ekipmanı/Bina/Tesis)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>IT'nin mevcut bakım plan/iş emri motoru üzerine kuruldu — kompresör/jeneratör/HVAC/kamera/geçiş sistemi/bina gibi ekipmanlar için. Enerji tüketimi <Link href="/dashboard/eam/energy">ayrı sayfada</Link>.</p>

      <div style={{ marginBottom: 20 }}><RunEamMaintenanceGenerationButton /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Konum Ekle (Bina/Kat/Oda)</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateLocationForm branches={branches} locations={locations.map((l) => ({ id: l.id, name: l.name, locationType: l.locationType }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Ekipman Ekle</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateEamAssetForm assetTypes={assetTypes} branches={branches} locations={locations.map((l) => ({ id: l.id, name: l.name, locationType: l.locationType }))} departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Ekipmanlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Tip</th>
            <th style={{ padding: '6px 8px' }}>Şube</th><th style={{ padding: '6px 8px' }}>Konum</th><th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{a.code}</td>
              <td style={{ padding: '6px 8px' }}>{a.name}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{a.assetTypeName}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{a.branchName ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{a.locationNote || '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600, color: a.status === 'UNDER_MAINTENANCE' ? '#a60' : a.status === 'IN_SERVICE' ? '#080' : '#b00' }}>{STATUS_LABELS[a.status]}</td>
            </tr>
          ))}
          {assets.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz ekipman/varlık yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Bakım Planı Oluştur</h2>
      {assets.length === 0 ? (
        <p style={{ color: '#b00', fontSize: 13, marginBottom: 24 }}>Önce en az bir ekipman/varlık eklenmeli.</p>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <CreateEamMaintenancePlanForm assets={assets.map((a) => ({ id: a.id, code: a.code, name: a.name }))} departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
        </div>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Bakım Planları</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Başlık</th><th style={{ padding: '6px 8px' }}>Ekipman</th><th style={{ padding: '6px 8px' }}>Tip</th>
            <th style={{ padding: '6px 8px' }}>Sıklık</th><th style={{ padding: '6px 8px' }}>Sıradaki Tarih</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{p.title}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{p.eamAssetCode} — {p.eamAssetName}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{p.maintenanceType}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{FREQUENCY_LABELS[p.frequency]}{p.intervalValue > 1 ? ` (${p.intervalValue})` : ''}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{p.nextDueDate}</td>
            </tr>
          ))}
          {plans.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz bakım planı yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Bakım İş Emirleri</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Plan</th><th style={{ padding: '6px 8px' }}>Ekipman</th><th style={{ padding: '6px 8px' }}>Ticket</th>
            <th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>Planlanan Tarih</th>
          </tr>
        </thead>
        <tbody>
          {eamWorkOrders.map((w) => (
            <tr key={w.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{w.planTitle}</td>
              <td style={{ padding: '6px 8px', color: '#666', fontFamily: 'monospace' }}>{w.eamAssetCode}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{w.ticketNo}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{w.ticketStatus}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{w.scheduledDate}</td>
            </tr>
          ))}
          {eamWorkOrders.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz bakım iş emri yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

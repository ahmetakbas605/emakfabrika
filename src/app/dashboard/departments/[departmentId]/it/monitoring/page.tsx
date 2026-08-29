import { requireDepartmentAccess } from '@/lib/dal';
import { listTargets, listAlerts } from '@/lib/it/monitoring';
import { listAssets } from '@/lib/it/assets';
import { TargetForm } from '@/components/it/target-form';
import { MetricForm } from '@/components/it/metric-form';
import { AlertForm } from '@/components/it/alert-form';
import { AlertStatusForm } from '@/components/it/alert-status-form';

export default async function MonitoringPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [targets, alerts, assets] = await Promise.all([listTargets(session.companyId), listAlerts(session.companyId), listAssets(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>İzleme (Monitoring)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Gerçek SNMP/ICMP toplayıcı henüz yok (NetworkDiscoveryAdapter Null stub, Faz 13 tamamlanınca bağlanacak) — ölçümler bugün elle girilir.</p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>İzleme Hedefleri</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Varlık</th><th style={{ padding: '6px 8px' }}>Tür</th><th style={{ padding: '6px 8px' }}>Aralık</th></tr></thead>
        <tbody>
          {targets.map((t) => <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '6px 8px' }}>{t.assetTag} — {t.assetName}</td><td style={{ padding: '6px 8px', color: '#666' }}>{t.targetType}</td><td style={{ padding: '6px 8px', color: '#666' }}>{t.intervalSeconds}sn</td></tr>)}
          {targets.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: '#999' }}>Henüz izleme hedefi yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.monitor ? <div style={{ marginBottom: 24 }}><TargetForm departmentId={departmentId} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} /></div> : null}

      {access.permissions.monitor && targets.length > 0 ? (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Ölçüm Ekle (elle)</h2>
          <div style={{ marginBottom: 24 }}><MetricForm departmentId={departmentId} targets={targets.map((t) => ({ id: t.id, assetTag: t.assetTag, targetType: t.targetType }))} /></div>
        </>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Alertler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Varlık</th><th style={{ padding: '6px 8px' }}>Önem</th><th style={{ padding: '6px 8px' }}>Mesaj</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>Grup</th><th style={{ padding: '6px 8px' }}>İşlem</th></tr></thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{a.assetTag}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{a.severity}</td>
              <td style={{ padding: '6px 8px' }}>{a.message}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{a.status}</td>
              <td style={{ padding: '6px 8px', color: '#999', fontFamily: 'monospace', fontSize: 11 }}>{a.correlationGroupId?.slice(0, 8)}</td>
              <td style={{ padding: '6px 8px' }}>{access.permissions.monitor ? <AlertStatusForm departmentId={departmentId} alertId={a.id} currentStatus={a.status} /> : null}</td>
            </tr>
          ))}
          {alerts.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz alert yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.monitor && targets.length > 0 ? <AlertForm departmentId={departmentId} targets={targets.map((t) => ({ id: t.id, assetTag: t.assetTag }))} /> : null}
    </div>
  );
}

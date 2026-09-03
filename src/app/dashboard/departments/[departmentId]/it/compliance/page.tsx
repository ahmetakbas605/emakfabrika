import { requireDepartmentAccess } from '@/lib/dal';
import { listCompliance } from '@/lib/it/compliance';
import { listAssets } from '@/lib/it/assets';
import { ComplianceForm } from '@/components/it/compliance-form';

const OVERALL_COLORS: Record<string, string> = { COMPLIANT: 'var(--dim-success)', NON_COMPLIANT: 'var(--dim-danger)', UNKNOWN: 'var(--dim-slate)' };

export default async function CompliancePage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [records, assets] = await Promise.all([listCompliance(session.companyId), listAssets(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Uç Nokta Uyumluluğu (Compliance)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>&quot;Genel&quot; durum uygulama katmanında hesaplanır — tüm alt durumlar COMPLIANT ise COMPLIANT (IT-SECURITY.md §4).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Varlık</th><th style={{ padding: '6px 8px' }}>AV</th><th style={{ padding: '6px 8px' }}>FW</th><th style={{ padding: '6px 8px' }}>Şifreleme</th><th style={{ padding: '6px 8px' }}>Yama</th><th style={{ padding: '6px 8px' }}>OS</th><th style={{ padding: '6px 8px' }}>Genel</th></tr></thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{r.assetTag} — {r.assetName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{r.antivirusStatus}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{r.firewallStatus}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{r.encryptionStatus}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{r.patchStatus}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{r.osSupportStatus}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600, color: OVERALL_COLORS[r.overall] }}>{r.overall}</td>
            </tr>
          ))}
          {records.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz uyumluluk kaydı yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.monitor ? <ComplianceForm departmentId={departmentId} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} /> : null}
    </div>
  );
}

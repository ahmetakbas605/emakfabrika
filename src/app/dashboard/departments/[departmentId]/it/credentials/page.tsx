import { requireDepartmentAccess } from '@/lib/dal';
import { listCredentials } from '@/lib/it/network-credentials';
import { listAssets } from '@/lib/it/assets';
import { CredentialForm } from '@/components/it/credential-form';

export default async function CredentialsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [credentials, assets] = await Promise.all([listCredentials(session.companyId), listAssets(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Kimlik Bilgisi Kasası (Secret Vault)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Sırlar AES-256-GCM ile şifrelenir — bu sayfa hiçbir zaman gerçek sır değerini göstermez (IT-SECURITY.md §1).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Etiket</th><th style={{ padding: '6px 8px' }}>Tür</th><th style={{ padding: '6px 8px' }}>Varlık</th><th style={{ padding: '6px 8px' }}>Eklendi</th></tr></thead>
        <tbody>
          {credentials.map((c) => <tr key={c.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}><td style={{ padding: '6px 8px' }}>{c.label}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.credentialType}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.assetId ?? 'Genel'}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{new Date(c.createdAt).toLocaleDateString('tr-TR')}</td></tr>)}
          {credentials.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz kimlik bilgisi yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.manage_credentials ? <CredentialForm departmentId={departmentId} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} /> : null}
    </div>
  );
}

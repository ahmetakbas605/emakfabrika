import { requireDepartmentAccess } from '@/lib/dal';
import { listBackupJobs } from '@/lib/it/backup';
import { listAssets } from '@/lib/it/assets';
import { BackupJobForm } from '@/components/it/backup-job-form';
import { BackupResultForm } from '@/components/it/backup-result-form';

export default async function BackupPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [jobs, assets] = await Promise.all([listBackupJobs(session.companyId), listAssets(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Yedekleme Yönetimi</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Başarısız bir sonuç otomatik olarak bir alert + incident açar (MONITORING.md §6).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Varlık</th><th style={{ padding: '6px 8px' }}>Kaynak</th><th style={{ padding: '6px 8px' }}>Hedef</th><th style={{ padding: '6px 8px' }}>Zamanlama</th><th style={{ padding: '6px 8px' }}>Saklama</th></tr></thead>
        <tbody>
          {jobs.map((j) => <tr key={j.id} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '6px 8px' }}>{j.assetTag}</td><td style={{ padding: '6px 8px' }}>{j.source}</td><td style={{ padding: '6px 8px', color: '#666' }}>{j.destination}</td><td style={{ padding: '6px 8px', color: '#666' }}>{j.schedule || '—'}</td><td style={{ padding: '6px 8px', color: '#666' }}>{j.retentionDays} gün</td></tr>)}
          {jobs.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz yedekleme işi yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.configure ? <div style={{ marginBottom: 24 }}><BackupJobForm departmentId={departmentId} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} /></div> : null}

      {access.permissions.update && jobs.length > 0 ? (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Sonuç Kaydet</h2>
          <BackupResultForm departmentId={departmentId} jobs={jobs.map((j) => ({ id: j.id, source: j.source, assetTag: j.assetTag }))} />
        </>
      ) : null}
    </div>
  );
}

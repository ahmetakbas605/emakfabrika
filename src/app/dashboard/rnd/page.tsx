import { requireSession } from '@/lib/dal';
import { listPrototypes } from '@/lib/rnd/prototypes';
import { listLabTests } from '@/lib/rnd/labtests';
import { listProjects } from '@/lib/projects/projects';
import { CreatePrototypeForm, UpdatePrototypeStatusForm, CreateLabTestForm, UpdateLabTestStatusForm } from '@/components/rnd/rnd-forms';

const PROTOTYPE_STATUS_LABELS: Record<string, string> = { DESIGN: 'Tasarım', BUILDING: 'Üretiliyor', TESTING: 'Test Ediliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi' };
const LAB_TEST_STATUS_LABELS: Record<string, string> = { PLANNED: 'Planlandı', IN_PROGRESS: 'Devam Ediyor', COMPLETED: 'Tamamlandı', FAILED: 'Başarısız' };

export default async function RndPage() {
  const session = await requireSession();
  const [prototypes, labTests, projects] = await Promise.all([listPrototypes(session.companyId), listLabTests(session.companyId), listProjects(session.companyId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Ar-Ge (Prototip/Laboratuvar)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Ar-Ge projeleri mevcut <a href="/dashboard/projects">Proje Yönetimi</a> modülünü doğrudan kullanır — burada yalnızca prototip/laboratuvar testleri var.</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Prototip Oluştur</h2>
      <div style={{ marginBottom: 24 }}>
        <CreatePrototypeForm projects={projects.map((p) => ({ id: p.id, code: p.code, name: p.name }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Prototipler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Proje</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Versiyon</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {prototypes.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{p.prototypeNo}</td>
              <td style={{ padding: '6px 8px' }}>{p.name}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{p.projectName ?? '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{p.version}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{PROTOTYPE_STATUS_LABELS[p.status]}</td>
              <td style={{ padding: '6px 8px' }}>{p.status !== 'APPROVED' && p.status !== 'REJECTED' ? <UpdatePrototypeStatusForm prototypeId={p.id} /> : null}</td>
            </tr>
          ))}
          {prototypes.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz prototip yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Laboratuvar Testi Oluştur</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateLabTestForm prototypes={prototypes.map((p) => ({ id: p.id, prototypeNo: p.prototypeNo, name: p.name }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Laboratuvar Testleri</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Test Adı</th><th style={{ padding: '6px 8px' }}>Prototip</th>
            <th style={{ padding: '6px 8px' }}>Tarih</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {labTests.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{t.testNo}</td>
              <td style={{ padding: '6px 8px' }}>{t.testName}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{t.prototypeName ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{t.testDate ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{LAB_TEST_STATUS_LABELS[t.status]}</td>
              <td style={{ padding: '6px 8px' }}>{t.status !== 'COMPLETED' && t.status !== 'FAILED' ? <UpdateLabTestStatusForm testId={t.id} /> : null}</td>
            </tr>
          ))}
          {labTests.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz laboratuvar testi yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

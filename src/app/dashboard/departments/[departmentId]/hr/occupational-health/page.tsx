import { requireDepartmentAccess } from '@/lib/dal';
import { listEmployees } from '@/lib/hr/employees';
import { listDueOccupationalHealthRecords, listOccupationalHealthRecords } from '@/lib/hr/occupational-health';
import { OccupationalHealthForm, ArchiveRecordForm } from '@/components/hr/occupational-health-forms';

// İşyeri Hekimi — kullanıcının menü ağacındaki İK > İşyeri Hekimi dalı
// (Muayene, Sağlık Raporları, Periyodik Takipler).
//
// KVKK: sağlık verisi ÖZEL NİTELİKLİ kişisel veri. Bu sayfa 'view'
// iznine EK OLARAK 'view_sensitive' arar — yetkisi olmayan İK personeli
// kayıtların VARLIĞINI (kaç kişi, kaç takip gecikmiş) görür ama
// İÇERİĞİNİ göremez. Maaş/TC kimlik ile AYNI kural
// (bkz. lib/security/masking.ts, hr/employees/[employeeId]/page.tsx).

const RECORD_TYPE_LABELS: Record<string, string> = {
  EXAMINATION: 'Muayene',
  HEALTH_REPORT: 'Sağlık Raporu',
  PERIODIC_FOLLOWUP: 'Periyodik Takip'
};

const EXAM_KIND_LABELS: Record<string, string> = {
  PRE_EMPLOYMENT: 'İşe Giriş',
  PERIODIC: 'Periyodik',
  RETURN_TO_WORK: 'İşe Dönüş',
  JOB_CHANGE: 'Görev Değişikliği',
  COMPLAINT: 'Şikâyet Üzerine',
  OTHER: 'Diğer'
};

const RESULT_LABELS: Record<string, string> = {
  PENDING: 'Beklemede',
  FIT: 'Uygun',
  FIT_WITH_RESTRICTION: 'Kısıtlı Uygun',
  TEMPORARILY_UNFIT: 'Geçici Uygun Değil',
  UNFIT: 'Uygun Değil'
};

const RESULT_COLORS: Record<string, string> = {
  PENDING: 'var(--dim-slate)',
  FIT: 'var(--dim-success)',
  FIT_WITH_RESTRICTION: 'var(--dim-warning)',
  TEMPORARILY_UNFIT: 'var(--dim-warning)',
  UNFIT: 'var(--dim-danger)'
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('tr-TR');
}

export default async function OccupationalHealthPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const canSee = access.permissions.view_sensitive;

  const [employees, records, dueRecords] = await Promise.all([
    listEmployees(session.companyId),
    listOccupationalHealthRecords(session.companyId),
    listDueOccupationalHealthRecords(session.companyId, 30)
  ]);

  const activeRecords = records.filter((r) => r.status === 'ACTIVE');
  const overdue = dueRecords.filter((r) => r.nextDueDate && r.nextDueDate < new Date().toISOString().slice(0, 10));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>İşyeri Hekimi</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        Muayene, sağlık raporu ve periyodik takip kayıtları. Sağlık verisi KVKK kapsamında özel nitelikli kişisel veridir —
        içerik yalnızca özel nitelikli veri yetkisi olan kullanıcılara gösterilir.
      </p>

      {/* Sayı bilgisi yetkisiz kullanıcıya da gösterilir: "kaç takip
          gecikmiş" bir operasyon bilgisidir, kimin neyi olduğu değil. */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Stat label="Aktif Kayıt" value={activeRecords.length} />
        <Stat label="30 Gün İçinde Takip" value={dueRecords.length} />
        <Stat label="Gecikmiş Takip" value={overdue.length} tone={overdue.length > 0 ? 'var(--dim-danger)' : undefined} />
      </div>

      {!canSee ? (
        <p className="dim-card" style={{ padding: 16, color: 'var(--dim-warning)', fontSize: 13 }}>
          Sağlık kayıtlarının içeriğini görüntülemek için özel nitelikli veri yetkisi (view_sensitive) gerekir.
          Departman yöneticinizle görüşün.
        </p>
      ) : (
        <>
          <OccupationalHealthForm departmentId={departmentId} employees={employees} />

          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Yaklaşan / Gecikmiş Periyodik Takipler</h2>
          <table style={{ marginBottom: 24 }}>
            <thead>
              <tr>
                <th>Çalışan</th><th>Kayıt</th><th>Tür</th><th>Sonraki Tarih</th>
              </tr>
            </thead>
            <tbody>
              {dueRecords.map((r) => {
                const isOverdue = !!r.nextDueDate && r.nextDueDate < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={r.id}>
                    <td>{r.employeeFirstName} {r.employeeLastName}</td>
                    <td>{r.title}</td>
                    <td>{RECORD_TYPE_LABELS[r.recordType] ?? r.recordType}</td>
                    <td style={{ color: isOverdue ? 'var(--dim-danger)' : 'var(--dim-warning)' }}>
                      {formatDate(r.nextDueDate)}{isOverdue ? ' (gecikmiş)' : ''}
                    </td>
                  </tr>
                );
              })}
              {dueRecords.length === 0 ? (
                <tr><td colSpan={4} style={{ color: 'var(--dim-slate)' }}>30 gün içinde takip yok.</td></tr>
              ) : null}
            </tbody>
          </table>

          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Tüm Kayıtlar</h2>
          <table>
            <thead>
              <tr>
                <th>Çalışan</th><th>Tür</th><th>Sebep</th><th>Başlık</th><th>Hekim / Kurum</th>
                <th>Tarih</th><th>Sonraki</th><th>Sonuç</th><th></th>
              </tr>
            </thead>
            <tbody>
              {activeRecords.map((r) => (
                <tr key={r.id}>
                  <td>{r.employeeFirstName} {r.employeeLastName}</td>
                  <td>{RECORD_TYPE_LABELS[r.recordType] ?? r.recordType}</td>
                  <td>{EXAM_KIND_LABELS[r.examKind] ?? r.examKind}</td>
                  <td>{r.title}</td>
                  <td>{[r.physicianName, r.institution].filter(Boolean).join(' — ') || '—'}</td>
                  <td>{formatDate(r.performedAt)}</td>
                  <td>{formatDate(r.nextDueDate)}</td>
                  <td style={{ color: RESULT_COLORS[r.result] }}>
                    {RESULT_LABELS[r.result] ?? r.result}
                    {r.restrictionNote ? <div style={{ fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>{r.restrictionNote}</div> : null}
                  </td>
                  <td><ArchiveRecordForm departmentId={departmentId} recordId={r.id} /></td>
                </tr>
              ))}
              {activeRecords.length === 0 ? (
                <tr><td colSpan={9} style={{ color: 'var(--dim-slate)' }}>Henüz sağlık kaydı yok.</td></tr>
              ) : null}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="dim-card" style={{ padding: '12px 20px', minWidth: 150 }}>
      <div style={{ fontSize: 24, fontWeight: 500, color: tone ?? 'var(--dim-bone)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>{label}</div>
    </div>
  );
}

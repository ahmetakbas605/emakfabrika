import { requireFactoryAdmin } from '@/lib/dal';
import { listEvents } from '@/lib/integration/events';

const MODULE_LABELS: Record<string, string> = { SAFETY: 'İSG', QUALITY: 'Kalite' };
const EVENT_TYPE_LABELS: Record<string, string> = { SAFETY_INCIDENT_CREATED: 'İSG Olayı Oluşturuldu', QUALITY_NCR_CREATED: 'NCR Oluşturuldu' };

export default async function IntegrationPage({ searchParams }: { searchParams: Promise<{ eventType?: string }> }) {
  const { eventType } = await searchParams;
  const session = await requireFactoryAdmin();
  const events = await listEvents(session.companyId, eventType);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Integration Hub / Event Bus</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        Faz 13 — gerçek bir mesaj kuyruğu/broker DEĞİL, süreç-içi bir yayın/abonelik kaydı + kalıcı olay günlüğü.
        Bugün yalnızca İSG (ciddi olay) ve Kalite (kritik NCR) olayları üretiliyor ve fabrika yöneticilerine
        e-posta bildirimi denenir — e-posta sağlayıcısı henüz yapılandırılmadığı için (Null sağlayıcı) bu
        bildirim denemeleri BAŞARISIZ olur, ama olayın kendisi (ve tetiklediği asıl iş kaydı) buna rağmen
        güvenle kaydedilir. Sağlayıcılar (Email/SMS/LDAP/RFID/PLC-SCADA/Banka Ekstresi) hazır olduklarında
        <code style={{ fontSize: 12 }}> lib/integration/</code> altındaki Null implementasyonların yerine geçer,
        çağıran kod DEĞİŞMEZ.
      </p>

      <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Olay Türü</label>
          <select name="eventType" defaultValue={eventType ?? ''} style={{ padding: 6, minWidth: 220 }}>
            <option value="">Tümü</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <button type="submit" style={{ padding: '7px 14px', cursor: 'pointer' }}>Uygula</button>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
              <th style={{ padding: '6px 8px' }}>Tarih</th>
              <th style={{ padding: '6px 8px' }}>Modül</th>
              <th style={{ padding: '6px 8px' }}>Olay Türü</th>
              <th style={{ padding: '6px 8px' }}>Kayıt</th>
              <th style={{ padding: '6px 8px' }}>Veri</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{e.createdAt.toLocaleString('tr-TR')}</td>
                <td style={{ padding: '6px 8px' }}>{MODULE_LABELS[e.sourceModule] ?? e.sourceModule}</td>
                <td style={{ padding: '6px 8px' }}>{EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}</td>
                <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--dim-on-surface-variant)' }}>{e.entityId ?? '—'}</td>
                <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--dim-on-surface-variant)' }}>{e.payload ? JSON.stringify(e.payload) : '—'}</td>
              </tr>
            ))}
            {events.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz olay yok.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

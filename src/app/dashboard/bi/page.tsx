import { requireFactoryAdmin } from '@/lib/dal';
import { listCompanyDepartments } from '@/lib/departments';
import { getExecutiveSummary, getFactoryManagerSummary, getCfoSummary } from '@/lib/bi/dashboard';
import { getAlertCenterItems } from '@/lib/bi/alerts';
import { getExpirationAlerts } from '@/lib/bi/expiration';

const MODULE_LABELS: Record<string, string> = { SAFETY: 'İSG', QUALITY: 'Kalite', SALES: 'Satış', LEGAL: 'Hukuk', FLEET: 'Filo', ENVIRONMENT: 'Çevre', HR: 'İK', IT: 'BT' };
const SEVERITY_LABELS: Record<string, string> = { HIGH: 'Yüksek', MEDIUM: 'Orta' };

function fmt(value: number): string {
  return value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{ border: '1px solid var(--dim-border-soft)', borderRadius: 6, padding: '10px 16px', minWidth: 140 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>{label}</div>
    </div>
  );
}

export default async function BiPage({ searchParams }: { searchParams: Promise<{ withinDays?: string }> }) {
  const { withinDays: withinDaysParam } = await searchParams;
  const session = await requireFactoryAdmin();
  const withinDays = Number(withinDaysParam) > 0 ? Number(withinDaysParam) : 30;

  const [executive, factory, cfo, alerts, expiring, departments] = await Promise.all([
    getExecutiveSummary(session.companyId),
    getFactoryManagerSummary(session.companyId),
    getCfoSummary(session.companyId),
    getAlertCenterItems(session.companyId),
    getExpirationAlerts(session.companyId, withinDays),
    listCompanyDepartments(session.companyId)
  ]);

  const itDepartment = departments.find((d) => d.departmentTypeCode === 'IT');
  const sortedAlerts = [...alerts].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1));

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>BI / Yönetim Panosu</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        Faz 12 — hiçbir yeni özet tablosu yok, tamamı mevcut modüllerin talep üzerine hesaplanan bir agregasyonu. Şirket geneli veri olduğu için yalnızca Fabrika Yöneticisi erişebilir.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>CEO Özeti</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <Stat label="Toplam Gelir" value={`₺${fmt(Number(executive.totalRevenue))}`} />
        <Stat label="Toplam Gider" value={`₺${fmt(Number(executive.totalExpense))}`} />
        <Stat label="Net Kâr/Zarar" value={`₺${fmt(Number(executive.netIncome))}`} accent={Number(executive.netIncome) >= 0 ? '#0a7a2f' : '#b00020'} />
        <Stat label="Toplam Varlık" value={`₺${fmt(Number(executive.totalAssets))}`} />
        <Stat label="Mevcut Nakit (Banka)" value={`₺${fmt(executive.currentCash)}`} />
        <Stat label="Açık Satış Siparişi" value={executive.openSalesOrdersCount} />
        <Stat label="Devam Eden Üretim Emri" value={executive.productionOrdersInProgressCount} />
        <Stat label="Açık NCR" value={executive.openNcrCount} />
        <Stat label="Açık İSG Olayı" value={executive.openSafetyIncidentsCount} />
        <Stat label="Yüksek Öncelikli Uyarı" value={executive.highAlertCount} accent={executive.highAlertCount > 0 ? '#b00020' : undefined} />
        <Stat label="Orta Öncelikli Uyarı" value={executive.mediumAlertCount} />
        <Stat label={`${withinDays} Gün İçinde Sona Erecek`} value={executive.expiringSoonCount} />
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Fabrika Müdürü</h2>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Üretim Emirleri (Durum)</div>
          <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {factory.productionOrdersByStatus.map((r) => (
                <tr key={r.status}><td style={{ padding: '2px 10px 2px 0' }}>{r.status}</td><td style={{ padding: '2px 0', textAlign: 'right', fontFamily: 'monospace' }}>{r.count}</td></tr>
              ))}
              {factory.productionOrdersByStatus.length === 0 ? <tr><td style={{ color: 'var(--dim-slate)' }}>Kayıt yok</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>EAM Varlıkları (Durum)</div>
          <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {factory.eamAssetsByStatus.map((r) => (
                <tr key={r.status}><td style={{ padding: '2px 10px 2px 0' }}>{r.status}</td><td style={{ padding: '2px 0', textAlign: 'right', fontFamily: 'monospace' }}>{r.count}</td></tr>
              ))}
              {factory.eamAssetsByStatus.length === 0 ? <tr><td style={{ color: 'var(--dim-slate)' }}>Kayıt yok</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignContent: 'flex-start' }}>
          <Stat label="Devam Eden Makine Duruşu" value={factory.openMachineDowntimesCount} />
          <Stat label="Açık NCR" value={factory.openNcrCount} />
          <Stat label="Açık İSG Olayı" value={factory.openSafetyIncidentsCount} />
          <Stat label="Sona Erecek Araç Belgesi (30g)" value={factory.expiringVehicleDocsCount} />
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>CFO</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Toplam Varlık" value={`₺${fmt(Number(cfo.totalAssets))}`} />
        <Stat label="Toplam Kaynak" value={`₺${fmt(Number(cfo.totalLiabilitiesAndEquity))}`} />
        <Stat label="Net Kâr/Zarar" value={`₺${fmt(Number(cfo.netIncome))}`} />
        <Stat label="30 Gün Nakit Tahmini" value={`₺${fmt(cfo.cashFlow30Day.projectedEndingCash)}`} />
        <Stat label="Açık Satış Faturası" value={cfo.openSalesInvoicesCount} />
        <Stat label="Açık Tedarikçi Faturası" value={cfo.openVendorInvoicesCount} />
        <Stat label="Aktif Teminat" value={cfo.activeCollateralsCount} />
      </div>
      {cfo.fxExposure.length > 0 ? (
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Kur Riski (Yabancı Para Hesapları)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Hesap</th><th style={{ padding: '6px 8px' }}>Para Birimi</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Bakiye</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Gerçekleşmemiş K/Z</th></tr></thead>
            <tbody>
              {cfo.fxExposure.map((f) => (
                <tr key={f.bankAccountId} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                  <td style={{ padding: '6px 8px' }}>{f.name}</td>
                  <td style={{ padding: '6px 8px' }}>{f.currency}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(f.nativeBalance)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{f.unrealizedGainLoss === null ? '— (kur yok)' : `₺${fmt(f.unrealizedGainLoss)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>BT Müdürü</h2>
      <p style={{ fontSize: 13, marginBottom: 24 }}>
        {itDepartment ? <a href={`/dashboard/departments/${itDepartment.id}/it/dashboard`}>BT Kontrol Paneline git</a> : <span style={{ color: 'var(--dim-slate)' }}>Şirkette BT departmanı tanımlı değil.</span>}
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Alert Center ({alerts.length})</h2>
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Önem</th><th style={{ padding: '6px 8px' }}>Modül</th><th style={{ padding: '6px 8px' }}>Açıklama</th></tr></thead>
          <tbody>
            {sortedAlerts.map((a) => (
              <tr key={`${a.module}-${a.itemType}-${a.id}`} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                <td style={{ padding: '6px 8px', color: a.severity === 'HIGH' ? '#b00020' : '#a06a00', fontWeight: 600 }}>{SEVERITY_LABELS[a.severity]}</td>
                <td style={{ padding: '6px 8px' }}>{MODULE_LABELS[a.module] ?? a.module}</td>
                <td style={{ padding: '6px 8px' }}>{a.label}</td>
              </tr>
            ))}
            {alerts.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Açık uyarı yok.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Expiration Engine — Sona Erecekler ({expiring.length})</h2>
      <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
        <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Gün İçinde</label><input name="withinDays" type="number" min={1} defaultValue={withinDays} style={{ padding: 6, width: 100 }} /></div>
        <button type="submit" style={{ padding: '7px 14px', cursor: 'pointer' }}>Uygula</button>
      </form>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Modül</th><th style={{ padding: '6px 8px' }}>Tür</th><th style={{ padding: '6px 8px' }}>Açıklama</th><th style={{ padding: '6px 8px' }}>Son Tarih</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Kalan Gün</th></tr></thead>
          <tbody>
            {expiring.map((e) => (
              <tr key={`${e.module}-${e.itemType}-${e.id}`} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                <td style={{ padding: '6px 8px' }}>{MODULE_LABELS[e.module] ?? e.module}</td>
                <td style={{ padding: '6px 8px' }}>{e.itemType}</td>
                <td style={{ padding: '6px 8px' }}>{e.label}</td>
                <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{e.expiryDate}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: e.daysRemaining <= 7 ? '#b00020' : undefined }}>{e.daysRemaining}</td>
              </tr>
            ))}
            {expiring.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Bu pencerede sona erecek kayıt yok.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

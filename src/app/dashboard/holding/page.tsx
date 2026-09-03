import { requireHoldingAdmin } from '@/lib/dal';
import { listHoldings, listHoldingCompanies, getConsolidatedSummary } from '@/lib/holding';
import { db } from '@/db/client';
import { companies } from '@/db/schema';
import { CreateHoldingForm, MoveCompanyForm } from '@/components/holding/holding-forms';

const ACCOUNT_TYPE_LABELS: Record<string, string> = { ASSET: 'Varlık', LIABILITY: 'Borç', EQUITY: 'Özkaynak', REVENUE: 'Gelir', EXPENSE: 'Gider' };

export default async function HoldingPage() {
  const session = await requireHoldingAdmin();
  const [holdings, holdingCompanies, allCompanies, consolidated] = await Promise.all([
    listHoldings(),
    listHoldingCompanies(session.holdingId),
    db.select({ id: companies.id, name: companies.name, holdingId: companies.holdingId }).from(companies),
    getConsolidatedSummary(session.holdingId)
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Holding Yönetimi</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        Holding ERP Faz 0 — bu, ayrı bir kiracı sınırı DEĞİL (kiracı sınırı hâlâ fiziksel MySQL veritabanı, bkz. TENANT-ARCHITECTURE.md), yalnızca AYNI veritabanı içindeki şirketleri gruplayan organizasyonel bir üst-seviye.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Şirketler ({holdingCompanies.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Vergi No</th>
          </tr>
        </thead>
        <tbody>
          {holdingCompanies.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{c.name}</td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--dim-on-surface-variant)' }}>{c.taxId || '—'}</td>
            </tr>
          ))}
          {holdingCompanies.length === 0 ? <tr><td colSpan={2} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Bu holding'de şirket yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Konsolide Mizan Özeti</h2>
      <p style={{ color: 'var(--dim-slate)', marginBottom: 8, fontSize: 12 }}>
        Her şirket kendi hesap planını/muhasebe fişlerini korur (holding-genelinde tek bir fiş defteri YOK) — bu yalnızca hesap TÜRÜ bazında (Varlık/Borç/Özkaynak/Gelir/Gider) toplanmış, salt-okunur bir özet.
      </p>
      <div style={{ overflowX: 'auto', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
              <th style={{ padding: '6px 8px' }}>Şirket</th>
              {Object.values(ACCOUNT_TYPE_LABELS).map((label) => <th key={label} style={{ padding: '6px 8px', textAlign: 'right' }}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {consolidated.companies.map((c) => (
              <tr key={c.companyId} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                <td style={{ padding: '6px 8px' }}>{c.companyName}</td>
                {Object.keys(ACCOUNT_TYPE_LABELS).map((type) => (
                  <td key={type} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{c.totalsByType[type as keyof typeof c.totalsByType]?.balance ?? '0.00'}</td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid var(--dim-border)', fontWeight: 600 }}>
              <td style={{ padding: '6px 8px' }}>Holding Toplamı</td>
              {Object.keys(ACCOUNT_TYPE_LABELS).map((type) => (
                <td key={type} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{consolidated.holdingTotalsByType[type as keyof typeof consolidated.holdingTotalsByType]?.balance ?? '0.00'}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Yeni Holding</h2>
      <div style={{ marginBottom: 20 }}><CreateHoldingForm /></div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Şirketi Başka Holding'e Taşı</h2>
      <div style={{ marginBottom: 20 }}>
        <MoveCompanyForm companies={allCompanies} holdings={holdings.map((h) => ({ id: h.id, name: h.name }))} />
      </div>
    </div>
  );
}

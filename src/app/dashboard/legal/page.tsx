import { requireSession, listCompanyUsers } from '@/lib/dal';
import { listContracts, listExpiringContracts } from '@/lib/legal/contracts';
import { listLawsuits } from '@/lib/legal/lawsuits';
import { listCollaterals } from '@/lib/legal/collaterals';
import { listParties } from '@/lib/master-data/parties';
import { CreateContractForm, UpdateContractStatusForm, CreateLawsuitForm, UpdateLawsuitStatusForm, CreateCollateralForm, ReleaseCollateralButton } from '@/components/legal/legal-forms';

const CONTRACT_TYPE_LABELS: Record<string, string> = { SUPPLIER: 'Tedarikçi', CUSTOMER: 'Müşteri', LEASE: 'Kira', NDA: 'Gizlilik', SERVICE: 'Hizmet', OTHER: 'Diğer' };
const CONTRACT_STATUS_LABELS: Record<string, string> = { DRAFT: 'Taslak', ACTIVE: 'Aktif', EXPIRED: 'Süresi Doldu', TERMINATED: 'Feshedildi' };
const LAWSUIT_STATUS_LABELS: Record<string, string> = { OPEN: 'Açık', IN_PROGRESS: 'Devam Ediyor', SETTLED: 'Uzlaşıldı', WON: 'Kazanıldı', LOST: 'Kaybedildi', CLOSED: 'Kapatıldı' };
const COLLATERAL_TYPE_LABELS: Record<string, string> = { LETTER_OF_GUARANTEE: 'Teminat Mektubu', CASH_DEPOSIT: 'Nakit Teminat', CHECK: 'Çek', PROMISSORY_NOTE: 'Senet', OTHER: 'Diğer' };

export default async function LegalPage() {
  const session = await requireSession();
  const [contracts, expiringContracts, lawsuits, collaterals, parties, users] = await Promise.all([
    listContracts(session.companyId), listExpiringContracts(session.companyId, 30), listLawsuits(session.companyId),
    listCollaterals(session.companyId), listParties(session.companyId), listCompanyUsers(session.companyId)
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Hukuk (Sözleşme/Dava/Teminat)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Risk kaydı için <a href="/dashboard/legal/risks">ayrı sayfa</a>. Sözleşme/dava belgeleri opsiyonel olarak yüklenebilir.</p>

      {expiringContracts.length > 0 ? (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 8, color: 'var(--dim-danger)' }}>30 Gün İçinde Sona Erecek Sözleşmeler ({expiringContracts.length})</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Başlık</th><th style={{ padding: '6px 8px' }}>Bitiş</th></tr></thead>
            <tbody>
              {expiringContracts.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{c.contractNo}</td>
                  <td style={{ padding: '6px 8px' }}>{c.title}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--dim-danger)', fontWeight: 600 }}>{c.endDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Sözleşme Oluştur</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateContractForm parties={parties.map((p) => ({ id: p.id, legalName: p.legalName }))} users={users.map((u) => ({ id: u.id, fullName: u.fullName }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Sözleşmeler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Başlık</th><th style={{ padding: '6px 8px' }}>Tip</th>
            <th style={{ padding: '6px 8px' }}>Karşı Taraf</th><th style={{ padding: '6px 8px' }}>Bitiş</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{c.contractNo}</td>
              <td style={{ padding: '6px 8px' }}>{c.title}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{CONTRACT_TYPE_LABELS[c.contractType]}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.counterpartyName ?? c.counterpartyFreeName ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.endDate ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{CONTRACT_STATUS_LABELS[c.status]}</td>
              <td style={{ padding: '6px 8px' }}><UpdateContractStatusForm contractId={c.id} /></td>
            </tr>
          ))}
          {contracts.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz sözleşme yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Dava Kaydı Oluştur</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateLawsuitForm
          contracts={contracts.map((c) => ({ id: c.id, contractNo: c.contractNo, title: c.title }))}
          parties={parties.map((p) => ({ id: p.id, legalName: p.legalName }))} users={users.map((u) => ({ id: u.id, fullName: u.fullName }))}
        />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Davalar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Başlık</th><th style={{ padding: '6px 8px' }}>Rol</th>
            <th style={{ padding: '6px 8px' }}>Karşı Taraf</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Dava Değeri</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {lawsuits.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{l.caseNo}</td>
              <td style={{ padding: '6px 8px' }}>{l.title}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{l.companyRole === 'PLAINTIFF' ? 'Davacı' : 'Davalı'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{l.counterpartyName ?? l.counterpartyFreeName ?? '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{l.claimAmount ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{LAWSUIT_STATUS_LABELS[l.status]}</td>
              <td style={{ padding: '6px 8px' }}><UpdateLawsuitStatusForm lawsuitId={l.id} /></td>
            </tr>
          ))}
          {lawsuits.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz dava kaydı yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Teminat Ekle</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateCollateralForm contracts={contracts.map((c) => ({ id: c.id, contractNo: c.contractNo, title: c.title }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Teminatlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Tip</th><th style={{ padding: '6px 8px' }}>Sözleşme</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Tutar</th>
            <th style={{ padding: '6px 8px' }}>Veren</th><th style={{ padding: '6px 8px' }}>Son Geçerlilik</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {collaterals.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{COLLATERAL_TYPE_LABELS[c.collateralType]}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)', fontFamily: 'monospace' }}>{c.contractNo ?? '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{c.amount}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.provider || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.expiryDate ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.status === 'ACTIVE' ? 'Aktif' : c.status === 'RELEASED' ? 'Serbest' : 'Süresi Doldu'}</td>
              <td style={{ padding: '6px 8px' }}>{c.status === 'ACTIVE' ? <ReleaseCollateralButton collateralId={c.id} /> : null}</td>
            </tr>
          ))}
          {collaterals.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz teminat yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

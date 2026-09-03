import {
  listVendors, listSoftwareProducts, listInstallations, listLicenses, listUnassignedInstallations,
  listWarranties, listContracts, listExpiringLicenses, listExpiringWarranties, listExpiringContracts
} from '@/lib/it/licensing';
import { requireDepartmentAccess } from '@/lib/dal';
import { listAssets } from '@/lib/it/assets';
import { VendorForm } from '@/components/it/vendor-form';
import { SoftwareProductForm } from '@/components/it/software-product-form';
import { InstallationForm } from '@/components/it/installation-form';
import { LicenseForm } from '@/components/it/license-form';
import { AssignSeatForm } from '@/components/it/assign-seat-form';
import { WarrantyForm } from '@/components/it/warranty-form';
import { ContractForm } from '@/components/it/contract-form';

const CONTRACT_TYPE_LABELS: Record<string, string> = { SUPPORT: 'Destek', MAINTENANCE: 'Bakım', SERVICE: 'Hizmet', LEASE: 'Kiralama', OTHER: 'Diğer' };

export default async function LicensingPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [vendors, products, installations, licenses, unassignedInstallations, warranties, contracts, expiringLicenses, expiringWarranties, expiringContracts, assets] = await Promise.all([
    listVendors(session.companyId), listSoftwareProducts(session.companyId), listInstallations(session.companyId), listLicenses(session.companyId),
    listUnassignedInstallations(session.companyId), listWarranties(session.companyId), listContracts(session.companyId),
    listExpiringLicenses(session.companyId), listExpiringWarranties(session.companyId), listExpiringContracts(session.companyId),
    listAssets(session.companyId)
  ]);

  const hasExpiring = expiringLicenses.length + expiringWarranties.length + expiringContracts.length > 0;

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Lisans / Garanti / Sözleşme</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Bitişi 30 gün içinde olan kayıtlar aşağıda vurgulanır.</p>

      {hasExpiring ? (
        <div style={{ border: '1px solid var(--dim-violet)', background: 'rgba(251,90,110,0.08)', padding: 12, borderRadius: 6, marginBottom: 20, fontSize: 13 }}>
          <b style={{ color: 'var(--dim-danger)' }}>Yaklaşan Bitişler (30 gün):</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {expiringLicenses.map((l) => <li key={l.id}>Lisans — {l.productName}: {l.expiresAt}</li>)}
            {expiringWarranties.map((w) => <li key={w.id}>Garanti — {w.assetTag}: {w.endDate}</li>)}
            {expiringContracts.map((c) => <li key={c.id}>Sözleşme — {c.title}: {c.endDate}</li>)}
          </ul>
        </div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Tedarikçiler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Yetkili</th><th style={{ padding: '6px 8px' }}>E-posta</th><th style={{ padding: '6px 8px' }}>Telefon</th></tr></thead>
        <tbody>
          {vendors.map((v) => <tr key={v.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}><td style={{ padding: '6px 8px' }}>{v.name}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{v.contactName || '—'}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{v.contactEmail || '—'}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{v.contactPhone || '—'}</td></tr>)}
          {vendors.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz tedarikçi yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.configure ? <div style={{ marginBottom: 24 }}><VendorForm departmentId={departmentId} /></div> : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Yazılım Ürünleri ve Kurulumlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Ürün</th><th style={{ padding: '6px 8px' }}>Üretici</th><th style={{ padding: '6px 8px' }}>Tedarikçi</th></tr></thead>
        <tbody>
          {products.map((p) => <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}><td style={{ padding: '6px 8px' }}>{p.name}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.publisher || '—'}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.vendorName || '—'}</td></tr>)}
          {products.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz yazılım ürünü yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.configure ? <div style={{ marginBottom: 12 }}><SoftwareProductForm departmentId={departmentId} vendors={vendors.map((v) => ({ id: v.id, name: v.name }))} /></div> : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Ürün</th><th style={{ padding: '6px 8px' }}>Varlık</th><th style={{ padding: '6px 8px' }}>Sürüm</th><th style={{ padding: '6px 8px' }}>Kuruldu</th></tr></thead>
        <tbody>
          {installations.map((i) => <tr key={i.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}><td style={{ padding: '6px 8px' }}>{i.productName}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{i.assetTag} — {i.assetName}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{i.installedVersion || '—'}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{new Date(i.installedAt).toLocaleDateString('tr-TR')}</td></tr>)}
          {installations.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz kurulum yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.update ? <div style={{ marginBottom: 24 }}><InstallationForm departmentId={departmentId} products={products.map((p) => ({ id: p.id, name: p.name }))} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} /></div> : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Lisanslar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Ürün</th><th style={{ padding: '6px 8px' }}>Tedarikçi</th><th style={{ padding: '6px 8px' }}>Koltuk</th><th style={{ padding: '6px 8px' }}>Bitiş</th><th style={{ padding: '6px 8px' }}>Maliyet</th></tr></thead>
        <tbody>
          {licenses.map((l) => <tr key={l.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}><td style={{ padding: '6px 8px' }}>{l.productName}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{l.vendorName || '—'}</td><td style={{ padding: '6px 8px' }}>{l.usedSeats}/{l.seats}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{l.expiresAt || '—'}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{l.cost ?? '—'}</td></tr>)}
          {licenses.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz lisans yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.configure ? <div style={{ marginBottom: 12 }}><LicenseForm departmentId={departmentId} products={products.map((p) => ({ id: p.id, name: p.name }))} vendors={vendors.map((v) => ({ id: v.id, name: v.name }))} /></div> : null}
      {access.permissions.assign && licenses.length > 0 && unassignedInstallations.length > 0 ? (
        <div style={{ marginBottom: 24 }}><AssignSeatForm departmentId={departmentId} licenses={licenses.map((l) => ({ id: l.id, productName: l.productName, seats: l.seats, usedSeats: l.usedSeats }))} installations={unassignedInstallations.map((i) => ({ id: i.id, productName: i.productName, assetTag: i.assetTag }))} /></div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Garantiler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Varlık</th><th style={{ padding: '6px 8px' }}>Tedarikçi</th><th style={{ padding: '6px 8px' }}>Başlangıç</th><th style={{ padding: '6px 8px' }}>Bitiş</th><th style={{ padding: '6px 8px' }}>Maliyet</th></tr></thead>
        <tbody>
          {warranties.map((w) => <tr key={w.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}><td style={{ padding: '6px 8px' }}>{w.assetTag} — {w.assetName}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{w.vendorName || '—'}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{w.startDate}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{w.endDate}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{w.cost ?? '—'}</td></tr>)}
          {warranties.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz garanti kaydı yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.configure ? <div style={{ marginBottom: 24 }}><WarrantyForm departmentId={departmentId} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} vendors={vendors.map((v) => ({ id: v.id, name: v.name }))} /></div> : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Sözleşmeler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Başlık</th><th style={{ padding: '6px 8px' }}>Tür</th><th style={{ padding: '6px 8px' }}>Tedarikçi</th><th style={{ padding: '6px 8px' }}>Bitiş</th><th style={{ padding: '6px 8px' }}>Maliyet</th></tr></thead>
        <tbody>
          {contracts.map((c) => <tr key={c.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}><td style={{ padding: '6px 8px' }}>{c.title}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{CONTRACT_TYPE_LABELS[c.contractType]}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.vendorName || '—'}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.endDate}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.cost ?? '—'}</td></tr>)}
          {contracts.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz sözleşme yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.configure ? <ContractForm departmentId={departmentId} vendors={vendors.map((v) => ({ id: v.id, name: v.name }))} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} /> : null}
    </div>
  );
}

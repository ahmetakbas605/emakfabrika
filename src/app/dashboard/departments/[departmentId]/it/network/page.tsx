import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { listVlans, listSubnets, listInterfaces } from '@/lib/it/ipam';
import { listAssets } from '@/lib/it/assets';
import { VlanForm } from '@/components/it/vlan-form';
import { SubnetForm } from '@/components/it/subnet-form';
import { InterfaceForm } from '@/components/it/interface-form';

export default async function NetworkPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [vlans, subnets, interfaces, assets] = await Promise.all([
    listVlans(session.companyId), listSubnets(session.companyId), listInterfaces(session.companyId), listAssets(session.companyId)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>IPAM / Ağ</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Bir subnet&apos;in tüm 254 adresi önceden oluşturulmaz — boş adresler CIDR&apos;dan hesaplanır (IPAM.md §1).</p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>VLAN&apos;lar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Amaç</th><th style={{ padding: '6px 8px' }}>Şube</th></tr></thead>
        <tbody>
          {vlans.map((v) => <tr key={v.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}><td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{v.vlanNumber}</td><td style={{ padding: '6px 8px' }}>{v.name}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{v.purpose || '—'}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{v.branchName || '—'}</td></tr>)}
          {vlans.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz VLAN yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.configure ? <div style={{ marginBottom: 24 }}><VlanForm departmentId={departmentId} /></div> : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Subnet&apos;ler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>CIDR</th><th style={{ padding: '6px 8px' }}>Gateway</th><th style={{ padding: '6px 8px' }}>VLAN</th><th style={{ padding: '6px 8px' }}>Şube</th></tr></thead>
        <tbody>
          {subnets.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}><Link href={`/dashboard/departments/${departmentId}/it/network/${s.id}`}>{s.cidr}</Link></td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.gateway || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.vlanNumber ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.branchName || '—'}</td>
            </tr>
          ))}
          {subnets.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz subnet yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.configure ? <div style={{ marginBottom: 24 }}><SubnetForm departmentId={departmentId} vlans={vlans.map((v) => ({ id: v.id, vlanNumber: v.vlanNumber, name: v.name }))} /></div> : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Ağ Arayüzleri</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Varlık</th><th style={{ padding: '6px 8px' }}>Arayüz</th><th style={{ padding: '6px 8px' }}>MAC</th><th style={{ padding: '6px 8px' }}>Tür</th><th style={{ padding: '6px 8px' }}>VLAN</th></tr></thead>
        <tbody>
          {interfaces.map((i) => <tr key={i.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}><td style={{ padding: '6px 8px' }}>{i.assetTag}</td><td style={{ padding: '6px 8px' }}>{i.name}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)', fontFamily: 'monospace' }}>{i.macAddress || '—'}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{i.interfaceType}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{i.vlanNumber ?? '—'}</td></tr>)}
          {interfaces.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz ağ arayüzü yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.update ? <InterfaceForm departmentId={departmentId} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} vlans={vlans.map((v) => ({ id: v.id, vlanNumber: v.vlanNumber, name: v.name }))} /> : null}
    </div>
  );
}

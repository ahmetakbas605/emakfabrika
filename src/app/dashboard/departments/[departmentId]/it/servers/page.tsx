import { requireDepartmentAccess } from '@/lib/dal';
import { listHostsWithVmSummary, listVmsForHost, listUnhostedVms } from '@/lib/it/servers';
import { listAssets } from '@/lib/it/assets';
import { SetVmHostForm } from '@/components/it/set-vm-host-form';

export default async function ServersPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [hosts, unhostedVms, allAssets] = await Promise.all([listHostsWithVmSummary(session.companyId), listUnhostedVms(session.companyId), listAssets(session.companyId)]);
  const vmsByHost = await Promise.all(hosts.map((h) => listVmsForHost(h.hostId)));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Sunucular ve Sanal Makineler</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Bir host&apos;a ayrılan (allocated) toplam VM kaynağı, host kapasitesini aşabilir — bu bilinçli olarak DB&apos;de zorlanmaz, yalnızca görünür kılınır.</p>

      {hosts.map((h, i) => (
        <div key={h.hostId} style={{ border: '1px solid var(--dim-border-soft)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <b>{h.hostTag} — {h.hostName}</b>
            <span style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>{h.vmCount} VM · Ayrılan: {h.allocatedRamGb}GB RAM / {h.allocatedStorageGb}GB Disk{h.hostRamGb ? ` (host: ${h.hostRamGb}GB RAM)` : ''}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border-soft)' }}><th style={{ padding: '4px 8px' }}>VM</th><th style={{ padding: '4px 8px' }}>Durum</th><th style={{ padding: '4px 8px' }}>CPU</th><th style={{ padding: '4px 8px' }}>RAM</th><th style={{ padding: '4px 8px' }}>Disk</th></tr></thead>
            <tbody>
              {vmsByHost[i].map((vm) => (
                <tr key={vm.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                  <td style={{ padding: '4px 8px' }}>{vm.assetTag} — {vm.name}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--dim-on-surface-variant)' }}>{vm.status}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--dim-on-surface-variant)' }}>{vm.cpu || '—'}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--dim-on-surface-variant)' }}>{vm.ramGb ? `${vm.ramGb}GB` : '—'}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--dim-on-surface-variant)' }}>{vm.storageGb ? `${vm.storageGb}GB` : '—'}</td>
                </tr>
              ))}
              {vmsByHost[i].length === 0 ? <tr><td colSpan={5} style={{ padding: '4px 8px', color: 'var(--dim-slate)' }}>Bu host üzerinde VM yok.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ))}
      {hosts.length === 0 ? <p style={{ color: 'var(--dim-slate)', fontSize: 13, marginBottom: 20 }}>Henüz SERVER tipi varlık yok.</p> : null}

      {access.permissions.update && unhostedVms.length > 0 ? (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Host&apos;suz VM&apos;ler</h2>
          <SetVmHostForm departmentId={departmentId} vms={unhostedVms} hosts={allAssets.filter((a) => a.assetTypeCode === 'SERVER').map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} />
        </>
      ) : null}
    </div>
  );
}

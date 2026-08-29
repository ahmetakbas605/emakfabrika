import { requireSession, listCompanyUsers } from '@/lib/dal';
import { listDelegations } from '@/lib/org';
import { DelegationForm, DeactivateDelegationButton } from '@/components/org/delegation-form';

export default async function DelegationsPage() {
  const session = await requireSession();
  const [allDelegations, users] = await Promise.all([listDelegations(session.companyId), listCompanyUsers(session.companyId)]);
  const userById = new Map(users.map((u) => [u.id, u.fullName]));

  // Fabrika yöneticisi TÜMÜNÜ görür (denetim amaçlı); diğer kullanıcılar
  // yalnızca kendi verdiği veya kendisine verilen vekaletleri görür.
  const visible = session.isFactoryAdmin ? allDelegations : allDelegations.filter((d) => d.delegatorUserId === session.id || d.delegateUserId === session.id);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Vekaletler</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>İzinli olduğunuz dönemde onaylarınız otomatik olarak seçtiğiniz vekile devredilir — yeni başlayan onay örnekleri bunu kullanır, geçmiş onaylar etkilenmez.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Veren</th>
            <th style={{ padding: '6px 8px' }}>Vekil</th>
            <th style={{ padding: '6px 8px' }}>Başlangıç</th>
            <th style={{ padding: '6px 8px' }}>Bitiş</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((d) => (
            <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{userById.get(d.delegatorUserId) ?? '—'}</td>
              <td style={{ padding: '6px 8px' }}>{userById.get(d.delegateUserId) ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{new Date(d.startsAt).toLocaleString('tr-TR')}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{new Date(d.endsAt).toLocaleString('tr-TR')}</td>
              <td style={{ padding: '6px 8px', color: d.active ? '#080' : '#999' }}>{d.active ? 'Aktif' : 'Pasif'}</td>
              <td style={{ padding: '6px 8px' }}>
                {d.active && d.delegatorUserId === session.id ? <DeactivateDelegationButton delegationId={d.id} /> : null}
              </td>
            </tr>
          ))}
          {visible.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz vekalet yok.</td></tr> : null}
        </tbody>
      </table>

      <DelegationForm users={users.filter((u) => u.id !== session.id).map((u) => ({ id: u.id, fullName: u.fullName }))} />
    </div>
  );
}

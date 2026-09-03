import { requireDepartmentAccess } from '@/lib/dal';
import { listParties } from '@/lib/master-data/parties';
import { listProducts } from '@/lib/master-data/products';
import { listCurrencies } from '@/lib/master-data/currency';
import { listUnits } from '@/lib/master-data/units';
import { listContractLines, listContracts } from '@/lib/marketing/contracts';
import { allowedActions } from '@/lib/marketing/contract-flow';
import { contractTotal } from '@/lib/marketing/contract-flow';
import {
  ContractActionForm,
  ContractCreateForm,
  ContractLineForm,
  CreateOrderFromContractForm,
  RequestSubProductForm
} from '@/components/marketing/contract-forms';

// Anlaşmalar — Pazarlama Faz 1.
//
// "anlaşmasını yapar ve İMZA ALTINA ALIR" — akış lib/marketing/
// contract-flow.ts'te tanımlı: DRAFT -> SUBMITTED -> SIGNED -> ACTIVE ->
// EXPIRED | TERMINATED. Bu sayfa yalnızca o akışın izin verdiği
// düğmeleri gösterir (allowedActions), yasak bir geçişi denemek sunucuda
// zaten reddediliyor ama arayüzde hiç görünmemesi daha iyi.

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak',
  SUBMITTED: 'Onaya Sunuldu',
  SIGNED: 'İmzalandı',
  ACTIVE: 'Yürürlükte',
  EXPIRED: 'Süresi Doldu',
  TERMINATED: 'Feshedildi'
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'var(--dim-slate)',
  SUBMITTED: 'var(--dim-warning)',
  SIGNED: 'var(--dim-cobalt)',
  ACTIVE: 'var(--dim-success)',
  EXPIRED: 'var(--dim-slate)',
  TERMINATED: 'var(--dim-danger)'
};

const DELIVERY_TERM_LABELS: Record<string, string> = {
  EX_WORKS: 'Fabrika Teslim',
  DELIVERED: 'Adrese Teslim',
  FOB: 'FOB',
  CIF: 'CIF',
  OTHER: 'Diğer'
};

function formatDate(value: string | Date | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('tr-TR');
}

export default async function MarketingContractsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);

  const [contracts, parties, products, currencies, units] = await Promise.all([
    listContracts(session.companyId, departmentId),
    listParties(session.companyId),
    listProducts(session.companyId),
    listCurrencies(),
    listUnits(session.companyId)
  ]);

  const contractLines = await Promise.all(
    contracts.map(async (c) => ({ contract: c, lines: await listContractLines(session.companyId, c.id) }))
  );

  const canApprove = access.permissions.approve;
  const canCreate = access.permissions.create;
  const canUpdate = access.permissions.update;

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Anlaşmalar</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        Satış sözleşmesi — imza altına alındıktan ve yürürlüğe girdikten sonra doğrudan siparişe dönüştürülebilir.
      </p>

      {canCreate ? (
        <ContractCreateForm
          departmentId={departmentId}
          partyOptions={parties.map((p) => ({ id: p.id, legalName: p.legalName }))}
          productOptions={products.map((p) => ({ id: p.id, name: p.name }))}
          currencyOptions={currencies.map((c) => ({ code: c.code }))}
        />
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Sözleşmeler</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {contractLines.map(({ contract, lines }) => {
          const total = contractTotal(lines);
          const actions = allowedActions(contract.status);
          // İmza/aktivasyon/fesih 'approve' yetkisi ister; onay yetkisi
          // olmayan biri bu düğmeleri hiç GÖRMEZ (sunucuda zaten reddedilir
          // ama boş bir buton göstermek yanıltıcı olurdu).
          const approvalGated: Record<string, boolean> = { SIGN: true, ACTIVATE: true, TERMINATE: true };

          return (
            <div key={contract.id} className="dim-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <div>
                  <span className="dim-metric" style={{ color: 'var(--dim-slate)' }}>{contract.contractNo}</span>
                  <h3 style={{ fontSize: 16, margin: '2px 0' }}>{contract.title}</h3>
                  <span style={{ fontSize: 13, color: 'var(--dim-on-surface-variant)' }}>
                    {contract.partyName}
                    {contract.counterpartyIsContractor ? ' — müteahhit' : ''}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: STATUS_COLORS[contract.status], fontSize: 13, fontWeight: 600 }}>
                    {STATUS_LABELS[contract.status] ?? contract.status}
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>
                    {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
                  </div>
                  {contract.signedAt ? (
                    <div style={{ fontSize: 11, color: 'var(--dim-slate)' }}>
                      İmza: {formatDate(contract.signedAt)} ({contract.counterpartySignatory || '—'})
                    </div>
                  ) : null}
                </div>
              </div>

              <table style={{ marginBottom: 8 }}>
                <thead>
                  <tr><th>Ürün</th><th>Miktar</th><th>Birim Fiyat</th><th>Teslim</th></tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.productName}</td>
                      <td>{Number(l.quantity).toLocaleString('tr-TR')}</td>
                      <td>{Number(l.unitPrice).toLocaleString('tr-TR')} {contract.currencyCode}</td>
                      <td>{DELIVERY_TERM_LABELS[l.deliveryTerm] ?? l.deliveryTerm}{l.deliveryNote ? ` — ${l.deliveryNote}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                Toplam: <strong>{total != null ? total.toLocaleString('tr-TR') : '—'} {contract.currencyCode}</strong>
              </p>

              {contract.status === 'DRAFT' && canUpdate ? (
                <div style={{ marginBottom: 12 }}>
                  <ContractLineForm
                    departmentId={departmentId}
                    contractId={contract.id}
                    productOptions={products.map((p) => ({ id: p.id, name: p.name }))}
                  />
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {actions.map((a) => {
                  if (approvalGated[a] && !canApprove) return null;
                  if (!approvalGated[a] && !canUpdate) return null;
                  return <ContractActionForm key={a} departmentId={departmentId} contractId={contract.id} action={a} />;
                })}
                {contract.status === 'ACTIVE' && canCreate ? (
                  <CreateOrderFromContractForm departmentId={departmentId} contractId={contract.id} />
                ) : null}
              </div>

              {/* Kullanıcının isteği: "müteahhit firma ihtiyacı olursa
                  alt ürünlerde onları ayarlar" -> "Satınalma
                  departmanına talep açılsın". Yalnızca bu bayrakla
                  işaretlenmiş sözleşmelerde görünür — diğer
                  sözleşmelerde bu butonun anlamı yok. */}
              {contract.counterpartyIsContractor && canCreate ? (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--dim-border-faint)', paddingTop: 12 }}>
                  <span className="dim-metric" style={{ color: 'var(--dim-slate)' }}>Müteahhit — Alt Ürün Talebi</span>
                  <div style={{ marginTop: 6 }}>
                    <RequestSubProductForm
                      departmentId={departmentId}
                      contractId={contract.id}
                      unitOptions={units.map((u) => ({ id: u.id, code: u.code }))}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {contracts.length === 0 ? (
          <p style={{ color: 'var(--dim-slate)', fontSize: 13 }}>Henüz sözleşme yok.</p>
        ) : null}
      </div>
    </div>
  );
}

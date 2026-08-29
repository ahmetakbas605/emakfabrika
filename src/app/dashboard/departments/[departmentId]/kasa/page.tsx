import { requireDepartmentAccess } from '@/lib/dal';
import { listCashAccounts, listCashTransactions } from '@/lib/cash';
import { listAccounts } from '@/lib/accounting';
import { CashAccountForm } from '@/components/cash-account-form';
import { CashTransactionForm } from '@/components/cash-transaction-form';

function money(value: string, currency: string): string {
  const symbol = currency === 'TRY' ? '₺' : currency;
  return `${symbol}${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function KasaPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [cashAccounts, transactions, accounts] = await Promise.all([
    listCashAccounts(session.companyId),
    listCashTransactions(session.companyId),
    listAccounts(session.companyId)
  ]);
  const cashByAccountId = new Map(cashAccounts.map((c) => [c.id, c]));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Kasa</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Her nakit hareket otomatik muhasebe fişi üretir (PDF madde 26).</p>

      {cashAccounts.length === 0 ? (
        <p style={{ color: '#999', fontSize: 13, marginBottom: 16 }}>Henüz kasa kartı yok.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
              <th style={{ padding: '6px 8px' }}>Kasa</th>
              <th style={{ padding: '6px 8px' }}>Bağlı Hesap</th>
              <th style={{ padding: '6px 8px' }}>Para Birimi</th>
            </tr>
          </thead>
          <tbody>
            {cashAccounts.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '6px 8px' }}>{c.name}</td>
                <td style={{ padding: '6px 8px', color: '#666' }}>{c.accountCode} — {c.accountName}</td>
                <td style={{ padding: '6px 8px', color: '#666' }}>{c.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {access.permissions.create ? <CashAccountForm departmentId={departmentId} accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} /> : null}

      {cashAccounts.length > 0 && access.permissions.post ? (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Yeni Hareket</h2>
          <CashTransactionForm departmentId={departmentId} cashAccounts={cashAccounts.map((c) => ({ id: c.id, name: c.name }))} accounts={accounts.map((a) => ({ code: a.code, name: a.name }))} />
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Son Hareketler</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
              <th style={{ padding: '6px 8px' }}>Tarih</th>
              <th style={{ padding: '6px 8px' }}>Kasa</th>
              <th style={{ padding: '6px 8px' }}>Yön</th>
              <th style={{ padding: '6px 8px' }}>Karşı Hesap</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Tutar</th>
              <th style={{ padding: '6px 8px' }}>Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '6px 8px' }}>{t.transactionDate}</td>
                <td style={{ padding: '6px 8px' }}>{cashByAccountId.get(t.cashAccountId)?.name ?? '-'}</td>
                <td style={{ padding: '6px 8px', color: t.transactionType === 'IN' ? '#080' : '#b00' }}>{t.transactionType === 'IN' ? 'Giriş' : 'Çıkış'}</td>
                <td style={{ padding: '6px 8px', color: '#666' }}>{t.counterAccountCode}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(t.amount, 'TRY')}</td>
                <td style={{ padding: '6px 8px', color: '#666' }}>{t.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

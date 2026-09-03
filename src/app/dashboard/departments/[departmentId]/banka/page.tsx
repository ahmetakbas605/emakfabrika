import { requireDepartmentAccess } from '@/lib/dal';
import { listBankAccounts, listBankTransactions } from '@/lib/bank';
import { listAccounts } from '@/lib/accounting';
import { BankAccountForm } from '@/components/bank-account-form';
import { BankTransactionForm } from '@/components/bank-transaction-form';

function money(value: string, currency: string): string {
  const symbol = currency === 'TRY' ? '₺' : currency;
  return `${symbol}${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function BankaPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [bankAccounts, transactions, accounts] = await Promise.all([
    listBankAccounts(session.companyId),
    listBankTransactions(session.companyId),
    listAccounts(session.companyId)
  ]);
  const bankByAccountId = new Map(bankAccounts.map((b) => [b.id, b]));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Banka</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Havale/EFT/FAST/kredi kartı/POS/komisyon — her hareket otomatik muhasebe fişi üretir (PDF madde 27).</p>

      {bankAccounts.length === 0 ? (
        <p style={{ color: 'var(--dim-slate)', fontSize: 13, marginBottom: 16 }}>Henüz banka hesabı yok.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
              <th style={{ padding: '6px 8px' }}>Banka Hesabı</th>
              <th style={{ padding: '6px 8px' }}>IBAN</th>
              <th style={{ padding: '6px 8px' }}>Bağlı Hesap</th>
              <th style={{ padding: '6px 8px' }}>Para Birimi</th>
            </tr>
          </thead>
          <tbody>
            {bankAccounts.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                <td style={{ padding: '6px 8px' }}>{b.name}</td>
                <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--dim-on-surface-variant)' }}>{b.iban}</td>
                <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{b.accountCode} — {b.accountName}</td>
                <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{b.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {access.permissions.create ? <BankAccountForm departmentId={departmentId} accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} /> : null}

      {bankAccounts.length > 0 && access.permissions.post ? (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Yeni Hareket</h2>
          <BankTransactionForm departmentId={departmentId} bankAccounts={bankAccounts.map((b) => ({ id: b.id, name: b.name }))} accounts={accounts.map((a) => ({ code: a.code, name: a.name }))} />
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Son Hareketler</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
              <th style={{ padding: '6px 8px' }}>Tarih</th>
              <th style={{ padding: '6px 8px' }}>Hesap</th>
              <th style={{ padding: '6px 8px' }}>Yön</th>
              <th style={{ padding: '6px 8px' }}>Yöntem</th>
              <th style={{ padding: '6px 8px' }}>Karşı Hesap</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Tutar</th>
              <th style={{ padding: '6px 8px' }}>Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                <td style={{ padding: '6px 8px' }}>{t.transactionDate}</td>
                <td style={{ padding: '6px 8px' }}>{bankByAccountId.get(t.bankAccountId)?.name ?? '-'}</td>
                <td style={{ padding: '6px 8px', color: t.transactionType === 'IN' ? '#080' : 'var(--dim-danger)' }}>{t.transactionType === 'IN' ? 'Giriş' : 'Çıkış'}</td>
                <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{t.method}</td>
                <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{t.counterAccountCode}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(t.amount, 'TRY')}</td>
                <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{t.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { listCategories, listArticles, searchArticles } from '@/lib/it/knowledge-base';
import { KbCategoryForm } from '@/components/it/kb-category-form';
import { KbArticleForm } from '@/components/it/kb-article-form';

export default async function KnowledgeBasePage({ params, searchParams }: { params: Promise<{ departmentId: string }>; searchParams: Promise<{ q?: string }> }) {
  const { departmentId } = await params;
  const { q } = await searchParams;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [categories, articles, searchResults] = await Promise.all([
    listCategories(session.companyId), listArticles(session.companyId), q ? searchArticles(session.companyId, q) : Promise.resolve(null)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Bilgi Bankası (Knowledge Base)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Yaygın çözümler ve prosedürler — basit metin araması yeterli (tam metin arama motoru gereksiz bir soyutlama).</p>

      <form method="get" style={{ marginBottom: 20 }}>
        <input name="q" defaultValue={q} placeholder="Ara..." style={{ padding: 6, width: 240 }} />
        <button type="submit" style={{ padding: '6px 12px', marginLeft: 8, cursor: 'pointer' }}>Ara</button>
      </form>

      {searchResults ? (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Arama Sonuçları ({searchResults.length})</h2>
          <ul>{searchResults.map((r) => <li key={r.id}><Link href={`/dashboard/departments/${departmentId}/it/knowledge-base/${r.id}`}>{r.title}</Link> {r.categoryName ? `(${r.categoryName})` : ''}</li>)}</ul>
        </div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Kategoriler</h2>
      <ul style={{ marginBottom: 20, fontSize: 13 }}>
        {categories.map((c) => <li key={c.id}>{c.name}</li>)}
        {categories.length === 0 ? <li style={{ color: 'var(--dim-slate)' }}>Henüz kategori yok.</li> : null}
      </ul>
      {access.permissions.configure ? <div style={{ marginBottom: 24 }}><KbCategoryForm departmentId={departmentId} categories={categories.map((c) => ({ id: c.id, name: c.name }))} /></div> : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Makaleler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Başlık</th><th style={{ padding: '6px 8px' }}>Kategori</th><th style={{ padding: '6px 8px' }}>Yazar</th><th style={{ padding: '6px 8px' }}>Görüntülenme</th></tr></thead>
        <tbody>
          {articles.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/departments/${departmentId}/it/knowledge-base/${a.id}`}>{a.title}</Link></td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{a.categoryName || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{a.authorName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{a.viewCount}</td>
            </tr>
          ))}
          {articles.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz makale yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.create ? <KbArticleForm departmentId={departmentId} categories={categories.map((c) => ({ id: c.id, name: c.name }))} /> : null}
    </div>
  );
}

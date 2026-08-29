import { requireDepartmentAccess } from '@/lib/dal';
import { getArticle } from '@/lib/it/knowledge-base';

export default async function KbArticleDetailPage({ params }: { params: Promise<{ departmentId: string; articleId: string }> }) {
  const { departmentId, articleId } = await params;
  const { session } = await requireDepartmentAccess(departmentId);
  const article = await getArticle(session.companyId, articleId);

  if (!article) return <p>Makale bulunamadı.</p>;

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{article.title}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>{article.categoryName || 'Kategorisiz'} · {article.authorName} · {article.viewCount + 1} görüntülenme · Son güncelleme: {new Date(article.updatedAt).toLocaleDateString('tr-TR')}</p>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{article.content}</div>
    </div>
  );
}

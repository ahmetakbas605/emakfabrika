import 'server-only';
import { eq, and, like, or, sql, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { kbCategories, kbArticles, users } from '@/db/schema';
import { newId } from '@/lib/id';

export async function createCategory(companyId: string, name: string, parentCategoryId?: string): Promise<string> {
  const id = newId();
  await db.insert(kbCategories).values({ id, companyId, name, parentCategoryId });
  return id;
}

export async function listCategories(companyId: string) {
  return db.select().from(kbCategories).where(eq(kbCategories.companyId, companyId));
}

export interface CreateArticleInput {
  categoryId?: string;
  title: string;
  content: string;
  authorUserId: string;
}

export async function createArticle(companyId: string, input: CreateArticleInput): Promise<string> {
  const id = newId();
  await db.insert(kbArticles).values({ id, companyId, ...input });
  return id;
}

export async function listArticles(companyId: string, categoryId?: string) {
  const conditions = [eq(kbArticles.companyId, companyId)];
  if (categoryId) conditions.push(eq(kbArticles.categoryId, categoryId));
  return db
    .select({ id: kbArticles.id, title: kbArticles.title, categoryName: kbCategories.name, authorName: users.fullName, viewCount: kbArticles.viewCount, updatedAt: kbArticles.updatedAt })
    .from(kbArticles)
    .leftJoin(kbCategories, eq(kbCategories.id, kbArticles.categoryId))
    .innerJoin(users, eq(users.id, kbArticles.authorUserId))
    .where(and(...conditions))
    .orderBy(desc(kbArticles.updatedAt));
}

// Görüntülenme her okunduğunda ARTAR — "en çok okunan makaleler" gibi
// bir sıralama için (bugün ayrı bir rapor ekranı yok, alan hazır tutulur).
export async function getArticle(companyId: string, articleId: string) {
  const [article] = await db
    .select({ id: kbArticles.id, title: kbArticles.title, content: kbArticles.content, categoryName: kbCategories.name, authorName: users.fullName, viewCount: kbArticles.viewCount, createdAt: kbArticles.createdAt, updatedAt: kbArticles.updatedAt })
    .from(kbArticles)
    .leftJoin(kbCategories, eq(kbCategories.id, kbArticles.categoryId))
    .innerJoin(users, eq(users.id, kbArticles.authorUserId))
    .where(and(eq(kbArticles.id, articleId), eq(kbArticles.companyId, companyId)))
    .limit(1);
  if (article) await db.update(kbArticles).set({ viewCount: sql`${kbArticles.viewCount} + 1` }).where(eq(kbArticles.id, articleId));
  return article ?? null;
}

// Basit LIKE araması — tam metin arama motoru (Elasticsearch vb.) bu
// ölçekte gereksiz bir soyutlama (madde 87), MySQL LIKE yeterli.
export async function searchArticles(companyId: string, query: string) {
  const pattern = `%${query}%`;
  return db
    .select({ id: kbArticles.id, title: kbArticles.title, categoryName: kbCategories.name })
    .from(kbArticles)
    .leftJoin(kbCategories, eq(kbCategories.id, kbArticles.categoryId))
    .where(and(eq(kbArticles.companyId, companyId), or(like(kbArticles.title, pattern), like(kbArticles.content, pattern))));
}

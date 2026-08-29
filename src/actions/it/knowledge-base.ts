'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createCategory, createArticle } from '@/lib/it/knowledge-base';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CategorySchema = z.object({ name: z.string().trim().min(1, 'Ad gerekli.'), parentCategoryId: z.string().trim().optional() });

export async function createCategoryAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = CategorySchema.safeParse({ name: formData.get('name'), parentCategoryId: optionalField(formData, 'parentCategoryId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createCategory(session.companyId, parsed.data.name, parsed.data.parentCategoryId);
  revalidatePath(`/dashboard/departments/${departmentId}/it/knowledge-base`);
  return { success: 'Kategori eklendi.' };
}

const ArticleSchema = z.object({ categoryId: z.string().trim().optional(), title: z.string().trim().min(1, 'Başlık gerekli.'), content: z.string().trim().min(1, 'İçerik gerekli.') });

export async function createArticleAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = ArticleSchema.safeParse({ categoryId: optionalField(formData, 'categoryId'), title: formData.get('title'), content: formData.get('content') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createArticle(session.companyId, { ...parsed.data, authorUserId: session.id });
  revalidatePath(`/dashboard/departments/${departmentId}/it/knowledge-base`);
  return { success: 'Makale eklendi.' };
}

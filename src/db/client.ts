import 'server-only';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';

// SECURITY-ARCHITECTURE.md §1 — DATABASE_URL, DML-ONLY yetkili kullanıcıya
// bağlanır. DDL/migration AYRI (scripts/migrate.ts, MIGRATE_DATABASE_URL).
const pool = mysql.createPool(process.env.DATABASE_URL!);

export const db = drizzle(pool, { schema, mode: 'default' });
export type Db = typeof db;
// Transaction callback'lerinin aldığı gerçek tip — Db'den YAPISAL olarak
// farklı (bkz. lib/accounting.ts'te yaşanan gerçek derleme hatası: $client
// alanı taşımıyor). db.transaction(async (tx) => ...) içindeki yardımcı
// fonksiyonlar hep BU tipi almalı, Db değil.
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// emakerp/drizzle.config.ts'teki AYNI gerekçe — DDL yetkisi gereken
// MIGRATE_DATABASE_URL kullanılır, uygulamanın kendisi ayrı, DML'e
// kısıtlı bir rolle bağlanır (bkz. SECURITY-ARCHITECTURE.md).
const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  throw new Error('MIGRATE_DATABASE_URL (ya da DATABASE_URL) tanımlı değil — .env dosyasını kontrol edin (.env.example\'a bakın).');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url
  }
});

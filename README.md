# emakfabrika

Fabrika/holding bazlı, departman modüllü ERP — EM-AK'ın küçük işletme SaaS'ı
olan `emakerp`'ten bilinçli olarak ayrı, kiracı-başına fiziksel MySQL
veritabanı kullanan bir sistem.

**Durum:** Mimari/analiz aşaması — henüz hiçbir iş modülü kodlanmadı. Başlamadan
önce mutlaka okuyun:

1. [ARCHITECTURE.md](./ARCHITECTURE.md) — genel bakış, emakerp'ten fark, riskler, faz planı
2. [DATABASE-ARCHITECTURE.md](./DATABASE-ARCHITECTURE.md)
3. [TENANT-ARCHITECTURE.md](./TENANT-ARCHITECTURE.md)
4. [ACCOUNTING-ENGINE.md](./ACCOUNTING-ENGINE.md) — ilk departman: Muhasebe
5. [MEVZUAT-MAP.md](./MEVZUAT-MAP.md)
6. [SECURITY-ARCHITECTURE.md](./SECURITY-ARCHITECTURE.md)
7. [API-ARCHITECTURE.md](./API-ARCHITECTURE.md)

## Yerel geliştirme

```bash
cd docker && docker compose up -d   # MySQL 8.4, 127.0.0.1:3307
cd .. && npm install
npm run dev
```

`.env.example` ve `docker/.env.example` dosyalarını kopyalayıp gerçek
değerlerle doldurun.

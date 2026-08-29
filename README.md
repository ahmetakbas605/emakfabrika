# emakfabrika

Fabrika/holding bazlı, departman modüllü ERP — EM-AK'ın küçük işletme SaaS'ı
olan `emakerp`'ten bilinçli olarak ayrı, kiracı-başına fiziksel MySQL
veritabanı kullanan bir sistem.

**Durum:** Mimari/analiz aşaması — henüz hiçbir iş modülü kodlanmadı. Başlamadan
önce mutlaka okuyun:

1. [ARCHITECTURE.md](./ARCHITECTURE.md) — genel bakış, emakerp'ten fark, riskler, faz planı
2. [DATABASE-ARCHITECTURE.md](./DATABASE-ARCHITECTURE.md)
3. [TENANT-ARCHITECTURE.md](./TENANT-ARCHITECTURE.md)
4. [ACCOUNTING-ENGINE.md](./ACCOUNTING-ENGINE.md) — 1. departman: Muhasebe (tamamlandı)
5. [MEVZUAT-MAP.md](./MEVZUAT-MAP.md)
6. [SECURITY-ARCHITECTURE.md](./SECURITY-ARCHITECTURE.md)
7. [API-ARCHITECTURE.md](./API-ARCHITECTURE.md)

**2. departman: IT (mimari fazı tamamlandı, kod Faz 3'ten itibaren):**

8. [IT-ARCHITECTURE.md](./IT-ARCHITECTURE.md)
9. [IT-DATABASE.md](./IT-DATABASE.md)
10. [CMDB.md](./CMDB.md)
11. [SERVICE-DESK.md](./SERVICE-DESK.md)
12. [FIELD-SERVICE.md](./FIELD-SERVICE.md)
13. [NETWORK.md](./NETWORK.md)
14. [IPAM.md](./IPAM.md)
15. [MONITORING.md](./MONITORING.md)
16. [MAINTENANCE.md](./MAINTENANCE.md)
17. [IT-SECURITY.md](./IT-SECURITY.md)
18. [IT-MEVZUAT.md](./IT-MEVZUAT.md)

## Yerel geliştirme

```bash
cd docker && docker compose up -d   # MySQL 8.4, 127.0.0.1:3307
cd .. && npm install
npm run dev
```

`.env.example` ve `docker/.env.example` dosyalarını kopyalayıp gerçek
değerlerle doldurun.

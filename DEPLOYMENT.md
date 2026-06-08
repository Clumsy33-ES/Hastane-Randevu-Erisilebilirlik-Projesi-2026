# Hospital Appointment System - Koyeb Deployment Guide

Bu rehber, FastAPI backend uygulamasının Koyeb üzerinde sorunsuz bir şekilde canlıya (production) alınması için gereken adımları içermektedir.

---

## 1. Hazırlıklar ve Gereksinimler

### GitHub Repository
* Kodlarınızı GitHub üzerinde bir repository'ye push edin. 
* Projede hassas verilerin (`.env`) gitmediğinden emin olun (Root ve backend dizinindeki `.gitignore` dosyaları `.env` dosyasını otomatik olarak yok sayacaktır).

### Neon PostgreSQL Veritabanı
1. [Neon.tech](https://neon.tech/) üzerinden ücretsiz bir PostgreSQL veritabanı oluşturun.
2. Size verilen bağlantı dizesini (Connection String) kopyalayın. Örn:
   `postgresql://neondb_owner:password@ep-cool-waterfall-1234.us-east-2.aws.neon.tech/neondb?sslmode=require`

---

## 2. Koyeb Üzerinde Dağıtım (Deployment) Adımları

1. **Koyeb Hesabı Oluşturun & Giriş Yapın:**
   [Koyeb Dashboard](https://app.koyeb.com/) adresine gidin.

2. **Yeni Uygulama (App) Oluşturun:**
   * **"Create Service"** butonuna tıklayın.
   * Dağıtım kaynağı olarak **GitHub** seçeneğini işaretleyin.
   * İlgili repository'nizi ve deploy etmek istediğiniz branch'i (örn. `main` veya `master`) seçin.

3. **Çalışma Dizini ve Yapılandırma Ayarları:**
   * **Root Directory:** Eğer tüm projeyi tek repoda tutuyorsanız ve backend'i deploy ediyorsanız root directory değerini `/backend` olarak ayarlayın. (Böylece Koyeb doğrudan backend dizinindeki `requirements.txt` ve `Procfile` dosyalarını okuyarak kurulum yapacaktır).

4. **Başlangıç Komutu (Start Command):**
   * Koyeb Procfile'ı otomatik algılayacaktır. Manuel ayarlamak isterseniz:
     `uvicorn app.main:app --host 0.0.0.0 --port 8000` veya Koyeb'in atadığı port değişkeniyle:
     `uvicorn app.main:app --host 0.0.0.0 --port ${PORT}`

5. **Çevre Değişkenleri (Environment Variables):**
   Aşağıdaki değişkenleri Koyeb Service ayarlarındaki **"Environment Variables"** sekmesinden ekleyin:

   | Değişken Adı | Açıklama | Değer (Örnek) |
   | :--- | :--- | :--- |
   | `DATABASE_URL` | Neon PostgreSQL bağlantı URL'si | `postgresql://neondb_owner:pass@ep-cool.neon.tech/neondb?sslmode=require` |
   | `SECRET_KEY` | JWT şifreleme anahtarı (Rastgele uzun bir string) | `SüperGizliGüvenliAnahtar123!...` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | Token geçerlilik süresi | `10080` (7 Gün) |
   | `CORS_ORIGINS` | İzinli frontend originleri (Vercel adresi vb.) | `https://hastane-randevu-frontend.vercel.app` |

6. **Deploy:**
   * **"Deploy"** butonuna tıklayın. Koyeb projeyi build edecek ve otomatik olarak canlıya alacaktır.

---

## 3. Dağıtım Sonrası Doğrulama ve Testler

Uygulamanız canlıya alındığında Koyeb size bir subdomain verecektir (Örn: `https://my-fastapi-app-user.koyeb.app`). Aşağıdaki endpoint'leri test edin:

### A. Health Endpoint Testi
* Tarayıcıdan veya Postman ile `GET https://<koyeb-app-domain>/health` isteği atın.
* **Beklenen Yanıt:**
  ```json
  {
    "status": "healthy"
  }
  ```

### B. Swagger API Dokümantasyon Testi
* `https://<koyeb-app-domain>/docs` adresine gidin.
* Sayfa açıldığında sağ üstteki **Authorize** butonuna tıklayıp JWT token testi yapın:
  1. `/auth/login` endpoint'ine geçerli TC ve şifre ile POST atıp token alın.
  2. Alınan token değerini Authorize modalına yapıştırın (`Bearer <token>`).
  3. Korumalı `/appointments/active` veya `/family-physician/me` endpoint'lerine istek atarak 200 yanıtı aldığınızı doğrulayın.

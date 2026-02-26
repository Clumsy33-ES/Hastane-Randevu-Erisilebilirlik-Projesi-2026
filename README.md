# Hastane-Randevu-Erisilebilirlik-Projesi-2026

# Accessible Health App (Web + Mobile)

A web and mobile **hospital appointment booking** project designed with **accessibility-first** principles for users with visual impairments and older adults.

## 🎯 Goal
This project aims to make the appointment process easier and more inclusive by combining:
- **Accessible UI/UX** (keyboard navigation, screen reader compatibility, clear focus states)
- An optional **Accessibility Copilot** feature that provides **short voice guidance** and **step-by-step form help**.

## ✅ Core Features
- Doctor selection screen  
- Date & time selection  
- Appointment creation form  
- Confirmation screen  
- Full keyboard navigation on web  
- Mobile compatibility with **TalkBack / VoiceOver**  
- Accessible form validation and error announcements

## 🧠 Accessibility Copilot (Optional)
When enabled, the app can generate:
- A short voice summary of the current screen (e.g., “You can select doctor, choose date, and confirm appointment.”)
- Step-by-step guidance for filling forms
- Clear voice feedback for missing/invalid fields

## 🧩 Technical Approach (High Level)
UI events (focus, click, form errors) → converted into a simple state model → transformed into guidance text → delivered as voice output (TTS).

## 🛠️ Tech Stack (Planned)
- **Web:** (to be decided) React / HTML-CSS-JS  
- **Mobile:** Flutter  
- **AI (Copilot):** LLM API (optional)  
- **Text-to-Speech:** Web Speech API (web) / TTS package (mobile)
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Erişilebilir Hastane Randevu Uygulaması (Web + Mobil)

Bu proje, görme engelli bireyler ve yaşlı kullanıcılar için tasarlanmış, **erişilebilirlik odaklı** bir hastane randevu oluşturma web ve mobil uygulamasıdır.

## 🎯 Projenin Amacı
Bu uygulamanın amacı, randevu alma sürecini herkes için daha erişilebilir hale getirmektir. Sistem:

- Klavye ile tam gezinme desteği sağlar  
- Ekran okuyucularla uyumlu çalışır  
- Net odak (focus) göstergeleri sunar  
- Form hatalarını erişilebilir şekilde bildirir  
- İsteğe bağlı “Akıllı Rehber” özelliği ile sesli yönlendirme yapar  

## ✅ Temel Özellikler
- Doktor seçme ekranı  
- Tarih ve saat seçimi  
- Randevu oluşturma formu  
- Onay ekranı  
- Web tarafında tam klavye navigasyonu  
- Mobilde TalkBack / VoiceOver uyumu  
- Erişilebilir form doğrulama ve hata bildirimi  

## 🧠 Akıllı Rehber (Opsiyonel Özellik)
Bu özellik aktif olduğunda sistem:

- Açılan ekranın kısa bir özetini sunar  
- Form doldurma sürecini adım adım açıklar  
- Eksik veya hatalı alanları sesli olarak belirtir  

Amaç, klasik ekran okuyucuların yerini almak değil;  
kullanıcıya görev odaklı ve sade bir yönlendirme sunmaktır.

## 🧩 Teknik Yaklaşım (Özet)
Arayüz olayları (focus, tıklama, form hatası) →  
durum modeline dönüştürülür →  
rehber metni oluşturulur →  
metin sesli çıktı (TTS) olarak kullanıcıya iletilir.

## 🛠️ Planlanan Teknolojiler
- **Web:** HTML, CSS, JavaScript (veya React)  
- **Mobil:** Flutter  
- **Akıllı Rehber:** LLM API (opsiyonel)  
- **Sesli Okuma:** Web Speech API (web) / TTS paketi (mobil)

## 📌 Not
Bu proje bir ekran okuyucu geliştirme çalışması değildir.  
Amaç, erişilebilir arayüz tasarımı ile kullanıcı deneyimini iyileştirmek ve ek sesli rehberlik sunmaktır.

## 📌 Note
This project does **not** replace system screen readers.  
It adds an extra layer of **task-focused guidance** to support users who need simpler, faster orientation while navigating.

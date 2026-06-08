import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAccessibility } from "../contexts/AccessibilityContext";

function RegisterPage() {
  const [formData, setFormData] = useState({
    tc_no: "",
    full_name: "",
    password: "",
    phone: "",
    birth_date: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const {
    speak, announce,
    isLargeText, toggleLargeText,
    isHighContrast, toggleHighContrast,
    isAudioGuide, toggleAudioGuide
  } = useAccessibility();

  useEffect(() => {
    setTimeout(() => {
      speak(
        "Kayıt sayfasına hoş geldiniz. Yeni bir hesap oluşturmak için formu doldurun.",
        { priority: 2, force: true, type: 'info' }
      );
    }, 500);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/register", formData);
      if (res.data.success) {
        announce("Kayıt başarılı. Giriş yapabilirsiniz.", "polite");
        navigate("/login");
      }
    } catch (err) {
      console.error("Register error:", err);
      const msg = err.response?.data?.detail || "Kayıt sırasında hata oluştu. Lütfen bilgilerinizi kontrol ediniz.";
      setError(msg);
      announce(msg, "assertive");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>🏥 MHRS+</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`header-acc-btn${isLargeText ? ' active' : ''}`}
            onClick={toggleLargeText}
            aria-label={isLargeText ? 'Büyük yazı kapat' : 'Büyük yazı aç'}
          >
            A+ Büyük Yazı
          </button>
          <button
            className={`header-acc-btn${isAudioGuide ? ' active' : ''}`}
            onClick={toggleAudioGuide}
            aria-label={isAudioGuide ? 'Sesli rehberi kapat' : 'Sesli rehberi başlat'}
          >
            {isAudioGuide ? '🔊 Sesli Açık' : '🔇 Sesli Okuma'}
          </button>
          <button
            className={`header-acc-btn${isHighContrast ? ' active' : ''}`}
            onClick={toggleHighContrast}
            aria-label={isHighContrast ? 'Yüksek kontrastı kapat' : 'Yüksek kontrastı aç'}
          >
            ◐ Kontrast
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,480px) minmax(0,380px)',
          gap: '40px',
          width: '100%',
          maxWidth: '920px',
          alignItems: 'center'
        }}>

          {/* ── Left: Register Card ── */}
          <div className="card" style={{ margin: 0 }}>
            {/* Card header */}
            <div style={{ marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
              <h1 style={{ marginBottom: '6px' }}>Kayıt Ol</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
                Hastanelerden randevu alabilmek için bir hesap oluşturun.
              </p>
            </div>

            {error && (
              <div className="alert-error" role="alert" aria-live="assertive">{error}</div>
            )}

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label htmlFor="tcInput">TC Kimlik No</label>
                <input
                  id="tcInput"
                  name="tc_no"
                  type="text"
                  value={formData.tc_no}
                  onChange={handleChange}
                  placeholder="11 haneli TC kimlik numarası"
                  aria-label="TC Kimlik Numarası"
                  data-speech="TC Kimlik numaranızı girmek için on bir haneli rakam tuşlayın."
                  maxLength={11}
                  required
                />
              </div>
              <div>
                <label htmlFor="nameInput">Ad Soyad</label>
                <input
                  id="nameInput"
                  name="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Adınızı ve soyadınızı girin"
                  aria-label="Ad Soyad"
                  data-speech="Adınızı ve soyadınızı girin."
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="phoneInput">Telefon</label>
                  <input
                    id="phoneInput"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="05xxxxxxxxx"
                    aria-label="Telefon"
                    data-speech="Telefon numaranızı girin."
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="birthDateInput">Doğum Tarihi</label>
                  <input
                    id="birthDateInput"
                    name="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={handleChange}
                    aria-label="Doğum Tarihi"
                    data-speech="Doğum tarihinizi seçin."
                  />
                </div>
              </div>
              <div>
                <label htmlFor="passwordInput">Şifre</label>
                <input
                  id="passwordInput"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Şifrenizi belirleyin"
                  aria-label="Şifre"
                  data-speech="Sisteme girmek için kullanacağınız şifrenizi belirleyin."
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="submit"
                  className="btn-large btn-primary"
                  disabled={loading}
                  data-speech="Kayıt işlemini tamamlamak için Enter tuşuna basın."
                  style={{ flex: 1 }}
                >
                  {loading ? 'Kayıt Yapılıyor…' : 'Kayıt Ol'}
                </button>
                <button
                  type="button"
                  className="btn-large btn-ghost"
                  onClick={() => navigate('/login')}
                  style={{ border: '1.5px solid var(--border)', flex: 1 }}
                  data-speech="İptal. Giriş sayfasına dönmek için Enter tuşuna basın."
                >
                  İptal / Giriş
                </button>
              </div>
            </form>
          </div>

          {/* ── Right: Info panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{
              margin: 0,
              textAlign: 'center',
              padding: '40px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{ fontSize: '4.5rem', lineHeight: 1 }} aria-hidden="true">📋</div>
              <h2 style={{ fontSize: '1.2rem' }}>Hızlı ve Güvenli</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                Kişisel verileriniz güvenle korunmaktadır. Bilgilerinizi doğru girerek sağlık hizmetlerine hızla erişin.
              </p>
            </div>
          </div>

        </div>
      </div>
      
      <style>{`
        @media (max-width: 680px) {
          .login-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

export default RegisterPage;

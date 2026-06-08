import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAccessibility } from "../contexts/AccessibilityContext";

function LoginPage() {
  const [tc, setTc]           = useState("11111111111");
  const [password, setPassword] = useState("1234");
  const [error, setError]     = useState("");
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
        "Hastane randevu sistemine hoş geldiniz. Sesli asistanı açmak için sesli okuma butonuna basın.",
        { priority: 2, force: true, type: 'info' }
      );
    }, 500);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/login", { tc, password });
      const data = res.data;
      
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.access_token);
        announce("Giriş başarılı. Ana ekrana yönlendiriliyorsunuz.", "polite");
        navigate("/dashboard");
      } else {
        const msg = data.detail || "Giriş başarısız.";
        setError(msg);
        announce(msg + " Lütfen bilgilerinizi kontrol ediniz.", "assertive");
      }
    } catch (err) {
      console.error("Login error:", err);
      const msg = err.response?.data?.detail || "Giriş yapılamadı. Bilgilerinizi kontrol edin.";
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

          {/* ── Left: Login Card ── */}
          <div className="card" style={{ margin: 0 }}>
            {/* Card header */}
            <div style={{ marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
              <h1 style={{ marginBottom: '6px' }}>Giriş Yap</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
                TC kimlik numaranızı ve şifrenizi girin.
              </p>
            </div>

            {error && (
              <div className="alert-error" role="alert" aria-live="assertive">{error}</div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label htmlFor="tcInput">TC Kimlik No</label>
                <input
                  id="tcInput"
                  type="text"
                  value={tc}
                  onChange={(e) => setTc(e.target.value)}
                  placeholder="11 haneli TC kimlik numarası"
                  aria-label="TC Kimlik Numarası"
                  data-speech="TC Kimlik numaranızı girmek için on bir haneli rakam tuşlayın."
                  maxLength={11}
                  required
                />
              </div>
              <div>
                <label htmlFor="passwordInput">Şifre</label>
                <input
                  id="passwordInput"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi girin"
                  aria-label="Şifre"
                  data-speech="Şifrenizi girmek için tuşlama yapın."
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <button
                  type="submit"
                  className="btn-large btn-primary"
                  disabled={loading}
                  data-speech="Giriş Yap. Sisteme bağlanmak için Enter tuşuna basın."
                >
                  {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
                </button>
                <button
                  type="button"
                  className="btn-large btn-ghost"
                  onClick={() => navigate('/register')}
                  style={{ border: '1.5px solid var(--border)' }}
                  data-speech="Kayıt Ol. Yeni hesap oluşturmak için Enter tuşuna basın."
                >
                  Kayıt Ol
                </button>
              </div>
            </form>
          </div>

          {/* ── Right: Info panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Illustration card */}
            <div className="card" style={{
              margin: 0,
              textAlign: 'center',
              padding: '40px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{ fontSize: '4.5rem', lineHeight: 1 }} aria-hidden="true">🏥</div>
              <h2 style={{ fontSize: '1.2rem' }}>Sağlıklı Günler</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                Türkiye genelinde hastane randevusu almanın en kolay yolu.
              </p>
            </div>

            {/* Guide */}
            <div className="guide-bar">
              <span>💡</span>
              <div>
                <strong>Akıllı Rehber:</strong>{' '}
                TC kimlik numaranızı ve şifrenizi girerek giriş yapabilirsiniz.
                Sesli rehber için üstteki butona basın.
              </div>
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

export default LoginPage;

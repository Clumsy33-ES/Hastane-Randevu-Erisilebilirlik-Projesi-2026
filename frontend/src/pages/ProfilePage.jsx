import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccessibility } from "../contexts/AccessibilityContext";

/* ─── Accessible Info Row ─── */
function InfoRow({ label, value }) {
  const speech = `${label}: ${value}`;
  return (
    <div
      className="info-row"
      tabIndex={0}
      role="group"
      aria-label={speech}
      data-speech={speech}
      data-speech-type="info"
    >
      <div className="info-row-label">{label}</div>
      <div className="info-row-value">{value}</div>
    </div>
  );
}

/* ─── CSS Toggle Switch ─── */
function ToggleSwitch({ id, label, sub, checked, onChange }) {
  const speech = `${label}: ${checked ? 'açık' : 'kapalı'}. Değiştirmek için Enter tuşuna basın.`;
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        {sub && <div className="toggle-sub">{sub}</div>}
      </div>
      <label
        className="toggle-switch"
        htmlFor={id}
        aria-label={speech}
        data-speech={speech}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange();
          }
        }}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          role="switch"
          aria-checked={checked}
          tabIndex={-1}   /* label is the tab stop */
        />
        <span className="toggle-track" />
      </label>
    </div>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const {
    speak,
    isLargeText,   toggleLargeText,
    isHighContrast, toggleHighContrast,
    isAudioGuide,  toggleAudioGuide
  } = useAccessibility();

  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { navigate("/login"); return; }
    setUser(JSON.parse(userData));
    speak(
      "Profil ve ayarlar ekranındasınız. TAB tuşu ile alanlara geçebilir, R tuşu ile tekrar dinleyebilirsiniz."
    );
  }, [navigate]);

  if (!user) return null;

  const maskedTc = user.tc
    ? `${user.tc.substring(0, 3)}*****${user.tc.substring(user.tc.length - 3)}`
    : "";

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: '900px' }}>

        {/* Page Header */}
        <div className="flex-between" style={{ marginBottom: '28px' }}>
          <div>
            <h1 style={{ marginBottom: '4px' }}>Profil ve Ayarlar</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
              Hesap bilgilerinizi görüntüleyin ve erişilebilirlik ayarlarınızı düzenleyin.
            </p>
          </div>
          <button
            type="button"
            className="btn-sm btn-ghost"
            onClick={() => navigate("/dashboard")}
            aria-label="Ana sayfaya dön"
            data-speech="Ana sayfaya dön"
          >
            ← Ana Sayfa
          </button>
        </div>

        {/* ── Keyboard shortcut guide ── */}
        <div className="guide-bar" style={{ marginBottom: '24px' }}>
          <span>⌨️</span>
          <span>
            <strong>Klavye kılavuzu:</strong>{' '}
            TAB ile alanlara geçin, <kbd style={{ background: '#e5e5e5', padding: '1px 5px', borderRadius: '4px', fontSize: '0.82rem' }}>R</kbd> tuşu ile odaklandığınız alanı tekrar dinleyin.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

          {/* ─── Card A: Profile Info ─── */}
          <div className="card" style={{ marginBottom: 0 }}>
            {/* Avatar row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              marginBottom: '20px', paddingBottom: '20px',
              borderBottom: '1px solid var(--border)'
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--surface-alt)', border: '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', fontWeight: 700, color: 'var(--secondary)',
                flexShrink: 0
              }} aria-hidden="true">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{user.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {user.role === 'patient' ? 'Hasta' : user.role}
                </div>
              </div>
            </div>

            <h2 style={{ fontSize: '1rem', marginBottom: '8px' }}>Profil Bilgileri</h2>

            {/* Accessible info rows */}
            <InfoRow label="Ad Soyad"      value={user.name} />
            <InfoRow label="TC Kimlik"     value={maskedTc} />
            <InfoRow label="Kullanıcı Tipi" value={user.role === 'patient' ? 'Hasta' : user.role} />

            <div style={{ marginTop: '24px' }}>
              <button
                type="button"
                className="btn-large btn-primary"
                onClick={handleLogout}
                aria-label="Çıkış yap. Sistemden çıkmak için Enter tuşuna basın."
                data-speech="Çıkış yap. Sistemden çıkmak için Enter tuşuna basın."
              >
                Çıkış Yap
              </button>
            </div>
          </div>

          {/* ─── Card B: Accessibility Settings ─── */}
          <div className="card" style={{ marginBottom: 0 }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '4px' }}>Erişilebilirlik Ayarları</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Uygulamanın görünümünü ve ses rehberini ihtiyacınıza göre ayarlayın.
            </p>

            <ToggleSwitch
              id="toggle-large-text"
              label="Büyük Yazı"
              sub="Tüm metinleri ve butonları büyütür"
              checked={isLargeText}
              onChange={toggleLargeText}
            />
            <ToggleSwitch
              id="toggle-audio"
              label="Otomatik Sesli Rehber"
              sub="TAB ile gezinirken sesli yönlendirme yapar"
              checked={isAudioGuide}
              onChange={toggleAudioGuide}
            />
            <ToggleSwitch
              id="toggle-contrast"
              label="Yüksek Kontrast"
              sub="Renk kontrastını artırarak okunabilirliği iyileştirir"
              checked={isHighContrast}
              onChange={toggleHighContrast}
            />

            <div style={{ marginTop: '24px' }}>
              <button
                type="button"
                className="btn-large btn-secondary"
                onClick={() => speak(
                  "Sesli rehber testi başarılı. Sesi duyabiliyorsanız sesli rehber çalışmaktadır.",
                  { priority: 3, force: true }
                )}
                aria-label="Sesli rehberi test et. Sesi duyup duymadığınızı kontrol etmek için Enter tuşuna basın."
                data-speech="Sesli rehberi test et. Sesi duyup duymadığınızı kontrol etmek için Enter tuşuna basın."
              >
                🔊 Sesli Rehberi Test Et
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ProfilePage;

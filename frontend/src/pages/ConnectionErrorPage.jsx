import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccessibility } from "../contexts/AccessibilityContext";

function ConnectionErrorPage() {
  const navigate = useNavigate();
  const { speak } = useAccessibility();

  useEffect(() => {
    speak("Bağlantı Hatası. Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.", { priority: 3, force: true });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px', color: '#d1d5db' }} aria-hidden="true">⚠️</div>
        <h1 style={{ fontSize: '2.5rem', color: '#9ca3af', marginBottom: '16px' }}>Bağlantı Hatası</h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '40px' }}>
          Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '280px', margin: '0 auto' }}>
          <button
            type="button"
            className="btn-large btn-secondary"
            onClick={() => navigate(0)}
            data-speech="Tekrar Dene. Sayfayı yenilemek için Enter tuşuna basın."
          >
            Tekrar Dene
          </button>
          <button
            type="button"
            className="btn-large btn-secondary"
            onClick={() => navigate("/dashboard")}
            data-speech="Ana Sayfaya Dön"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConnectionErrorPage;

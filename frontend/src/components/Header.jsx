import React, { useState } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { useNavigate } from 'react-router-dom';

function Header() {
  const {
    isLargeText, toggleLargeText,
    isHighContrast, toggleHighContrast,
    isAudioGuide, toggleAudioGuide
  } = useAccessibility();

  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="header-inner">

        {/* Logo */}
        <div
          className="header-logo"
          role="banner"
          aria-label="MHRS Plus - Hastane Randevu Sistemi Ana Sayfası"
          onClick={() => navigate('/dashboard')}
          style={{ cursor: 'pointer' }}
        >
          🏥 MHRS+
        </div>

        {/* Accessibility Controls */}
        <nav className="header-nav" aria-label="Erişilebilirlik seçenekleri">
          <button
            className={`header-acc-btn${isLargeText ? ' active' : ''}`}
            onClick={toggleLargeText}
            aria-pressed={isLargeText}
            aria-label={isLargeText ? 'Büyük yazı modu açık, kapatmak için tıklayın' : 'Büyük yazı modunu aç'}
            data-speech={isLargeText ? 'Büyük yazı modu kapatılıyor' : 'Büyük yazı modu açılıyor'}
          >
            A+ Büyük Yazı
          </button>
          <button
            className={`header-acc-btn${isAudioGuide ? ' active' : ''}`}
            onClick={toggleAudioGuide}
            aria-pressed={isAudioGuide}
            aria-label={isAudioGuide ? 'Sesli okuma açık, kapatmak için tıklayın' : 'Sesli okumayı başlat'}
          >
            {isAudioGuide ? '🔊 Sesli Açık' : '🔇 Sesli Okuma'}
          </button>
          <button
            className={`header-acc-btn${isHighContrast ? ' active' : ''}`}
            onClick={toggleHighContrast}
            aria-pressed={isHighContrast}
            aria-label={isHighContrast ? 'Yüksek kontrast açık, kapatmak için tıklayın' : 'Yüksek kontrastı aç'}
            data-speech={isHighContrast ? 'Yüksek kontrast kapatılıyor' : 'Yüksek kontrast açılıyor'}
          >
            ◐ Kontrast
          </button>
        </nav>

        {/* Profile */}
        {user && (
          <div className="header-profile">
            <button
              className="header-profile-btn"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label="Profil menüsü"
              aria-expanded={showProfileMenu}
              aria-haspopup="true"
              data-speech="Profil menüsü. Profil ayarlarına ve çıkış seçeneğine ulaşmak için Enter tuşuna basın."
              onKeyDown={(e) => { if (e.key === 'Escape') setShowProfileMenu(false); }}
            >
              <span className="header-profile-name">{user.name}</span>
              <div className="header-avatar" aria-hidden="true">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </button>

            {showProfileMenu && (
              <div
                className="profile-dropdown"
                role="menu"
                onKeyDown={(e) => { if (e.key === 'Escape') setShowProfileMenu(false); }}
              >
                <ul>
                  <li role="none">
                    <button
                      role="menuitem"
                      onClick={() => { setShowProfileMenu(false); navigate('/profile'); }}
                      data-speech="Profil bilgileri sayfasına git"
                    >
                      👤 Profil Bilgileri
                    </button>
                  </li>
                  {user.role === 'admin' && (
                    <li role="none">
                      <button
                        role="menuitem"
                        onClick={() => { setShowProfileMenu(false); navigate('/admin'); }}
                        data-speech="Admin paneline git"
                      >
                        ⚙️ Admin Paneli
                      </button>
                    </li>
                  )}
                  <div className="profile-dropdown-divider" />
                  <li role="none">
                    <button
                      role="menuitem"
                      className="danger"
                      onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                      data-speech="Sistemden çıkış yap"
                    >
                      Çıkış Yap
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}

      </div>
    </header>
  );
}

export default Header;

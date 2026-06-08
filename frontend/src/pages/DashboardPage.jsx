import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAccessibility } from "../contexts/AccessibilityContext";
import Modal from "../components/Modal";

function DashboardPage() {
  const [user, setUser] = useState(null);
  const [activeAppointments, setActiveAppointments] = useState([]);
  const [historyAppointments, setHistoryAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const navigate = useNavigate();
  const { speak, isLargeText, toggleLargeText, isHighContrast, toggleHighContrast, isAudioGuide, toggleAudioGuide } = useAccessibility();

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { navigate("/login"); return; }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchAppointments(parsedUser.tc);
    setTimeout(() => {
      speak("Ana ekrandasınız. Randevu almak için hastaneden randevu al seçeneğini kullanabilirsiniz.");
    }, 500);
  }, [navigate]);

  const fetchAppointments = async (tc) => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        apiClient.get(`/appointments/active`),
        apiClient.get(`/appointments/past`)
      ]);
      setActiveAppointments(activeRes.data);
      setHistoryAppointments(historyRes.data);
    } catch (err) {
      console.error("Randevular alınamadı:", err);
      // Optional: show error toast instead of redirecting to error page
      showToast("Randevular yüklenirken bir sorun oluştu.");
    }
  };


  if (!user) return (
    <div className="page-wrapper">
      <div className="loading-card">
        <h2>Yükleniyor...</h2>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="container">

        {/* Toast */}
        {toastMessage && (
          <div className="toast" role="alert" aria-live="assertive">{toastMessage}</div>
        )}

        {/* Guide bar */}
        <div className="guide-bar" aria-live="polite">
          <span>⌨️</span>
          <span>
            <strong>Rehber:</strong> TAB ile alanlara geçin.{' '}
            Sesli rehber açıksa <kbd style={{ background: '#e5e5e5', padding: '1px 5px', borderRadius: '4px', fontSize: '0.82rem' }}>R</kbd> tuşu ile odaklandığınız alanı tekrar dinleyin.
          </span>
        </div>

        {/* Main Grid: Actions | Appointments */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}
          className="dashboard-grid"
        >

          {/* Left: Action Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button
              className="action-card"
              onClick={() => {
                speak("Randevu türü seçimi açıldı", { priority: 3, type: 'info' });
                setIsTypeModalOpen(true);
              }}
              aria-label="Hastaneden randevu al. Randevu türü seçmek için Enter tuşuna basın."
              data-speech="Hastaneden randevu al. Randevu türü seçmek için Enter tuşuna basın."
            >
              <span className="action-icon">🏥</span>
              <div className="action-card-text">
                <span className="action-card-title">Hastaneden Randevu Al</span>
                <span className="action-card-sub">Genel veya uzman hekim</span>
              </div>
            </button>
            <button
              className="action-card"
              onClick={() => {
                speak("Aile hekimi işlemleri açıldı", { priority: 3, type: 'info' });
                setIsFamilyModalOpen(true);
              }}
              aria-label="Aile hekimi randevu işlemleri. Açmak için Enter tuşuna basın."
              data-speech="Aile hekimi randevu işlemleri. Açmak için Enter tuşuna basın."
            >
              <span className="action-icon">👨‍⚕️</span>
              <div className="action-card-text">
                <span className="action-card-title">Aile Hekimi</span>
                <span className="action-card-sub">Aile hekimi randevusu</span>
              </div>
            </button>
          </div>

          {/* Right: Appointments */}
          <div className="card-flat">
            {/* Tabs */}
            <div className="tab-bar" role="tablist">
              <button
                role="tab"
                className={`tab-btn${activeTab === 'active' ? ' active' : ''}`}
                aria-selected={activeTab === 'active'}
                onClick={() => { setActiveTab("active"); speak("Aktif randevularım gösteriliyor.", { priority: 3, type: 'info' }); }}
                data-speech="Aktif Randevularım sekmesi. Önümüzdeki randevuları görmek için tıklayın."
              >
                Aktif Randevularım
              </button>
              <button
                role="tab"
                className={`tab-btn${activeTab === 'history' ? ' active' : ''}`}
                aria-selected={activeTab === 'history'}
                onClick={() => { setActiveTab("history"); speak("Geçmiş randevularım gösteriliyor.", { priority: 3, type: 'info' }); }}
                data-speech="Geçmiş Randevularım sekmesi. Tamamlanan randevuları görmek için tıklayın."
              >
                Geçmiş Randevularım
              </button>
            </div>

            <div style={{ padding: '20px', minHeight: '260px' }}>
              {activeTab === "active" && (
                  activeAppointments.length === 0 ? (
                  <div className="empty-state" style={{ padding: '48px 24px', boxShadow: 'none', border: 'none' }} aria-live="polite">
                    <div className="empty-state-icon">📭</div>
                    <h3>Aktif randevu bulunamadı.</h3>
                    <p>Randevu almak için sol taraftaki seçeneği kullanın.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {activeAppointments.map(apt => (
                      <div key={apt.id} className="apt-row">
                        <div className="apt-row-info">
                          <div className="apt-title">{apt.doctor_name}</div>
                          <div className="apt-sub">{apt.hospital_name}</div>
                          <div className="apt-sub">{apt.date} — {apt.time}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span className="badge badge-active">Aktif Randevu</span>
                          <button
                            className="btn-sm btn-ghost"
                            onClick={() => navigate("/active-appointments")}
                            data-speech="Randevu detaylarını görünтüle"
                          >
                            Detayları Görüntüle
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {activeTab === "history" && (
                  historyAppointments.length === 0 ? (
                  <div className="empty-state" style={{ padding: '48px 24px', boxShadow: 'none', border: 'none' }} aria-live="polite">
                    <div className="empty-state-icon">📂</div>
                    <h3>Geçmiş randevu bulunamadı.</h3>
                    <p>Tamamlanan veya iptal edilen randevular burada görüntülenecektir.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {historyAppointments.map(apt => (
                      <div key={apt.id} className="apt-row" style={{ opacity: (apt.status === 'canceled' || apt.status === 'cancelled') ? 0.8 : 1 }}>
                        <div className="apt-row-info">
                          <div className="apt-title">{apt.doctor_name}</div>
                          <div className="apt-sub">{apt.hospital_name}</div>
                          <div className="apt-sub">{apt.date} — {apt.time}</div>
                        </div>
                        <span className={(apt.status === 'canceled' || apt.status === 'cancelled') ? 'badge badge-canceled' : 'badge badge-past'}>
                          {(apt.status === 'canceled' || apt.status === 'cancelled') ? 'İptal Edildi' : 'Geçmiş Randevu'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Randevu Türü Modal ===== */}
      <Modal isOpen={isTypeModalOpen} onClose={() => setIsTypeModalOpen(false)} title="Randevu türü seçiniz">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            className="btn-large btn-secondary"
            onClick={() => { setIsTypeModalOpen(false); navigate("/appointment-search"); }}
            data-speech="Genel Randevu. Hastaneden randevu almak için seçin."
          >
            Genel Randevu
          </button>
          <button
            type="button"
            className="btn-large btn-secondary"
            onClick={() => { setIsTypeModalOpen(false); navigate("/appointment-search", { state: { autoLocation: true } }); }}
            data-speech="Konuma göre hastane seçimi"
          >
            Konuma Göre Hastane
          </button>
        </div>
        <div className="acc-mini-bar" style={{ marginTop: '16px' }}>
          <button className={`acc-mini-btn${isLargeText ? ' active' : ''}`} onClick={toggleLargeText}>A+ Büyük Yazı</button>
          <button className={`acc-mini-btn${isAudioGuide ? ' active' : ''}`} onClick={toggleAudioGuide}>🔊 Sesli Okuma</button>
          <button className={`acc-mini-btn${isHighContrast ? ' active' : ''}`} onClick={toggleHighContrast}>◐ Kontrast</button>
        </div>
        <div className="guide-bar" style={{ margin: '0', borderRadius: '0 0 8px 8px', border: 'none', borderTop: '1px solid var(--border-color)' }}>
          <strong>Rehber:</strong> Lütfen randevu almak istediğiniz yöntemi seçiniz.
        </div>
      </Modal>

      {/* ===== Aile Hekimi Modal ===== */}
      <Modal isOpen={isFamilyModalOpen} onClose={() => setIsFamilyModalOpen(false)} title="Aile hekimi işlemleri">
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          Aile hekimi randevu sistemi ayrı bir portal üzerinden yönetilmektedir.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            className="btn-large btn-secondary"
            onClick={() => { setIsFamilyModalOpen(false); navigate("/family-physician-slots"); }}
            data-speech="Aile hekimi randevu al"
          >
            Randevu Al
          </button>
          <button
            type="button"
            className="btn-large btn-secondary"
            onClick={() => { setIsFamilyModalOpen(false); navigate("/active-appointments"); }}
            data-speech="Mevcut aktif randevularımı görüntüle"
          >
            Mevcut Randevularım
          </button>
        </div>
        <div className="acc-mini-bar" style={{ marginTop: '16px' }}>
          <button className={`acc-mini-btn${isLargeText ? ' active' : ''}`} onClick={toggleLargeText}>A+ Büyük Yazı</button>
          <button className={`acc-mini-btn${isAudioGuide ? ' active' : ''}`} onClick={toggleAudioGuide}>🔊 Sesli Okuma</button>
          <button className={`acc-mini-btn${isHighContrast ? ' active' : ''}`} onClick={toggleHighContrast}>◐ Kontrast</button>
        </div>
        <div className="guide-bar" style={{ margin: '0', borderRadius: '0 0 12px 12px', border: 'none', borderTop: '1px solid var(--border)' }}>
          <strong>Rehber:</strong> Aile hekiminizden randevu almak veya mevcut randevularınızı görmek için seçim yapınız.
        </div>
      </Modal>

      <style>{`
        @media (max-width: 860px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>

  );
}

export default DashboardPage;

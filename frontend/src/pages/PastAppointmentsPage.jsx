import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAccessibility } from "../contexts/AccessibilityContext";
import Modal from "../components/Modal";

function PastAppointmentsPage() {
  const navigate = useNavigate();
  const { speak, announce } = useAccessibility();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApt, setSelectedApt] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || '{}');

  useEffect(() => {
    if (!user.tc) { navigate("/login"); return; }
    speak("Geçmiş randevular ekranındasınız.");
    
    setLoading(true);
    apiClient.get(`/appointments/past`)
      .then(res => {
        setAppointments(res.data);
        setLoading(false);
        if (res.data.length === 0) announce("Geçmiş randevu bulunamadı.", "polite");
      })
      .catch(err => { 
        console.error("Past appointments load error:", err);
        setLoading(false);
      });
  }, [navigate]);


  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-card">
        <div className="loading-spinner"></div>
        <h2>Yükleniyor...</h2>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="container">

        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <h1 style={{ margin: 0 }}>Geçmiş Randevularım</h1>
          <button type="button" className="btn-sm btn-secondary" onClick={() => navigate("/dashboard")}
            data-speech="Ana sayfaya dön">
            Ana Sayfa
          </button>
        </div>

        {appointments.length === 0 ? (
          <div className="empty-state" aria-live="polite">
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📂</div>
            <h2>Geçmiş randevu bulunamadı.</h2>
            <p style={{ color: 'var(--text-muted)' }}>Tamamlanan veya iptal edilen randevular burada görüntülenecektir.</p>
            <p>Yeni bir randevu almak için aşağıdaki butonu kullanabilirsiniz.</p>
            <div style={{ maxWidth: '240px', margin: '20px auto 0' }}>
              <button type="button" className="btn-large btn-secondary"
                onClick={() => navigate("/appointment-search")}
                data-speech="Yeni randevu al">
                Randevu Al
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {appointments.map(apt => (
              <div
                key={apt.id}
                className="apt-row"
                tabIndex={0}
                role="button"
                style={{ opacity: (apt.status === 'canceled' || apt.status === 'cancelled') ? 0.75 : 1 }}
                aria-label={`Geçmiş randevu: ${apt.date} ${apt.time}, ${apt.doctor_name}. Durum: ${(apt.status === 'canceled' || apt.status === 'cancelled') ? 'İptal Edildi' : 'Tamamlandı'}`}
                data-speech={`${apt.date} ${apt.time} tarihli, ${apt.doctor_name} randevunuz. Durum: ${(apt.status === 'canceled' || apt.status === 'cancelled') ? 'İptal Edildi' : 'Tamamlandı'}. Detaylar için Enter tuşuna basın.`}
                onClick={() => { setSelectedApt(apt); setDetailModalOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedApt(apt); setDetailModalOpen(true); } }}
              >
                <div className="apt-row-info">
                  <div className="apt-title">{apt.doctor_name}</div>
                  <div className="apt-sub">{apt.hospital_name}</div>
                  <div className="apt-sub">{apt.date} — {apt.time}</div>
                </div>
                <span className={(apt.status === 'canceled' || apt.status === 'cancelled') ? 'badge badge-canceled' : 'badge badge-past'} style={{ flexShrink: 0 }}>
                  {(apt.status === 'canceled' || apt.status === 'cancelled') ? 'İptal Edildi' : 'Tamamlandı'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {selectedApt && (
          <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Geçmiş Randevu">
            <table className="detail-table" style={{ marginBottom: '24px' }}>
              <tbody>
                <tr><td>Randevu Zamanı</td><td>{selectedApt.date} — {selectedApt.time}</td></tr>
                <tr><td>Hastane</td><td>{selectedApt.hospital_name}</td></tr>
                <tr><td>Poliklinik Adı</td><td>{selectedApt.branch_name}</td></tr>
                <tr><td>Hekim</td><td>{selectedApt.doctor_name}</td></tr>
                <tr><td>Randevu Sahibi</td><td>{user.name}</td></tr>
                <tr>
                  <td>Durum</td>
                  <td style={{ color: (selectedApt.status === 'canceled' || selectedApt.status === 'cancelled') ? 'var(--primary-color)' : '#166534', fontWeight: '600' }}>
                    {(selectedApt.status === 'canceled' || selectedApt.status === 'cancelled') ? 'İptal Edildi' : 'Tamamlandı'}
                  </td>
                </tr>
              </tbody>
            </table>
            <button type="button" className="btn-large btn-secondary" onClick={() => { setDetailModalOpen(false); navigate("/dashboard"); }}
              data-speech="Ana sayfaya dön">
              Ana Sayfa
            </button>
          </Modal>
        )}

      </div>
    </div>
  );
}

export default PastAppointmentsPage;

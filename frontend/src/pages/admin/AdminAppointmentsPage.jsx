import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAccessibility } from '../../contexts/AccessibilityContext';

function AdminAppointmentsPage() {
  const navigate = useNavigate();
  const { speak } = useAccessibility();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await apiClient.get('/admin/appointments?limit=200');
      const data = res.data;
      setAppointments(Array.isArray(data) ? data : []);
      setError(""); // clear previous errors if successful
    } catch (err) {
      console.error("Admin randevuları yüklenemedi:", err);
      console.error("Status:", err.response?.status);
      console.error("Data:", err.response?.data);
      setError("Veriler yüklenemedi.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    speak("Randevu listesi sayfası.");
    loadData();

    const handleFocus = () => {
      loadData(true);
    };
    
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []); // eslint-disable-line

  const handleCancel = async (id) => {
    if (!window.confirm("Bu randevuyu iptal etmek istediğinize emin misiniz?")) return;
    try {
      setCancellingId(id);
      await apiClient.patch(`/admin/appointments/${id}/cancel`);
      setAppointments(prev =>
        prev.map(item =>
          item.id === id
            ? { ...item, status: "cancelled" }
            : item
        )
      );
    } catch (err) {
      alert("Randevu iptal edilemedi.");
      console.error(err);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="admin-header" style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexDirection: 'row' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Randevu Listesi
              <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Yönetici</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1rem' }}>
              Sistem üzerinden alınan tüm güncel, geçmiş ve iptal edilen randevuları inceleyin. (Son 200 randevu gösteriliyor)
            </p>
          </div>
          <button type="button" className="btn-large btn-ghost" onClick={() => navigate("/admin")}>
            ← Geri Dön
          </button>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="card" style={{ margin: 0, padding: '24px', overflowX: 'auto', borderRadius: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          {loading ? (
            <div>Yükleniyor...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 8px' }}>ID</th>
                  <th style={{ padding: '12px 8px' }}>Tür</th>
                  <th style={{ padding: '12px 8px' }}>Hasta</th>
                  <th style={{ padding: '12px 8px' }}>TC Kimlik</th>
                  <th style={{ padding: '12px 8px' }}>Doktor</th>
                  <th style={{ padding: '12px 8px' }}>Hastane / Klinik</th>
                  <th style={{ padding: '12px 8px' }}>Branş</th>
                  <th style={{ padding: '12px 8px' }}>Tarih / Saat</th>
                  <th style={{ padding: '12px 8px' }}>Durum</th>
                  <th style={{ padding: '12px 8px' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px' }}>{a.id}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`badge ${a.type === 'Hastane' ? 'badge-hospital' : 'badge-fp'}`}>
                        {a.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{a.patient_name}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{a.patient_tc}</td>
                    <td style={{ padding: '12px 8px' }}>{a.doctor_name}</td>
                    <td style={{ padding: '12px 8px' }}>{a.hospital_name}</td>
                    <td style={{ padding: '12px 8px' }}>{a.branch_name}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{a.date} <br/><span style={{fontWeight: 400}}>{a.time}</span></td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`badge ${a.status === 'active' ? 'badge-active' : a.status === 'past' ? 'badge-hospital' : 'badge-danger'}`}>
                        {a.status === 'active' ? 'Aktif' : a.status === 'past' ? 'Geçmiş' : 'İptal'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {a.status === 'active' && (
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleCancel(a.id)}
                          disabled={cancellingId === a.id}
                        >
                          {cancellingId === a.id ? 'İptal ediliyor...' : 'İptal Et'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {appointments.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Hiç randevu kaydı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminAppointmentsPage;

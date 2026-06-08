import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import Modal from '../../components/Modal';

function AdminHospitalsPage() {
  const navigate = useNavigate();
  const { speak, announce } = useAccessibility();

  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "", city: "", district: "", address: "", latitude: "", longitude: ""
  });

  const loadHospitals = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/hospitals');
      setHospitals(res.data);
    } catch (err) {
      setError("Hastaneler yüklenemedi.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    speak("Hastane yönetimi sayfası.");
    loadHospitals();
  }, []); // eslint-disable-line

  const handleToggleActive = async (id) => {
    try {
      const res = await apiClient.patch(`/admin/hospitals/${id}/toggle-active`);
      setHospitals(prev => prev.map(h => h.id === id ? { ...h, is_active: res.data.is_active } : h));
      announce("Hastane durumu güncellendi", "polite");
    } catch {
      announce("Güncelleme başarısız", "assertive");
    }
  };

  const openModal = (hospital = null) => {
    if (hospital) {
      setEditingHospital(hospital);
      setFormData({
        name: hospital.name, city: hospital.city, district: hospital.district,
        address: hospital.address || "", 
        latitude: hospital.latitude || "", longitude: hospital.longitude || ""
      });
    } else {
      setEditingHospital(null);
      setFormData({ name: "", city: "", district: "", address: "", latitude: "", longitude: "" });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name, city: formData.city, district: formData.district,
        address: formData.address,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null
      };

      if (editingHospital) {
        await apiClient.put(`/admin/hospitals/${editingHospital.id}`, payload);
        announce("Hastane başarıyla güncellendi", "polite");
      } else {
        await apiClient.post('/admin/hospitals', payload);
        announce("Yeni hastane başarıyla eklendi", "polite");
      }
      setIsModalOpen(false);
      loadHospitals();
    } catch (err) {
      console.error(err);
      announce("İşlem sırasında hata oluştu", "assertive");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="admin-header" style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexDirection: 'row' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Hastane Yönetimi 
              <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Yönetici</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1rem' }}>
              Sistemdeki hastaneleri, klinikleri ve koordinatlarını detaylı olarak yönetin.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-large btn-confirm" onClick={() => openModal()} data-speech="Yeni hastane ekle">
              + Yeni Ekle
            </button>
            <button type="button" className="btn-large btn-ghost" onClick={() => navigate("/admin")}>
              ← Geri Dön
            </button>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="card" style={{ margin: 0, padding: '24px', overflowX: 'auto', borderRadius: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          {loading ? (
            <div>Yükleniyor...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 8px' }}>ID</th>
                  <th style={{ padding: '12px 8px' }}>Ad</th>
                  <th style={{ padding: '12px 8px' }}>İl</th>
                  <th style={{ padding: '12px 8px' }}>İlçe</th>
                  <th style={{ padding: '12px 8px' }}>Durum</th>
                  <th style={{ padding: '12px 8px' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {hospitals.map(h => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px' }}>{h.id}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{h.name}</td>
                    <td style={{ padding: '12px 8px' }}>{h.city}</td>
                    <td style={{ padding: '12px 8px' }}>{h.district}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`badge ${h.is_active ? 'badge-active' : 'badge-danger'}`}>
                        {h.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', display: 'flex', gap: '8px' }}>
                      <button className="btn-sm btn-secondary" onClick={() => openModal(h)}>Düzenle</button>
                      <button className={`btn-sm ${h.is_active ? 'btn-danger' : 'btn-confirm'}`} onClick={() => handleToggleActive(h.id)}>
                        {h.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingHospital ? "Hastane Düzenle" : "Yeni Hastane"}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label>Hastane Adı *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label>İl *</label>
                <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} required />
              </div>
              <div style={{ flex: 1 }}>
                <label>İlçe *</label>
                <input type="text" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} required />
              </div>
            </div>
            <div>
              <label>Adres</label>
              <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label>Enlem (Opsiyonel)</label>
                <input type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Boylam (Opsiyonel)</label>
                <input type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="submit" className="btn-large btn-confirm" style={{ flex: 1 }}>Kaydet</button>
              <button type="button" className="btn-large btn-ghost" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }}>İptal</button>
            </div>
          </form>
        </Modal>

      </div>
    </div>
  );
}

export default AdminHospitalsPage;

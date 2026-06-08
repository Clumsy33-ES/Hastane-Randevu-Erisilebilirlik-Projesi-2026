import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import Modal from '../../components/Modal';

function AdminDoctorsPage() {
  const navigate = useNavigate();
  const { speak, announce } = useAccessibility();

  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  
  const [formData, setFormData] = useState({
    full_name: "", title: "Dr.", hospital_id: "", branch_id: ""
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [docRes, hospRes, branchRes] = await Promise.all([
        apiClient.get('/admin/doctors?is_active=all'),
        apiClient.get('/hospitals'),
        apiClient.get('/branches')
      ]);
      setDoctors(docRes.data);
      setHospitals(hospRes.data);
      setBranches(branchRes.data);
    } catch {
      setError("Veriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    speak("Doktor yönetimi sayfası.");
    loadData();
  }, []); // eslint-disable-line

  const handleToggleActive = async (id) => {
    try {
      const res = await apiClient.patch(`/admin/doctors/${id}/toggle-active`);
      setDoctors(prev => prev.map(d => d.id === id ? { ...d, is_active: res.data.is_active } : d));
      announce("Doktor durumu güncellendi", "polite");
    } catch (err) {
      announce("Güncelleme başarısız", "assertive");
    }
  };

  const openModal = (doctor = null) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setFormData({
        full_name: doctor.full_name, title: doctor.title || "Dr.", 
        hospital_id: doctor.hospital_id, branch_id: doctor.branch_id
      });
    } else {
      setEditingDoctor(null);
      setFormData({ full_name: "", title: "Dr.", hospital_id: "", branch_id: "" });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        full_name: formData.full_name, title: formData.title,
        hospital_id: parseInt(formData.hospital_id), branch_id: parseInt(formData.branch_id)
      };

      if (editingDoctor) {
        await apiClient.put(`/admin/doctors/${editingDoctor.id}`, payload);
        announce("Doktor başarıyla güncellendi", "polite");
      } else {
        await apiClient.post('/admin/doctors', payload);
        announce("Yeni doktor başarıyla eklendi", "polite");
      }
      setIsModalOpen(false);
      loadData();
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
              Doktor Yönetimi
              <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Yönetici</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1rem' }}>
              Doktor profillerini, çalıştıkları hastaneleri ve atamalarını kapsamlıca yönetin.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-large btn-confirm" onClick={() => openModal()} data-speech="Yeni doktor ekle">
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
                  <th style={{ padding: '12px 8px' }}>Ad Soyad</th>
                  <th style={{ padding: '12px 8px' }}>Hastane</th>
                  <th style={{ padding: '12px 8px' }}>Branş</th>
                  <th style={{ padding: '12px 8px' }}>Durum</th>
                  <th style={{ padding: '12px 8px' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px' }}>{d.id}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{d.title} {d.full_name}</td>
                    <td style={{ padding: '12px 8px' }}>{d.hospital_name || "Bilinmiyor"}</td>
                    <td style={{ padding: '12px 8px' }}>{d.branch_name || "Bilinmiyor"}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`badge ${d.is_active ? 'badge-active' : 'badge-danger'}`}>
                        {d.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', display: 'flex', gap: '8px' }}>
                      <button className="btn-sm btn-secondary" onClick={() => openModal(d)}>Düzenle</button>
                      <button className={`btn-sm ${d.is_active ? 'btn-danger' : 'btn-confirm'}`} onClick={() => handleToggleActive(d.id)}>
                        {d.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingDoctor ? "Doktor Düzenle" : "Yeni Doktor"}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ width: '80px' }}>
                <label>Unvan</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
              </div>
              <div style={{ flex: 1 }}>
                <label>Ad Soyad *</label>
                <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} required />
              </div>
            </div>
            
            <div>
              <label>Hastane *</label>
              <select value={formData.hospital_id} onChange={e => setFormData({...formData, hospital_id: e.target.value})} required>
                <option value="">Seçiniz</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} - {h.city}/{h.district}</option>)}
              </select>
            </div>

            <div>
              <label>Branş *</label>
              <select value={formData.branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})} required>
                <option value="">Seçiniz</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
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

export default AdminDoctorsPage;

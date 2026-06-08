import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import Modal from '../../components/Modal';

function AdminBranchesPage() {
  const navigate = useNavigate();
  const { speak, announce } = useAccessibility();

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  
  const [formData, setFormData] = useState({ name: "" });

  const loadBranches = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/branches');
      setBranches(res.data);
    } catch {
      setError("Branşlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    speak("Branş yönetimi sayfası.");
    loadBranches();
  }, []); // eslint-disable-line

  const handleToggleActive = async (id) => {
    try {
      const res = await apiClient.patch(`/admin/branches/${id}/toggle-active`);
      setBranches(prev => prev.map(b => b.id === id ? { ...b, is_active: res.data.is_active } : b));
      announce("Branş durumu güncellendi", "polite");
    } catch (err) {
      announce("Güncelleme başarısız", "assertive");
    }
  };

  const openModal = (branch = null) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({ name: branch.name });
    } else {
      setEditingBranch(null);
      setFormData({ name: "" });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { name: formData.name };

      if (editingBranch) {
        await apiClient.put(`/admin/branches/${editingBranch.id}`, payload);
        announce("Branş başarıyla güncellendi", "polite");
      } else {
        await apiClient.post('/admin/branches', payload);
        announce("Yeni branş başarıyla eklendi", "polite");
      }
      setIsModalOpen(false);
      loadBranches();
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
              Branş Yönetimi
              <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Yönetici</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1rem' }}>
              Tıbbi branşları, uzmanlık alanlarını ve poliklinikleri merkezi olarak yönetin.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-large btn-confirm" onClick={() => openModal()} data-speech="Yeni branş ekle">
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
                  <th style={{ padding: '12px 8px' }}>Branş Adı</th>
                  <th style={{ padding: '12px 8px' }}>Durum</th>
                  <th style={{ padding: '12px 8px' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px' }}>{b.id}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{b.name}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`badge ${b.is_active ? 'badge-active' : 'badge-danger'}`}>
                        {b.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', display: 'flex', gap: '8px' }}>
                      <button className="btn-sm btn-secondary" onClick={() => openModal(b)}>Düzenle</button>
                      <button className={`btn-sm ${b.is_active ? 'btn-danger' : 'btn-confirm'}`} onClick={() => handleToggleActive(b.id)}>
                        {b.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBranch ? "Branş Düzenle" : "Yeni Branş"}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label>Branş Adı *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
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

export default AdminBranchesPage;

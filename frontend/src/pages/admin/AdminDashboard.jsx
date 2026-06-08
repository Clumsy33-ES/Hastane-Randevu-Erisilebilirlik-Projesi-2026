import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAccessibility } from '../../contexts/AccessibilityContext';

function AdminDashboard() {
  const navigate = useNavigate();
  const { speak } = useAccessibility();

  const [stats, setStats] = useState({
    hospitals: 0,
    branches: 0,
    doctors: 0,
    appointments: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    speak("Admin Yönetim Paneline hoş geldiniz. Kapsamlı özet ve modüller listelenmektedir.");
    
    // Fetch stats
    apiClient.get('/admin/stats')
      .then(res => {
        setStats({
          hospitals: res.data.total_hospitals,
          branches: res.data.total_branches,
          doctors: res.data.total_doctors,
          appointments: res.data.active_appointments
        });
        setLoading(false);
      })
      .catch(err => {
        console.error("Stats fetch error", err);
        setError("Veri alınamadı");
        setLoading(false);
      });
  }, [speak]);

  return (
    <div className="page-wrapper">
      <style>
        {`
          .admin-dashboard-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(300px, 1fr));
            gap: 24px;
            margin-top: 32px;
          }
          .admin-stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-top: 24px;
          }
          .admin-stat-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.04);
          }
          .admin-stat-card h3 {
            margin: 0;
            font-size: 0.9rem;
            color: var(--text-muted);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .admin-stat-card .val {
            font-size: 2.2rem;
            font-weight: 800;
            color: var(--primary);
            margin-top: 8px;
          }
          .admin-module-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 28px 24px;
            text-align: left;
            cursor: pointer;
            box-shadow: 0 8px 30px rgba(0,0,0,0.05);
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            position: relative;
            overflow: hidden;
          }
          .admin-module-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            background: var(--primary);
            opacity: 0;
            transition: opacity 0.3s ease;
          }
          .admin-module-card:hover, .admin-module-card:focus {
            transform: translateY(-6px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.1);
            outline: none;
          }
          .admin-module-card:hover::before, .admin-module-card:focus::before {
            opacity: 1;
          }
          .admin-module-icon {
            font-size: 3rem;
            margin-bottom: 16px;
            background: var(--primary-light);
            width: 70px;
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 16px;
          }
          .admin-module-card h2 {
            margin: 0 0 8px 0;
            font-size: 1.4rem;
            color: var(--text);
            font-weight: 700;
          }
          .admin-module-card p {
            margin: 0;
            color: var(--text-muted);
            font-size: 0.95rem;
            line-height: 1.5;
          }
          
          /* Admin Pages Header styles to make them all consistent */
          .admin-header {
            margin-bottom: 32px;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
          }
          .admin-header h1 {
            margin: 0 0 8px 0;
            font-size: 2rem;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .admin-badge {
            background: var(--primary);
            color: #fff;
            font-size: 0.75rem;
            padding: 4px 10px;
            border-radius: 20px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
            vertical-align: middle;
          }

          @media (max-width: 1024px) {
            .admin-dashboard-grid { grid-template-columns: repeat(2, 1fr); }
            .admin-stats-grid { grid-template-columns: repeat(2, 1fr); }
          }
          @media (max-width: 768px) {
            .admin-dashboard-grid { grid-template-columns: 1fr; }
            .admin-stats-grid { grid-template-columns: 1fr; }
            .admin-header { flex-direction: column; gap: 16px; }
          }
        `}
      </style>

      <div className="container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        <div className="admin-header">
          <div>
            <h1>Admin Yönetim Paneli <span className="admin-badge">Yönetici</span></h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1rem' }}>
              Hastaneler, branşlar, doktorlar, slotlar ve randevuların merkezi yönetimi.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="admin-stats-grid">
          <div className="admin-stat-card" tabIndex={0}>
            <h3>Toplam Hastane</h3>
            <div className="val">{loading ? <span style={{fontSize:'1.2rem'}}>Yükleniyor...</span> : error ? <span style={{fontSize:'1rem', color:'red'}}>{error}</span> : stats.hospitals}</div>
          </div>
          <div className="admin-stat-card" tabIndex={0}>
            <h3>Toplam Branş</h3>
            <div className="val">{loading ? <span style={{fontSize:'1.2rem'}}>Yükleniyor...</span> : error ? <span style={{fontSize:'1rem', color:'red'}}>{error}</span> : stats.branches}</div>
          </div>
          <div className="admin-stat-card" tabIndex={0}>
            <h3>Toplam Doktor</h3>
            <div className="val">{loading ? <span style={{fontSize:'1.2rem'}}>Yükleniyor...</span> : error ? <span style={{fontSize:'1rem', color:'red'}}>{error}</span> : stats.doctors}</div>
          </div>
          <div className="admin-stat-card" tabIndex={0}>
            <h3>Aktif Randevu</h3>
            <div className="val">{loading ? <span style={{fontSize:'1.2rem'}}>Yükleniyor...</span> : error ? <span style={{fontSize:'1rem', color:'red'}}>{error}</span> : stats.appointments}</div>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="admin-dashboard-grid">
          <button className="admin-module-card" onClick={() => navigate('/admin/hospitals')} tabIndex={0} data-speech="Hastane Yönetimi. Hastane eklemek ve düzenlemek için tıklayın.">
            <div className="admin-module-icon">🏥</div>
            <h2>Hastane Yönetimi</h2>
            <p>Sistemdeki hastaneleri, klinikleri ve koordinatlarını detaylı olarak yönetin.</p>
          </button>
          
          <button className="admin-module-card" onClick={() => navigate('/admin/branches')} tabIndex={0} data-speech="Branş Yönetimi. Tıbbi branşları düzenlemek için tıklayın.">
            <div className="admin-module-icon">🩺</div>
            <h2>Branş Yönetimi</h2>
            <p>Tıbbi branşları, uzmanlık alanlarını ve poliklinikleri merkezi olarak yönetin.</p>
          </button>

          <button className="admin-module-card" onClick={() => navigate('/admin/doctors')} tabIndex={0} data-speech="Doktor Yönetimi. Doktor eklemek ve düzenlemek için tıklayın.">
            <div className="admin-module-icon">👨‍⚕️</div>
            <h2>Doktor Yönetimi</h2>
            <p>Doktor profillerini, çalıştıkları hastaneleri ve atamalarını kapsamlıca yönetin.</p>
          </button>

          <button className="admin-module-card" onClick={() => navigate('/admin/slots')} tabIndex={0} data-speech="Slot Yönetimi. Yeni randevu saatleri oluşturmak için tıklayın.">
            <div className="admin-module-icon">📅</div>
            <h2>Slot Yönetimi</h2>
            <p>Doktorlara randevu saatleri tanımlayın, kapasiteleri planlayın ve iptalleri kontrol edin.</p>
          </button>

          <button className="admin-module-card" onClick={() => navigate('/admin/appointments')} tabIndex={0} data-speech="Randevu Listesi. Tüm randevuları incelemek için tıklayın.">
            <div className="admin-module-icon">📋</div>
            <h2>Randevu Listesi</h2>
            <p>Sistem üzerinden alınan tüm güncel, geçmiş ve iptal edilen randevuları inceleyin.</p>
          </button>

          {/* 6. Kart: Kullanıcı Moduna Dön */}
          <button className="admin-module-card" onClick={() => navigate('/dashboard')} tabIndex={0} data-speech="Kullanıcı Paneline Dön. Normal sisteme dönmek için tıklayın." style={{ background: 'var(--surface-alt)' }}>
            <div className="admin-module-icon" style={{ background: 'transparent' }}>👋</div>
            <h2>Kullanıcı Paneli</h2>
            <p>Yönetim modundan çıkın ve standart hasta randevu arama arayüzüne geri dönün.</p>
          </button>
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;

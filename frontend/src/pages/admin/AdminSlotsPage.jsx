import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import Modal from '../../components/Modal';

function AdminSlotsPage() {
  const navigate = useNavigate();
  const { speak, announce } = useAccessibility();

  const [slots, setSlots] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [branches, setBranches] = useState([]);
  const [doctors, setDoctors] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedDoctorForDetails, setSelectedDoctorForDetails] = useState(null);
  
  // Filters for displaying cards
  const [filterHospital, setFilterHospital] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");

  // Filters for Adding New Slot
  const [addHospitalId, setAddHospitalId] = useState("");
  const [addBranchId, setAddBranchId] = useState("");
  const [addDoctorId, setAddDoctorId] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addTime, setAddTime] = useState("09:00");

  const filtersRef = React.useRef({ hospital: "", branch: "", doctor: "" });
  filtersRef.current = { hospital: filterHospital, branch: filterBranch, doctor: filterDoctor };

  const fetchSlots = async (hospitalId = "", branchId = "", doctorId = "") => {
    try {
      setLoading(true);
      const params = {};
      if (hospitalId) params.hospital_id = hospitalId;
      if (branchId) params.branch_id = branchId;
      if (doctorId) params.doctor_id = doctorId;

      const res = await apiClient.get('/admin/slots', { params });
      setSlots(res.data);
    } catch (err) {
      setError("Slotlar yüklenemedi.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleHospitalChange = (val) => {
    setFilterHospital(val);
    setFilterDoctor(""); // reset doctor filter
    fetchSlots(val, filterBranch, "");
  };

  const handleBranchChange = (val) => {
    setFilterBranch(val);
    setFilterDoctor(""); // reset doctor filter
    fetchSlots(filterHospital, val, "");
  };

  const handleDoctorChange = (val) => {
    setFilterDoctor(val);
    fetchSlots(filterHospital, filterBranch, val);
  };

  const loadData = async (useFilters = false) => {
    try {
      setLoading(true);
      const params = {};
      if (useFilters) {
        if (filtersRef.current.hospital) params.hospital_id = filtersRef.current.hospital;
        if (filtersRef.current.branch) params.branch_id = filtersRef.current.branch;
        if (filtersRef.current.doctor) params.doctor_id = filtersRef.current.doctor;
      }
      const [slotRes, docRes, hospRes, branchRes] = await Promise.all([
        apiClient.get('/admin/slots', { params }),
        apiClient.get('/admin/doctors?is_active=true'),
        apiClient.get('/admin/hospitals'),
        apiClient.get('/admin/branches')
      ]);
      setSlots(slotRes.data);
      setDoctors(docRes.data);
      setHospitals(hospRes.data.filter(h => h.is_active));
      setBranches(branchRes.data.filter(b => b.is_active));
    } catch (err) {
      setError("Veriler yüklenemedi.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    speak("Slot yönetimi sayfası.");
    loadData();
    
    const handleFocus = () => loadData(true);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []); // eslint-disable-line

  const handleToggleActive = async (id) => {
    try {
      const res = await apiClient.patch(`/admin/slots/${id}/toggle-active`);
      setSlots(prev => prev.map(s => s.id === id ? { ...s, is_active: res.data.is_active } : s));
      announce("Slot durumu güncellendi", "polite");
    } catch {
      announce("Güncelleme başarısız", "assertive");
    }
  };

  const openAddModal = () => {
    setAddHospitalId(filterHospital);
    setAddBranchId(filterBranch);
    setAddDoctorId(filterDoctor);
    setAddDate("");
    setAddTime("09:00");
    setIsModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addDoctorId) {
      alert("Lütfen bir doktor seçin.");
      return;
    }
    try {
      const payload = {
        doctor_id: parseInt(addDoctorId),
        date: addDate,
        time: addTime
      };

      await apiClient.post('/admin/slots', payload);
      announce("Yeni slot başarıyla eklendi", "polite");
      setIsModalOpen(false);
      fetchSlots(filterHospital, filterBranch, filterDoctor);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 400) {
        announce(err.response.data.detail || "Çakışan slot mevcut", "assertive");
        alert(err.response.data.detail);
      } else {
        announce("İşlem sırasında hata oluştu", "assertive");
      }
    }
  };

  // Group slots by doctor
  const doctorGroups = useMemo(() => {
    const groups = {};
    slots.forEach(slot => {
      const docName = slot.doctor_name || "Bilinmeyen Doktor";
      if (!groups[docName]) {
        groups[docName] = {
          doctor_name: docName,
          hospital_name: slot.hospital_name || "-",
          branch_name: slot.branch_name || "-",
          total: 0,
          booked: 0,
          available: 0,
          active: 0,
          slots: []
        };
      }
      groups[docName].slots.push(slot);
      groups[docName].total += 1;
      if (slot.is_booked) groups[docName].booked += 1;
      else groups[docName].available += 1;
      if (slot.is_active) groups[docName].active += 1;
    });
    return Object.values(groups);
  }, [slots]);

  // Apply filters to groups
  const filteredGroups = useMemo(() => {
    return doctorGroups;
  }, [doctorGroups]);

  // Group slots by date for the details modal
  const detailsGroupedByDate = useMemo(() => {
    if (!selectedDoctorForDetails) return {};
    const groups = {};
    selectedDoctorForDetails.slots.forEach(slot => {
      if (!groups[slot.date]) groups[slot.date] = [];
      groups[slot.date].push(slot);
    });
    // Sort dates
    const sortedGroups = {};
    Object.keys(groups).sort().forEach(date => {
      // Sort times within date
      sortedGroups[date] = groups[date].sort((a, b) => a.time.localeCompare(b.time));
    });
    return sortedGroups;
  }, [selectedDoctorForDetails]);

  // Filter doctors for the Add Modal
  const addModalDoctors = useMemo(() => {
    return doctors.filter(d => {
      if (addHospitalId && d.hospital_id.toString() !== addHospitalId) return false;
      if (addBranchId && d.branch_id.toString() !== addBranchId) return false;
      return true;
    });
  }, [doctors, addHospitalId, addBranchId]);

  // Filter doctors for the filter dropdown
  const filteredDoctorsForDropdown = useMemo(() => {
    return doctors.filter(d => {
      if (filterHospital && d.hospital_id.toString() !== filterHospital) return false;
      if (filterBranch && d.branch_id.toString() !== filterBranch) return false;
      return true;
    });
  }, [doctors, filterHospital, filterBranch]);


  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="admin-header" style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexDirection: 'row' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Slot Yönetimi
              <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Yönetici</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1rem' }}>
              Doktorlara randevu saatleri tanımlayın, kapasiteleri planlayın ve iptalleri kontrol edin.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-large btn-confirm" onClick={openAddModal} data-speech="Yeni slot ekle">
              + Yeni Ekle
            </button>
            <button type="button" className="btn-large btn-ghost" onClick={() => navigate("/admin")}>
              ← Geri Dön
            </button>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {/* Filters */}
        <div className="card" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label>Hastane Filtresi</label>
            <select value={filterHospital} onChange={e => handleHospitalChange(e.target.value)}>
              <option value="">Tümü</option>
              {hospitals.map(h => <option key={h.id} value={String(h.id)}>{h.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label>Branş Filtresi</label>
            <select value={filterBranch} onChange={e => handleBranchChange(e.target.value)}>
              <option value="">Tümü</option>
              {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label>Doktor Filtresi</label>
            <select value={filterDoctor} onChange={e => handleDoctorChange(e.target.value)}>
              <option value="">Tümü</option>
              {filteredDoctorsForDropdown.map((doctor) => (
                <option key={doctor.id} value={String(doctor.id)}>
                  {doctor.title ? doctor.title + " " : ""}
                  {doctor.full_name}
                  {" - "}
                  {doctor.hospital_name}
                  {" / "}
                  {doctor.branch_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filteredGroups.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>Filtrelere uygun slot kaydı bulunamadı.</p>
            )}
            {filteredGroups.map(g => (
              <div key={g.doctor_name} className="card" style={{ margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem' }}>{g.doctor_name}</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {g.hospital_name} <br/> {g.branch_name}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem' }}>
                  <div style={{ background: 'var(--surface-alt)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{g.total}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Toplam Slot</div>
                  </div>
                  <div style={{ background: 'var(--surface-alt)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary)' }}>{g.active}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Aktif Slot</div>
                  </div>
                  <div style={{ background: 'var(--surface-alt)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--success, #2e7d32)' }}>{g.available}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Boş</div>
                  </div>
                  <div style={{ background: 'var(--surface-alt)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--danger, #d32f2f)' }}>{g.booked}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Dolu</div>
                  </div>
                </div>

                <button 
                  className="btn-ghost" 
                  style={{ width: '100%', marginTop: 'auto', border: '1px solid var(--border)' }}
                  onClick={() => { setSelectedDoctorForDetails(g); setIsDetailsModalOpen(true); }}
                >
                  Detayları Gör
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Details Modal */}
        <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title={`${selectedDoctorForDetails?.doctor_name} - Slot Detayları`}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
            {selectedDoctorForDetails && Object.keys(detailsGroupedByDate).length > 0 ? (
              Object.keys(detailsGroupedByDate).map(date => (
                <div key={date} style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid var(--primary)', display: 'inline-block', paddingBottom: '4px' }}>
                    📅 {date}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {detailsGroupedByDate[date].map(slot => (
                      <div key={slot.id} style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                        background: 'var(--surface-alt)', padding: '12px 16px', borderRadius: '8px',
                        borderLeft: slot.is_active ? '4px solid var(--success, #2e7d32)' : '4px solid var(--text-muted)'
                      }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{slot.time}</div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span className={`badge ${slot.is_booked ? 'badge-danger' : 'badge-hospital'}`}>
                            {slot.is_booked ? 'Dolu' : 'Boş'}
                          </span>
                          <span className={`badge ${slot.is_active ? 'badge-active' : 'badge-danger'}`}>
                            {slot.is_active ? 'Aktif' : 'Pasif'}
                          </span>
                          <button 
                            className={`btn-sm ${slot.is_active ? 'btn-danger' : 'btn-confirm'}`} 
                            style={{ marginLeft: '8px' }}
                            onClick={() => {
                              handleToggleActive(slot.id);
                              // Update local details state to reflect change instantly in modal
                              setSelectedDoctorForDetails(prev => ({
                                ...prev,
                                slots: prev.slots.map(s => s.id === slot.id ? { ...s, is_active: !s.is_active } : s)
                              }));
                            }}
                          >
                            {slot.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p>Slot bulunamadı.</p>
            )}
          </div>
        </Modal>

        {/* Add Slot Modal */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Yeni Slot Ekle">
          <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label>Hastane</label>
                <select value={addHospitalId} onChange={e => setAddHospitalId(e.target.value)}>
                  <option value="">Tümü</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label>Branş</label>
                <select value={addBranchId} onChange={e => setAddBranchId(e.target.value)}>
                  <option value="">Tümü</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label>Doktor *</label>
              <select value={addDoctorId} onChange={e => setAddDoctorId(e.target.value)} required>
                <option value="">Seçiniz</option>
                {addModalDoctors.map(d => <option key={d.id} value={d.id}>{d.title} {d.full_name} ({d.hospital_name})</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label>Tarih *</label>
                <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} required min={new Date().toISOString().split("T")[0]} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Saat *</label>
                <select value={addTime} onChange={e => setAddTime(e.target.value)} required>
                  {["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
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

export default AdminSlotsPage;

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAccessibility } from "../contexts/AccessibilityContext";
import { useAppointment } from "../contexts/AppointmentContext";
import Modal from "../components/Modal";

function DoctorResultsPage() {
  const navigate = useNavigate();
  const { speak, announce } = useAccessibility();
  const { searchCriteria, selectedSlot, setSelectedSlot, selectedDoctorObj, setSelectedDoctorObj } = useAppointment();

  const [doctors, setDoctors] = useState([]);
  const [flexibleSlots, setFlexibleSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedDoctorId, setExpandedDoctorId] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const { hospital_id, branch_id, doctor_id, date } = searchCriteria;

  useEffect(() => {
    if (!hospital_id || !branch_id) {
      navigate("/appointment-search");
      return;
    }
    
    setLoading(true);
    setError("");

    // Mode Selection based on user requirements
    if (doctor_id && doctor_id !== "null" && doctor_id !== "undefined" && doctor_id !== "Fark etmez") {
      // MODE 1: Specific Doctor
      speak("Seçtiğiniz doktor için uygun randevu saatleri listeleniyor.");
      const params = { doctor_id };
      if (date) params.date = date;

      apiClient.get("/appointments/slots", { params })
        .then(res => {
          setFlexibleSlots(res.data);
          setLoading(false);
          if (res.data.length === 0) {
            announce("Aradığınız doktora ait uygun randevu bulunamadı.", "polite");
          } else {
            setExpandedDoctorId(res.data[0].doctor_id);
          }
        })
        .catch(err => {
          console.error("Doctor slots load error:", err);
          setError("Doktor randevuları yüklenirken hata oluştu.");
          setLoading(false);
        });
    } else {
      // MODE 2: Flexible (Hospital + Branch)
      speak("Hastanede seçtiğiniz branş için en yakın uygun randevular listeleniyor.");
      const params = { hospital_id, branch_id };
      if (date) params.date = date;

      apiClient.get("/appointments/slots", { params })
        .then(res => {
          setFlexibleSlots(res.data);
          setLoading(false);
          if (res.data.length === 0) {
            announce("Bu branşta uygun randevu bulunamadı.", "polite");
          } else {
            const uniqueDoctors = [...new Set(res.data.map(s => s.doctor_id))];
            if (uniqueDoctors.length === 1) {
              setExpandedDoctorId(uniqueDoctors[0]);
            }
          }
        })
        .catch(err => {
          console.error("Flexible slots load error:", err);
          setError("Uygun randevular yüklenirken hata oluştu.");
          setLoading(false);
        });
    }
  }, [hospital_id, branch_id, doctor_id, date, navigate]);


  const handleSlotSelect = (slot) => {
    // Map slot data to context
    setSelectedDoctorObj({
      id: slot.doctor_id,
      name: slot.doctor_name,
      full_name: slot.doctor_name,
      hospital_name: slot.hospital_name,
      branch_name: slot.branch_name,
      date: slot.date
    });
    setSelectedSlot(slot.time);
    setIsConfirmModalOpen(true);
    speak(`Randevu onayı. ${slot.date} ${slot.time} saati seçildi. Bilgileri kontrol edip onaylayabilirsiniz.`, { priority: 3, type: 'info' });
  };

  const confirmBooking = async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const displayDate = selectedDoctorObj?.date || date; // Fallback to slot's date if needed
    
    const bookingData = {
      doctor_id: selectedDoctorObj.id,
      doctor_name: selectedDoctorObj.name,
      date: displayDate,
      time: selectedSlot,
      hospital_id: parseInt(hospital_id),
      hospital_name: selectedDoctorObj.hospital_name,
      branch_id: parseInt(branch_id),
      branch_name: selectedDoctorObj.branch_name,
      patient_tc: user.tc,
      patient_name: user.name
    };

    try {
      const res = await apiClient.post("/appointments/book", bookingData);
      if (res.data.success) {
        setIsConfirmModalOpen(false);
        navigate("/appointment-success");
      } else {
        alert("Randevu alınamadı: " + (res.data.message || "Hata"));
      }
    } catch (err) {
      console.error("Booking error:", err);
      const detail = err.response?.data?.detail || "Sunucu hatası";
      alert("Hata: " + detail);
    }
  };

  // ===== Loading =====
  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-card">
        <div className="loading-spinner"></div>
        <h2>Yükleniyor...</h2>
        <p style={{ color: 'var(--text-muted)' }}>Uygun randevular aranıyor...</p>
      </div>
    </div>
  );

  // ===== Error =====
  if (error) return (
    <div className="page-wrapper">
      <div className="container">
        <div className="alert-error" style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Hata Oluştu</h2>
          <p>{error}</p>
          <button className="btn-large btn-secondary" onClick={() => navigate(0)}>Tekrar Dene</button>
        </div>
      </div>
    </div>
  );

  // ===== Grouping Slots by Doctor =====
  const groupedDoctorsMap = flexibleSlots.reduce((acc, slot) => {
    if (!acc[slot.doctor_id]) {
      acc[slot.doctor_id] = {
        id: slot.doctor_id,
        full_name: slot.doctor_name,
        hospital_name: slot.hospital_name,
        branch_name: slot.branch_name,
        slots: []
      };
    }
    acc[slot.doctor_id].slots.push(slot);
    return acc;
  }, {});

  const doctorsList = Object.values(groupedDoctorsMap);

  const handleDoctorClick = (doctorId) => {
    setExpandedDoctorId(prev => prev === doctorId ? null : doctorId);
  };

  // ===== Empty State =====
  const hasNoResults = flexibleSlots.length === 0;
  if (hasNoResults) return (
    <div className="page-wrapper">
      <div className="container">
        <div className="empty-state">
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
          <h2>Uygun randevu bulunamadı.</h2>
          <p>Aradığınız kriterlere uygun boş randevu saati kalmamış olabilir. Lütfen tarih seçimini değiştirmeyi veya diğer hastane/branşları kontrol etmeyi deneyin.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px', maxWidth: '300px', margin: '24px auto 0' }}>
            <button type="button" className="btn-large btn-confirm" onClick={() => navigate("/appointment-search")}>
              Geri Dön / Filtreleri Değiştir
            </button>
            <button type="button" className="btn-large btn-secondary" onClick={() => navigate("/dashboard")}>
              Ana Sayfa
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="container">

        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <h1 style={{ margin: 0 }}>{doctor_id ? "Doktor Randevuları" : "Uygun Randevular"}</h1>
          <button type="button" className="btn-sm btn-secondary" onClick={() => navigate("/appointment-search")}>← Geri</button>
        </div>

        {/* Unified Results Layout (Grouped by Doctor) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {doctorsList.map(doctor => (
            <div key={doctor.id}>
              <div
                className="doctor-card"
                tabIndex={0}
                role="button"
                aria-expanded={expandedDoctorId === doctor.id}
                aria-label={`Doktor ${doctor.full_name}. Saatleri görmek için Enter tuşuna basın.`}
                data-speech={`Doktor ${doctor.full_name}. Saatleri görmek için Enter tuşuna basın.`}
                onClick={() => handleDoctorClick(doctor.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDoctorClick(doctor.id); } }}
                style={{ cursor: 'pointer', marginBottom: expandedDoctorId === doctor.id ? '0' : '12px', borderRadius: expandedDoctorId === doctor.id ? '8px 8px 0 0' : '8px' }}
              >
                <div className="doctor-avatar" aria-hidden="true">👨‍⚕️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{doctor.full_name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{doctor.hospital_name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{doctor.branch_name}</div>
                </div>
                <div className="btn-sm btn-secondary">{expandedDoctorId === doctor.id ? 'Gizle ▲' : 'Saatleri Gör ▼'}</div>
              </div>

              {expandedDoctorId === doctor.id && (
                <div style={{ background: 'var(--surface-alt)', border: '1.5px solid var(--border)', borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '20px 24px', marginBottom: '12px' }}>
                  <h4 style={{ margin: '0 0 16px 0' }}>{date ? `${date} Tarihli` : "En Yakın"} Uygun Saatler</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {doctor.slots.map(s => (
                      <button 
                        key={s.id} 
                        type="button" 
                        className="slot-btn"
                        style={{ height: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '110px' }}
                        onClick={() => handleSlotSelect(s)}
                        data-speech={`${s.date} tarihinde saat ${s.time}. Seçmek için Enter.`}
                      >
                        <span style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '2px' }}>{s.date}</span>
                        <span style={{ fontWeight: '700' }}>{s.time}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Confirm Modal */}
        <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Randevu Onayı">
          <table className="detail-table" style={{ marginBottom: '24px' }}>
            <tbody>
              <tr><td>Randevu Zamanı</td><td>{selectedDoctorObj?.date || date} — {selectedSlot}</td></tr>
              <tr><td>Hastane</td><td>{selectedDoctorObj?.hospital_name}</td></tr>
              <tr><td>Poliklinik</td><td>{selectedDoctorObj?.branch_name}</td></tr>
              <tr><td>Hekim</td><td>{selectedDoctorObj?.name}</td></tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-large btn-confirm" onClick={confirmBooking}>Randevuyu Onayla</button>
            <button className="btn-large btn-secondary" onClick={() => setIsConfirmModalOpen(false)}>Vazgeç</button>
          </div>
        </Modal>

      </div>
    </div>
  );
}

export default DoctorResultsPage;

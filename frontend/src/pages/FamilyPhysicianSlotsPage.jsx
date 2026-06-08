import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAccessibility } from "../contexts/AccessibilityContext";
import Modal from "../components/Modal";

function FamilyPhysicianSlotsPage() {
  const [slots, setSlots]           = useState([]);
  const [fpInfo, setFpInfo]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [fpLoading, setFpLoading]   = useState(true);
  const [user, setUser]             = useState(null);
  const [toastMsg, setToastMsg]     = useState({ text: "", type: "error" });
  const [confirmModal, setConfirmModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking]       = useState(false);

  const navigate = useNavigate();
  const { speak, announce } = useAccessibility();

  /* ── Toast helper ── */
  const showToast = (text, type = "error") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: "", type: "error" }), 5000);
  };

  const [allFps, setAllFps] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedClinic, setSelectedClinic] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [assigning, setAssigning] = useState(false);

  /* ── Fetch family physician info ── */
  const fetchFpInfo = useCallback(async () => {
    setFpLoading(true);
    try {
      const res = await apiClient.get(`/family-physician/me`);
      if (res.data.has_family_physician) {
        setFpInfo(res.data);
      } else {
        setFpInfo(null);
        fetchFamilyPhysicians();
      }
    } catch (err) {
      showToast("Aile hekimi bilgileri yüklenirken hata oluştu.");
    } finally {
      setFpLoading(false);
    }
  }, []);

  const fetchFamilyPhysicians = async () => {
    try {
      const res = await apiClient.get("/family-physicians");
      setAllFps(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  /* ── Fetch available slots ── */
  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/family-physician/slots`);
      setSlots(res.data);
      if (res.data.length > 0) {
        speak(`${res.data.length} adet uygun randevu saati bulundu.`);
      } else {
        speak("Şu an için uygun randevu saati bulunamadı.");
      }
    } catch {
      showToast("Randevu saatleri yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── On mount ── */
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { navigate("/login"); return; }
    const parsed = JSON.parse(userData);
    setUser(parsed);
    speak("Aile hekimi randevu ekranındasınız.");
    fetchFpInfo();
    fetchSlots();
  }, [navigate, fetchFpInfo, fetchSlots]);

  /* ── Open confirmation modal ── */
  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setConfirmModal(true);
    speak(
      `${new Date(slot.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} ` +
      `tarihinde saat ${slot.time} seçildi. Onaylamak için Onayla butonuna basın.`,
      { priority: 3, force: true }
    );
  };

  /* ── Book appointment ── */
  const handleConfirmBook = async () => {
    if (!selectedSlot || !user || !fpInfo || booking) return;
    setBooking(true);
    try {
      const res = await apiClient.post("/family-physician/appointments", {
        user_id: user.id,
        family_physician_id: selectedSlot.family_physician_id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        slot_id: selectedSlot.id,
      });

      if (res.data.success) {
        /* ── Voice: success ── */
        speak("Aile hekimi randevunuz başarıyla oluşturuldu.", { priority: 3, force: true });
        announce("Aile hekimi randevunuz oluşturuldu.", "polite");

        /* ── Remove booked slot immediately from list ── */
        setSlots(prev => prev.filter(s => s.id !== selectedSlot.id));
        setConfirmModal(false);

        /* ── Navigate to success page with FP state ── */
        navigate("/appointment-success", {
          state: {
            type: "family_physician",
            appointment: {
              ...res.data.appointment,
              doctor_name: fpInfo.doctor_name,
              clinic_name: fpInfo.clinic_name,
              city: fpInfo.city,
              district: fpInfo.district,
            },
          },
        });
      }
    } catch (err) {
      setConfirmModal(false);
      const status = err.response?.status;
      const detail = err.response?.data?.detail || "";

      let msg = "Randevu oluşturulamadı. Lütfen tekrar deneyin.";
      if (status === 409 || detail.toLowerCase().includes("dolu")) {
        msg = "Bu saat zaten dolu. Lütfen başka bir saat seçin.";
      } else if (status === 404) {
        msg = "Seçilen randevu saati bulunamadı. Sayfa yenileniyor...";
        fetchSlots(user.id); // refresh
      } else if (status === 400) {
        msg = "Geçersiz randevu bilgisi. Lütfen sayfayı yenileyip tekrar deneyin.";
      } else if (status === 422) {
        msg = "Randevu verilerinde hata. Lütfen tekrar deneyin.";
      }
      showToast(msg, "error");
      speak(msg, { priority: 3, force: true });
    } finally {
      setBooking(false);
    }
  };

  /* ── Group slots by date ── */
  const groupedSlots = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  /* ── Assignment Handlers ── */
  const cities = [...new Set(allFps.map(fp => fp.city))];
  const districts = [...new Set(allFps.filter(fp => fp.city === selectedCity).map(fp => fp.district))];
  const clinics = [...new Set(allFps.filter(fp => fp.city === selectedCity && fp.district === selectedDistrict).map(fp => fp.clinic_name))];
  const doctors = allFps.filter(fp => fp.city === selectedCity && fp.district === selectedDistrict && fp.clinic_name === selectedClinic);

  const handleAssignFp = async (e) => {
    e.preventDefault();
    if (!selectedDoctor) return;
    setAssigning(true);
    try {
      const res = await apiClient.post("/family-physician/assign", {
        family_physician_id: parseInt(selectedDoctor)
      });
      if (res.data.success) {
        showToast("Aile hekimi başarıyla atandı", "success");
        speak("Aile hekimi başarıyla atandı", { priority: 3, force: true });
        fetchFpInfo();
        fetchSlots();
      }
    } catch (err) {
      showToast("Atama sırasında hata oluştu");
    } finally {
      setAssigning(false);
    }
  };

  const isPageLoading = loading || fpLoading;

  if (isPageLoading && slots.length === 0 && !fpInfo && allFps.length === 0) {
    return (
      <div className="page-wrapper">
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <h2>Yükleniyor...</h2>
          <p style={{ color: "var(--text-muted)" }}>Bilgiler alınıyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: "720px" }}>

        {/* Toast */}
        {toastMsg.text && (
          <div
            className={toastMsg.type === "error" ? "toast toast-error" : "toast toast-success"}
            role="alert"
            aria-live="assertive"
          >
            {toastMsg.text}
          </div>
        )}

        {/* ── Family Physician Info Card ── */}
        {fpInfo ? (
          <div className="card" style={{ marginBottom: "20px", padding: "0", overflow: "hidden" }}>
            <div style={{
              background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
              padding: "20px 24px",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: "16px"
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "1.6rem",
                flexShrink: 0
              }} aria-hidden="true">👨‍⚕️</div>
              <div>
                <div style={{ fontSize: "0.8rem", opacity: 0.85, marginBottom: "2px" }}>
                  Kayıtlı Aile Hekiminiz
                </div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{fpInfo.doctor_name}</div>
              </div>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 0,
              borderTop: "1px solid var(--border)"
            }}>
              {[
                { label: "ASM Adı", value: fpInfo.clinic_name, icon: "🏥" },
                { label: "Şehir", value: fpInfo.city, icon: "🌆" },
                { label: "İlçe", value: fpInfo.district, icon: "📍" },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{
                  padding: "14px 20px",
                  borderRight: "1px solid var(--border)"
                }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                    {icon} {label}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card-flat" style={{ marginBottom: "20px" }}>
            <div className="card-header" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ margin: 0 }}>Kayıtlı aile hekiminiz bulunmuyor</h2>
              <p style={{ color: "var(--text-muted)", margin: "6px 0 0 0", fontSize: "0.9rem" }}>
                Lütfen randevu alabilmek için aşağıdan bir Aile Hekimi seçip kaydedin.
              </p>
            </div>
            <div style={{ padding: "24px" }}>
              <form onSubmit={handleAssignFp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                <div className="form-group">
                  <label htmlFor="citySelect">İl Seçin</label>
                  <select 
                    id="citySelect" 
                    value={selectedCity} 
                    onChange={e => { setSelectedCity(e.target.value); setSelectedDistrict(""); setSelectedClinic(""); setSelectedDoctor(""); }}
                    className="input-field"
                    required
                  >
                    <option value="">Seçiniz...</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {selectedCity && (
                  <div className="form-group">
                    <label htmlFor="distSelect">İlçe Seçin</label>
                    <select 
                      id="distSelect" 
                      value={selectedDistrict} 
                      onChange={e => { setSelectedDistrict(e.target.value); setSelectedClinic(""); setSelectedDoctor(""); }}
                      className="input-field"
                      required
                    >
                      <option value="">Seçiniz...</option>
                      {districts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}

                {selectedDistrict && (
                  <div className="form-group">
                    <label htmlFor="clinicSelect">Aile Sağlığı Merkezi Seçin</label>
                    <select 
                      id="clinicSelect" 
                      value={selectedClinic} 
                      onChange={e => { setSelectedClinic(e.target.value); setSelectedDoctor(""); }}
                      className="input-field"
                      required
                    >
                      <option value="">Seçiniz...</option>
                      {clinics.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {selectedClinic && (
                  <div className="form-group">
                    <label htmlFor="doctorSelect">Aile Hekimi Seçin</label>
                    <select 
                      id="doctorSelect" 
                      value={selectedDoctor} 
                      onChange={e => setSelectedDoctor(e.target.value)}
                      className="input-field"
                      required
                    >
                      <option value="">Seçiniz...</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>{d.doctor_name}</option>)}
                    </select>
                  </div>
                )}

                <div style={{ marginTop: "10px" }}>
                  <button 
                    type="submit" 
                    className="btn-large btn-confirm" 
                    disabled={assigning || !selectedDoctor}
                    style={{ width: "100%" }}
                  >
                    {assigning ? "Kaydediliyor..." : "Aile Hekimini Kaydet"}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* ── Slots Card ── */}
        {fpInfo && (
          <div className="card-flat">
            <div className="card-header" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ margin: 0 }}>Uygun Randevu Saatleri</h2>
              <p style={{ color: "var(--text-muted)", margin: "6px 0 0 0", fontSize: "0.9rem" }}>
                Bir saat seçerek randevunuzu oluşturun.
              </p>
            </div>

            <div style={{ padding: "24px" }}>
              {slots.length === 0 ? (
                <div className="empty-state" style={{ boxShadow: "none", border: "none" }}>
                  <div className="empty-state-icon">📅</div>
                  <h3>Uygun randevu saati bulunamadı.</h3>
                  <p style={{ color: "var(--text-muted)" }}>
                    Tüm saatler dolu veya randevu dönemi henüz açılmamış olabilir.
                  </p>
                  <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
                    Ana Sayfaya Dön
                  </button>
                </div>
              ) : (
                Object.keys(groupedSlots).sort().map(date => {
                  const dateObj = new Date(date + "T00:00:00");
                  const dateText = dateObj.toLocaleDateString("tr-TR", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric"
                  });
                  const dateTextAria = dateObj.toLocaleDateString("tr-TR", {
                    weekday: "long", month: "long", day: "numeric"
                  });
                  return (
                    <div key={date} style={{ marginBottom: "28px" }}>
                      <h3
                        tabIndex={0}
                        role="heading"
                        aria-level={3}
                        aria-label={`${dateTextAria} günü için uygun saatler`}
                        data-speech={`${dateTextAria} günü için uygun saatler`}
                        style={{
                          borderLeft: "4px solid var(--primary)",
                          paddingLeft: "12px",
                          marginBottom: "14px",
                          fontSize: "1rem",
                          fontWeight: 700,
                          outline: "none"
                        }}
                      >
                        {dateText}
                      </h3>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                        gap: "10px"
                      }}>
                        {groupedSlots[date].map(slot => (
                          <button
                            key={slot.id}
                            className="btn-slot"
                            onClick={() => handleSlotClick(slot)}
                            aria-label={`${dateTextAria} saat ${slot.time} aile hekimi randevusu seç`}
                            data-speech={`${dateTextAria} saat ${slot.time} aile hekimi randevusunu seç`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="card-footer" style={{
              borderTop: "1px solid var(--border)",
              display: "flex", justifyContent: "flex-start"
            }}>
              <button
                className="btn-ghost"
                onClick={() => navigate("/dashboard")}
                data-speech="Vazgeç ve ana sayfaya dön"
              >
                ← Vazgeç ve Geri Dön
              </button>
            </div>
          </div>
        )}

        {/* ── Confirmation Modal ── */}
        <Modal
          isOpen={confirmModal}
          onClose={() => { if (!booking) setConfirmModal(false); }}
          title="Randevu Onayı"
        >
          {selectedSlot && fpInfo && (
            <>
              <table className="detail-table" style={{ marginBottom: "24px" }}>
                <tbody>
                  <tr><td>Hekim</td><td style={{ fontWeight: 600 }}>{fpInfo.doctor_name}</td></tr>
                  <tr><td>ASM</td><td>{fpInfo.clinic_name}</td></tr>
                  <tr><td>Şehir / İlçe</td><td>{fpInfo.city} — {fpInfo.district}</td></tr>
                  <tr>
                    <td>Randevu Tarihi</td>
                    <td style={{ fontWeight: 600 }}>
                      {new Date(selectedSlot.date + "T00:00:00").toLocaleDateString("tr-TR", {
                        weekday: "long", day: "numeric", month: "long", year: "numeric"
                      })}
                    </td>
                  </tr>
                  <tr>
                    <td>Randevu Saati</td>
                    <td style={{ fontWeight: 600, fontSize: "1.1rem", color: "var(--primary)" }}>
                      {selectedSlot.time}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  className="btn-large btn-confirm"
                  onClick={handleConfirmBook}
                  disabled={booking}
                  data-speech="Randevuyu onayla"
                >
                  {booking ? "Oluşturuluyor..." : "✓ Randevuyu Onayla"}
                </button>
                <button
                  type="button"
                  className="btn-large btn-secondary"
                  onClick={() => setConfirmModal(false)}
                  disabled={booking}
                  data-speech="Vazgeç"
                >
                  Vazgeç
                </button>
              </div>
            </>
          )}
        </Modal>

      </div>
    </div>
  );
}

export default FamilyPhysicianSlotsPage;

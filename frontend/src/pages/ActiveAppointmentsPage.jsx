import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAccessibility } from "../contexts/AccessibilityContext";
import Modal from "../components/Modal";

/* ── Helpers ── */
function formatDate(isoDate) {
  if (!isoDate) return "Bilgi yok";
  try {
    const [y, m, d] = isoDate.split("-");
    if (!y || !m || !d) return "Bilgi yok";
    return new Date(Number(y), Number(m) - 1, Number(d))
      .toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "Bilgi yok";
  }
}

function formatDateLong(isoDate) {
  if (!isoDate) return "Bilgi yok";
  try {
    const [y, m, d] = isoDate.split("-");
    if (!y || !m || !d) return "Bilgi yok";
    return new Date(Number(y), Number(m) - 1, Number(d))
      .toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "Bilgi yok";
  }
}

function formatTime(timeStr) {
  if (!timeStr) return "Bilgi yok";
  // If time is HH:MM:SS, format to HH:MM
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return timeStr;
}

/* ── Type-safe cancel URL ── */
function cancelUrl(apt, isFP) {
  return isFP
    ? `/family-physician/appointments/${apt.id}/cancel`
    : `/appointments/${apt.id}/cancel`;
}

/* ═══════════════════════════════════════
   AppointmentCard
═══════════════════════════════════════ */
function AppointmentCard({ apt, isFP, onCancel }) {
  const { speak } = useAccessibility();

  const doctorName = apt.doctor_name || "Bilgi yok";
  const locationName = isFP ? (apt.clinic_name || "Bilgi yok") : (apt.hospital_name || "Bilgi yok");
  const branchName = apt.branch_name || "Bilgi yok";
  const dateShort = formatDate(apt.date);
  const dateLong = formatDateLong(apt.date);
  const timeStr = formatTime(apt.time);
  const cityStr = apt.city || "Bilgi yok";
  const districtStr = apt.district || "Bilgi yok";

  const icon = isFP ? "👨‍⚕️" : "🏥";
  const accentColor = isFP ? "var(--secondary)" : "var(--confirm)";

  /* Speech Text */
  const speechFocus = isFP
    ? `${doctorName}, ${locationName}, ${cityStr} ${districtStr}, ${dateLong} saat ${timeStr} aktif aile hekimi randevusu`
    : `${doctorName}, ${locationName}, ${branchName}, ${dateLong} saat ${timeStr} aktif randevu`;

  /* Cancel Button Aria */
  const cancelAriaLabel = `${doctorName} ${dateLong} saat ${timeStr} randevusunu iptal et`;

  const handleRead = (e) => {
    e.stopPropagation();
    speak(speechFocus, { force: true });
  };

  return (
    <div
      className="apt-card"
      tabIndex={0}
      role="article"
      aria-label={speechFocus}
      onFocus={handleRead}
      onMouseEnter={handleRead}
      style={{ borderTop: `4px solid ${accentColor}` }}
    >
      {/* Header */}
      <div className="apt-card-header">
        <span className="apt-card-icon" aria-hidden="true">{icon}</span>
        <span className={`badge ${isFP ? "badge-fp" : "badge-hospital"}`}>
          {isFP ? "Aile Hekimi" : "Hastane"}
        </span>
        <span className="badge badge-active" style={{ marginLeft: "auto" }}>Aktif</span>
      </div>

      {/* Doctor & Location */}
      <div className="apt-card-doctor">{doctorName}</div>
      <div className="apt-card-location">{locationName}</div>
      
      {isFP ? (
        <div className="apt-card-branch" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          {cityStr} / {districtStr}
        </div>
      ) : (
        <div className="apt-card-branch">{branchName}</div>
      )}

      {/* Date / Time */}
      <div className="apt-card-datetime">
        <div className="apt-card-date-block">
          <span className="apt-card-date-label">📅 Tarih</span>
          <span className="apt-card-date-value">{dateShort}</span>
        </div>
        <div className="apt-card-date-sep" aria-hidden="true" />
        <div className="apt-card-date-block">
          <span className="apt-card-date-label">🕐 Saat</span>
          <span className="apt-card-time-value">{timeStr}</span>
        </div>
      </div>
      
      {/* Status (Visible Text) */}
      <div style={{ marginTop: "12px", fontSize: "0.9rem", fontWeight: "600" }}>
        Durum: Aktif
      </div>

      {/* Actions */}
      <div className="apt-card-actions" style={{ marginTop: "16px" }}>
        <button
          type="button"
          className="btn-sm btn-danger"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onCancel(apt, isFP); }}
          aria-label={cancelAriaLabel}
          onFocus={(e) => {
            e.stopPropagation();
            speak(cancelAriaLabel, { force: true });
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            speak(cancelAriaLabel, { force: true });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onCancel(apt, isFP);
            }
          }}
        >
          Randevuyu İptal Et
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Section
═══════════════════════════════════════ */
function AppointmentSection({ title, icon, appointments, isFP, onCancel, emptyMessage }) {
  return (
    <section className="apt-section" aria-labelledby={`sec-${isFP ? 'fp' : 'hospital'}`}>
      <div className="apt-section-header">
        <span aria-hidden="true">{icon}</span>
        <h2 id={`sec-${isFP ? 'fp' : 'hospital'}`} className="apt-section-title">{title}</h2>
        <span className="apt-section-count">{appointments.length} randevu</span>
      </div>

      {appointments.length === 0 ? (
        <div className="apt-section-empty" aria-live="polite">
          <span aria-hidden="true">📭</span>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="apt-card-grid">
          {appointments.map(apt => (
            <AppointmentCard
              key={apt.id}
              apt={apt}
              isFP={isFP}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════
   Main Page
═══════════════════════════════════════ */
function ActiveAppointmentsPage() {
  const navigate = useNavigate();
  const { speak, announce } = useAccessibility();

  const [hospitalApts, setHospitalApts] = useState([]);
  const [fpApts, setFpApts] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [cancelTarget, setCancelTarget] = useState(null); // { apt, isFP }
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  const [toast, setToast] = useState({ text: "", type: "" });

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  /* ── Toast helper ── */
  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "" }), 4500);
  };

  /* ── Load ── */
  const loadAppointments = useCallback(async () => {
    if (!user.id) { navigate("/login"); return; }
    
    setLoading(true);
    setErrorMsg("");
    
    let hospitalData = [];
    let fpData = [];
    let hasError = false;

    try {
      try {
        const res = await apiClient.get(`/appointments/active`);
        const allData = res.data || [];
        hospitalData = allData.filter(a => a.appointment_type !== "family_physician");
        fpData = allData.filter(a => a.appointment_type === "family_physician");
      } catch (err) {
        console.error("Randevular yüklenemedi:", err);
        hasError = true;
      }

      if (hasError) {
        setErrorMsg("Randevular yüklenirken bir hata oluştu.");
        showToast("Randevular yüklenirken bir hata oluştu.", "error");
      }

      setHospitalApts(hospitalData);
      setFpApts(fpData);

      const total = hospitalData.length + fpData.length;
      if (total === 0 && !hasError) {
        speak("Henüz aktif randevunuz bulunmuyor.");
        announce("Henüz aktif randevunuz bulunmuyor.", "polite");
      } else if (!hasError) {
        speak(`Aktif randevularım ekranı. Toplam ${total} aktif randevunuz var.`);
      }
    } finally {
      setLoading(false);
    }
  }, [user.id, navigate]); // eslint-disable-line

  useEffect(() => { loadAppointments(); }, []); // eslint-disable-line

  /* ── Open cancel modal ── */
  const requestCancel = (apt, isFP) => {
    setCancelTarget({ apt, isFP });
    setCancelModalOpen(true);
    
    const doctorName = apt.doctor_name || "Bilgi yok";
    const dateLong = formatDateLong(apt.date);
    const timeStr = formatTime(apt.time);
    
    speak(
      `${doctorName} ile ${dateLong} saat ${timeStr} randevusunu iptal etmek ` +
      "istediğinize emin misiniz? Evet için onaylayın, hayır için vazgeçin.",
      { priority: 3, force: true }
    );
  };

  /* ── Confirm cancel ── */
  const handleConfirmCancel = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    
    const { apt, isFP } = cancelTarget;
    const url = cancelUrl(apt, isFP);

    try {
      const res = await apiClient.delete(url);
      if (res.data.success) {
        if (isFP) {
          setFpApts(prev => prev.filter(a => a.id !== apt.id));
        } else {
          setHospitalApts(prev => prev.filter(a => a.id !== apt.id));
        }
        
        setCancelModalOpen(false);

        const msg = "Randevu iptal edildi";
        showToast(msg, "success");
        speak(msg, { priority: 3, force: true });
        announce(msg, "polite");
      }
    } catch (err) {
      const detail = err.response?.data?.detail || "";
      let msg = "Randevu iptal edilemedi. Lütfen tekrar deneyin.";

      if (detail.toLowerCase().includes("zaten iptal")) {
        msg = "Bu randevu zaten iptal edilmiş.";
        if (isFP) {
          setFpApts(prev => prev.filter(a => a.id !== apt.id));
        } else {
          setHospitalApts(prev => prev.filter(a => a.id !== apt.id));
        }
      } else if (err.response?.status === 404) {
        msg = "Randevu bulunamadı.";
        if (isFP) {
          setFpApts(prev => prev.filter(a => a.id !== apt.id));
        } else {
          setHospitalApts(prev => prev.filter(a => a.id !== apt.id));
        }
      }

      showToast(msg, "error");
      speak(msg, { priority: 3, force: true });
      setCancelModalOpen(false);
    } finally {
      setCancelling(false);
    }
  };

  /* ── Loading ── */
  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-card" role="status" aria-live="polite">
        <div className="loading-spinner" />
        <h2>Randevularınız yükleniyor...</h2>
        <span className="sr-only">Lütfen bekleyin</span>
      </div>
    </div>
  );

  const totalApts = hospitalApts.length + fpApts.length;

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: "1080px" }}>

        {/* Toast */}
        {toast.text && (
          <div
            className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`}
            role="alert"
            aria-live="assertive"
          >
            {toast.type === "error" ? "⚠️ " : "✅ "}{toast.text}
          </div>
        )}

        {/* Header */}
        <div className="flex-between" style={{ marginBottom: "28px" }}>
          <div>
            <h1 style={{ marginBottom: "4px" }}>Mevcut Randevularım</h1>
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.9rem" }}>
              Toplam {totalApts} aktif randevu
            </p>
          </div>
          <button
            type="button"
            className="btn-sm btn-secondary"
            onClick={() => navigate("/dashboard")}
            aria-label="Ana sayfaya dön"
          >
            ← Ana Sayfa
          </button>
        </div>

        {/* Global error message */}
        {errorMsg && totalApts === 0 && (
          <div className="empty-state" aria-live="polite">
            <div className="empty-state-icon">⚠️</div>
            <h2>{errorMsg}</h2>
          </div>
        )}

        {/* Global empty state */}
        {!errorMsg && totalApts === 0 ? (
          <div className="empty-state" aria-live="polite">
            <div className="empty-state-icon">📭</div>
            <h2>Henüz aktif randevunuz bulunmuyor.</h2>
            <p style={{ color: "var(--text-muted)" }}>
              Randevu almak için aşağıdaki seçeneklerden birini kullanabilirsiniz.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "260px", margin: "24px auto 0" }}>
              <button
                type="button"
                className="btn-large btn-confirm"
                onClick={() => navigate("/appointment-search")}
                aria-label="Hastane randevusu al"
              >
                🏥 Hastane Randevusu Al
              </button>
              <button
                type="button"
                className="btn-large btn-secondary"
                onClick={() => navigate("/family-physician-slots")}
                aria-label="Aile hekimi randevusu al"
              >
                👨‍⚕️ Aile Hekimi Randevusu
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
            {/* ═══ Hastane Randevuları ═══ */}
            <AppointmentSection
              title="Hastane Randevularım"
              icon="🏥"
              appointments={hospitalApts}
              isFP={false}
              onCancel={requestCancel}
              emptyMessage="Henüz hastane randevunuz bulunmuyor."
            />

            {/* ═══ Aile Hekimi Randevuları ═══ */}
            <AppointmentSection
              title="Aile Hekimi Randevularım"
              icon="👨‍⚕️"
              appointments={fpApts}
              isFP={true}
              onCancel={requestCancel}
              emptyMessage="Henüz aile hekimi randevunuz bulunmuyor."
            />
          </div>
        )}

        {/* ════ Cancel Confirmation Modal ════ */}
        <Modal
          isOpen={cancelModalOpen}
          onClose={() => { if (!cancelling) setCancelModalOpen(false); }}
          title="Randevu İptal Onayı"
        >
          {cancelTarget && (
            <>
              {/* Appointment summary inside modal */}
              <div style={{
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                borderLeft: `4px solid ${cancelTarget.isFP ? "var(--secondary)" : "var(--confirm)"}`,
                borderRadius: "var(--r)",
                padding: "16px 20px",
                marginBottom: "20px"
              }}>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "4px" }}>
                  {cancelTarget.apt.doctor_name || "Bilgi yok"}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "10px" }}>
                  {cancelTarget.isFP ? cancelTarget.apt.clinic_name : cancelTarget.apt.hospital_name}
                  {!cancelTarget.isFP && cancelTarget.apt.branch_name &&
                    ` — ${cancelTarget.apt.branch_name}`}
                </div>
                <div style={{ display: "flex", gap: "20px", fontWeight: 600, fontSize: "0.92rem" }}>
                  <span>📅 {formatDate(cancelTarget.apt.date)}</span>
                  <span>🕐 {formatTime(cancelTarget.apt.time)}</span>
                </div>
                <div style={{ marginTop: "8px" }}>
                  <span className={`badge ${cancelTarget.isFP ? "badge-fp" : "badge-hospital"}`}>
                    {cancelTarget.isFP ? "Aile Hekimi" : "Hastane"}
                  </span>
                </div>
              </div>

              <p style={{ marginBottom: "20px", lineHeight: 1.65 }}>
                Bu randevuyu iptal etmek istediğinizden emin misiniz?
              </p>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  className="btn-large btn-danger"
                  style={{ flex: 1 }}
                  onClick={handleConfirmCancel}
                  disabled={cancelling}
                  aria-label="Evet, randevuyu iptal et"
                >
                  {cancelling ? "İptal ediliyor…" : "✓ Evet, İptal Et"}
                </button>
                <button
                  type="button"
                  className="btn-large btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setCancelModalOpen(false)}
                  disabled={cancelling}
                  aria-label="Hayır, vazgeç"
                >
                  Hayır, Vazgeç
                </button>
              </div>
            </>
          )}
        </Modal>

      </div>
    </div>
  );
}

export default ActiveAppointmentsPage;

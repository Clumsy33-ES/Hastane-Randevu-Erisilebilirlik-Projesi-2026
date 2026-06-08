import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAccessibility } from "../contexts/AccessibilityContext";
import { useAppointment } from "../contexts/AppointmentContext";

function AppointmentSuccessPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { speak, announce } = useAccessibility();
  const { searchCriteria, selectedSlot, selectedDoctorObj, resetSearchCriteria } = useAppointment();

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // FP appointments pass their data via location.state
  const locationState = location.state || {};
  const isFamilyPhysician = locationState.type === "family_physician";
  const fpAppointment = locationState.appointment || null;

  useEffect(() => {
    const msg = isFamilyPhysician
      ? "Aile hekimi randevunuz başarıyla oluşturuldu."
      : "Randevunuz başarıyla onaylanmıştır.";
    announce(msg, "polite");
    speak(msg, { priority: 3, type: "info" });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoActive   = () => { resetSearchCriteria(); navigate("/active-appointments"); };
  const handleGoDashboard = () => { resetSearchCriteria(); navigate("/dashboard"); };

  /* ──────────────────────────────────────────
     Build display rows depending on type
  ────────────────────────────────────────── */
  const rows = isFamilyPhysician
    ? [
        { label: "Hekim",          value: fpAppointment?.doctor_name || "—" },
        { label: "ASM",            value: fpAppointment?.clinic_name || "—" },
        { label: "Şehir / İlçe",  value: fpAppointment ? `${fpAppointment.city} — ${fpAppointment.district}` : "—" },
        { label: "Randevu Tarihi", value: fpAppointment?.date || "—" },
        { label: "Randevu Saati",  value: fpAppointment?.time || "—" },
        { label: "Randevu Sahibi", value: user.name || "—" },
      ]
    : [
        { label: "Randevu Zamanı", value: `${searchCriteria.date || "—"} — ${selectedSlot || "—"}` },
        { label: "Hastane",        value: selectedDoctorObj?.hospital_name || "—" },
        { label: "Poliklinik",     value: selectedDoctorObj?.branch_name || "—" },
        { label: "Hekim",          value: selectedDoctorObj?.name || "—" },
        { label: "Randevu Sahibi", value: user.name || "—" },
      ];

  const title = isFamilyPhysician
    ? "Aile Hekimi Randevunuz Onaylandı"
    : "Randevunuz Onaylanmıştır";

  const badgeLabel = isFamilyPhysician ? "Aile Hekimi Randevusu" : "Hastane Randevusu";
  const badgeColor = isFamilyPhysician ? "var(--secondary)" : "var(--primary)";

  return (
    <div className="page-wrapper">
      <div className="container" style={{ display: "flex", justifyContent: "center" }}>
        <div className="card" style={{ maxWidth: "600px", width: "100%", padding: 0, overflow: "hidden" }}>

          {/* Title Bar */}
          <div style={{
            background: "var(--input-bg)",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
              <span style={{
                display: "inline-block",
                marginTop: "6px",
                background: badgeColor,
                color: "#fff",
                fontSize: "0.73rem",
                fontWeight: 700,
                padding: "2px 10px",
                borderRadius: "20px",
                letterSpacing: "0.02em"
              }}>
                {badgeLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={handleGoDashboard}
              style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "var(--text-muted)" }}
              aria-label="Kapat"
            >×</button>
          </div>

          {/* Success Icon */}
          <div style={{ textAlign: "center", padding: "28px 24px 0", fontSize: "3.5rem" }} aria-hidden="true">
            ✅
          </div>

          {/* Detail Table */}
          <div style={{ padding: "0 24px 28px" }}>
            <table className="detail-table" style={{ marginTop: "16px", marginBottom: "24px" }}>
              <tbody>
                {rows.map(({ label, value }) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td style={{ fontWeight: label.includes("Saati") || label.includes("Hekim") ? 600 : 400 }}>
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                type="button"
                className="btn-large btn-secondary"
                onClick={handleGoActive}
                data-speech="Aktif randevularım sayfasına git"
              >
                Aktif Randevularım
              </button>
              <button
                type="button"
                className="btn-large btn-secondary"
                onClick={handleGoDashboard}
                data-speech="Ana sayfaya dön"
              >
                Ana Sayfa
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default AppointmentSuccessPage;

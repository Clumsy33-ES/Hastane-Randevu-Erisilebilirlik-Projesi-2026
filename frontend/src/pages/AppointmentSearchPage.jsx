import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import apiClient from "../api/client";
import { useAccessibility } from "../contexts/AccessibilityContext";
import { useAppointment } from "../contexts/AppointmentContext";
import LocationPermissionModal from "../components/LocationPermissionModal";

function AppointmentSearchPage() {
  const navigate = useNavigate();
  const loc = useLocation();
  const { speak, announce } = useAccessibility();
  const { searchCriteria, updateSearchCriteria, resetSearchCriteria } = useAppointment();

  // Data states
  const [allHospitals, setAllHospitals] = useState([]);
  const [cities, setCities]             = useState([]);
  const [districts, setDistricts]       = useState([]);
  const [branches, setBranches]         = useState([]);
  const [hospitals, setHospitals]       = useState([]); // Filtered hospitals
  const [doctors, setDoctors]           = useState([]);
  
  // Location states
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [validationError, setValidationError] = useState("");

  const { city_id, district_id, branch_id, hospital_id, doctor_id, date } = searchCriteria;


  // On Mount: Load All Hospitals and Branches
  useEffect(() => {
    // RESET all search criteria when entering the page
    resetSearchCriteria();
    
    speak("Randevu arama ekranındasınız. İsterseniz Konuma Göre Hastane Bul butonunu kullanabilir veya il, ilçe seçerek manuel arama yapabilirsiniz.");
    
    setLoading(true);
    Promise.all([
      apiClient.get("/hospitals"),
      apiClient.get("/branches")
    ])
    .then(([hospitalsRes, branchesRes]) => {
      const hData = hospitalsRes.data;
      setAllHospitals(hData);
      setBranches(branchesRes.data);
      
      // Extract unique cities
      const uniqueCities = [...new Set(hData.map(h => h.city))].sort();
      setCities(uniqueCities);
      
      setLoading(false);
      
      // Auto-trigger location search if navigated with state
      if (loc.state?.autoLocation) {
        handleLocationClick();
      }
    })
    .catch(err => {
      console.error("Initial data load error:", err);
      setApiError("Veriler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
    });
  }, []);

  // When City Changes
  useEffect(() => {
    if (city_id) {
      // Extract unique districts for the selected city
      const cityDistricts = [...new Set(allHospitals.filter(h => h.city === city_id).map(h => h.district))].sort();
      setDistricts(cityDistricts);
      
      if (cityDistricts.length === 0) {
        setApiError("Bu il için ilçe bulunamadı.");
      } else {
        setApiError("");
      }
    } else {
      setDistricts([]);
    }
  }, [city_id, allHospitals]);

  // When District or Branch Changes
  useEffect(() => {
    if (city_id && district_id) {
      const filtered = allHospitals.filter(h => h.city === city_id && h.district === district_id);
      setHospitals(filtered);
    } else {
      setHospitals([]);
    }
  }, [city_id, district_id, allHospitals]);

  // When Hospital or Branch Changes
  useEffect(() => {
    if (hospital_id && branch_id) {
      setDoctorsLoading(true);
      apiClient.get(`/doctors?hospital_id=${hospital_id}&branch_id=${branch_id}`)
        .then(res => {
          setDoctors(res.data);
          setDoctorsLoading(false);
        })
        .catch(err => {
          console.error("Doctors load error:", err);
          setApiError("Doktorlar yüklenirken hata oluştu.");
          setDoctorsLoading(false);
        });
    } else {
      setDoctors([]);
    }
  }, [hospital_id, branch_id]);

  const handleClear = () => { 
    resetSearchCriteria(); 
    setValidationError(""); 
    setApiError("");
    setNearbyHospitals([]);
    setLocationError("");
    speak("Seçimler temizlendi."); 
  };

  const handleSearch = () => {
    if (!city_id || !district_id || !branch_id || !hospital_id) {
      const msg = "Lütfen il, ilçe, hastane ve branş alanlarını doldurunuz.";
      setValidationError(msg);
      announce(msg, "assertive");
      return;
    }
    setValidationError("");
    speak("Randevu aranıyor.", { priority: 3 });
    navigate("/doctor-results");
  };

  const handleLocationClick = () => {
    const perm = localStorage.getItem('locationPermission');
    if (perm === 'always') {
      executeLocationSearch();
    } else if (perm === 'never') {
      const msg = "Konum izni daha önce reddedilmiş. İl ve ilçe seçerek devam edebilirsiniz.";
      setLocationError(msg);
      announce(msg, "assertive");
    } else {
      setShowLocationModal(true);
    }
  };

  const handlePermissionGranted = () => {
    setShowLocationModal(false);
    executeLocationSearch();
  };

  const executeLocationSearch = () => {
    if (!navigator.geolocation) {
      const msg = "Tarayıcınız konum özelliğini desteklemiyor.";
      setLocationError(msg);
      announce(msg, "assertive");
      return;
    }
    
    setLocationLoading(true);
    setLocationError("");
    setNearbyHospitals([]);
    speak("Konum alınıyor, lütfen bekleyin.", { force: true });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        apiClient.get(`/hospitals/nearby?lat=${latitude}&lng=${longitude}`)
          .then(res => {
            setLocationLoading(false);
            if (res.data && res.data.length > 0) {
              setNearbyHospitals(res.data.slice(0, 3)); // İlk 3 en yakın hastaneyi göster
              const top = res.data[0];
              const msg = `Size en yakın hastane ${top.name}, yaklaşık ${top.distance_km} kilometre uzaklıkta. Listeden seçiminizi yapabilirsiniz.`;
              speak(msg, { priority: 3, force: true });
              announce(msg, "polite");
            } else {
              const msg = "Yakınınızda uygun hastane bulunamadı.";
              setLocationError(msg);
              announce(msg, "assertive");
            }
          })
          .catch(err => {
            console.error(err);
            setLocationLoading(false);
            const msg = "Yakın hastaneler getirilirken bir sorun oluştu.";
            setLocationError(msg);
            announce(msg, "assertive");
          });
      },
      (error) => {
        setLocationLoading(false);
        const msg = "Konum izni verilmedi. İl ve ilçe seçerek devam edebilirsiniz.";
        setLocationError(msg);
        speak(msg, { priority: 3, force: true });
        announce(msg, "assertive");
      }
    );
  };

  const selectNearbyHospital = (h) => {
    updateSearchCriteria("city_id", h.city);
    updateSearchCriteria("district_id", h.district);
    updateSearchCriteria("hospital_id", h.id.toString());
    updateSearchCriteria("branch_id", "");
    updateSearchCriteria("doctor_id", "");
    setNearbyHospitals([]);
    const msg = `${h.name} seçildi. Lütfen branş seçimi yaparak devam edin.`;
    speak(msg, { priority: 3, force: true });
    announce(msg, "polite");
  };

  const isSearchEnabled = !!(city_id && district_id && branch_id && hospital_id);

  const Field = ({ step, label, required, children }) => (
    <div>
      <label>
        <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', marginRight: '8px', fontWeight: 700 }}>{step}</span>
        {label}{required && <span style={{ color: 'var(--primary)', marginLeft: '4px' }}>*</span>}
      </label>
      {children}
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: '680px' }}>

        {/* Page Title */}
        <div className="flex-between" style={{ marginBottom: '24px' }}>
          <div>
            <h1 style={{ marginBottom: '4px' }}>Randevu Ara</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
              Kriterleri seçin veya konuma göre arayın.
            </p>
          </div>
          <button type="button" className="btn-sm btn-ghost"
            onClick={() => navigate("/dashboard")}
            data-speech="Geri. Ana sayfaya dönmek için Enter tuşuna basın."
          >
            ← Geri
          </button>
        </div>

        {/* Location Section */}
        <div className="card" style={{ marginBottom: '24px', background: 'var(--surface-alt)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>Yakınımdaki Hastaneler</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Konumunuza en yakın hastaneleri listeleyin.</p>
            </div>
            <button 
              type="button" 
              className="btn-large btn-primary" 
              style={{ width: 'auto' }}
              onClick={handleLocationClick}
              disabled={locationLoading}
              tabIndex={0}
              aria-label="Konuma göre en yakın hastaneleri bul"
              data-speech="Konuma göre en yakın hastaneleri bulmak için tıklayın."
            >
              {locationLoading ? "Konum Aranıyor..." : "📍 Konuma Göre Hastane Bul"}
            </button>
          </div>

          {locationError && (
            <div className="alert-error" style={{ marginTop: '16px' }} role="alert" aria-live="assertive">
              {locationError}
            </div>
          )}

          {nearbyHospitals.length > 0 && (
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Size En Yakın Hastaneler:</h4>
              {nearbyHospitals.map((h, idx) => {
                const speechText = `${h.name}, ${h.distance_km} kilometre uzaklıkta. Bu hastaneyi seçmek için Enter'a basın.`;
                return (
                  <button
                    key={h.id}
                    type="button"
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--r)', cursor: 'pointer', textAlign: 'left', width: '100%'
                    }}
                    onClick={() => selectNearbyHospital(h)}
                    tabIndex={0}
                    aria-label={speechText}
                    data-speech={speechText}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{h.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{h.city} / {h.district}</div>
                    </div>
                    <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600 }}>
                      ~{h.distance_km} km
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <LocationPermissionModal 
          isOpen={showLocationModal} 
          onClose={() => setShowLocationModal(false)}
          onPermissionGranted={handlePermissionGranted}
        />

        {/* Form Card */}
        <div className="card" style={{ margin: 0, position: 'relative' }}>
          
          {loading && (
            <div className="loading-overlay" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(255,255,255,0.7)', zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '16px',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div className="loading-spinner" style={{ margin: 0 }}></div>
              <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Yükleniyor...</div>
            </div>
          )}

          {validationError && (
            <div className="alert-error" role="alert" aria-live="assertive">{validationError}</div>
          )}

          {apiError && (
            <div className="alert-error" role="alert" aria-live="assertive">{apiError}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <Field step="1" label="İl" required>
              <select id="city" value={city_id}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSearchCriteria("city_id", val);
                  // SEQUENTIAL RESET
                  updateSearchCriteria("district_id", "");
                  updateSearchCriteria("hospital_id", "");
                  updateSearchCriteria("branch_id", "");
                  updateSearchCriteria("doctor_id", "");
                }}
                aria-label="İl seçimi"
                data-speech="İl seçimi alanı. Yukarı aşağı ok tuşlarıyla seçim yapın."
                disabled={loading}
              >
                <option value="">İl Seçiniz</option>
                {cities.map(cityName => <option key={cityName} value={cityName}>{cityName}</option>)}
              </select>
            </Field>

            <Field step="2" label="İlçe">
              <select id="district" value={district_id} disabled={!city_id || loading}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSearchCriteria("district_id", val);
                  // SEQUENTIAL RESET
                  updateSearchCriteria("hospital_id", "");
                  updateSearchCriteria("doctor_id", "");
                }}
                aria-label="İlçe seçimi"
                data-speech="İlçe seçimi alanı."
              >
                <option value="">İlçe Seçiniz</option>
                {districts.map(distName => <option key={distName} value={distName}>{distName}</option>)}
              </select>
            </Field>

            <Field step="3" label="Hastane" required>
              <select id="hospital" value={hospital_id} disabled={!district_id || loading}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSearchCriteria("hospital_id", val);
                  // SEQUENTIAL RESET
                  updateSearchCriteria("doctor_id", "");
                }}
                aria-label="Hastane seçimi"
                data-speech="Hastane seçimi alanı."
              >
                <option value="">Hastane Seçiniz</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>

            <Field step="4" label="Branş / Poliklinik" required>
              <select id="branch" value={branch_id} disabled={!hospital_id || loading}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSearchCriteria("branch_id", val);
                  // SEQUENTIAL RESET
                  updateSearchCriteria("doctor_id", "");
                }}
                aria-label="Branş seçimi"
                data-speech="Branş seçimi alanı."
              >
                <option value="">Branş Seçiniz</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>

            <Field step="5" label="Doktor (Opsiyonel)">
              <select id="doctor" value={doctor_id} disabled={!branch_id || loading || doctorsLoading}
                onChange={(e) => {
                  updateSearchCriteria("doctor_id", e.target.value);
                }}
                aria-label="Doktor seçimi"
                data-speech="Doktor seçimi. Belirli bir doktor tercih ediyorsanız seçin."
              >
                <option value="">{doctorsLoading ? "Yükleniyor..." : "Farketmez"}</option>
                {doctors.map(d => (
                  <option key={d.id} value={String(d.id)}>
                    {d.title} {d.full_name || d.name || "Doktor Bilgisi Yok"}
                  </option>
                ))}
              </select>
            </Field>

            <Field step="6" label="Tarih (Opsiyonel)">
              <input id="date" type="date" value={date}
                onChange={(e) => {
                  updateSearchCriteria("date", e.target.value);
                }}
                aria-label="Tarih seçimi. Boş bırakırsanız en yakın randevular gösterilir."
                data-speech="Tarih seçimi. Boş bırakırsanız en yakın randevular gösterilir."
                min={new Date().toISOString().split("T")[0]}
                disabled={loading}
              />
            </Field>

          </div>

          {/* Divider */}
          <div className="divider" />

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="btn-large btn-ghost"
              style={{ width: 'auto', padding: '0 24px' }}
              onClick={handleClear}
              data-speech="Temizle. Tüm seçimleri sıfırlamak için Enter tuşuna basın."
              disabled={loading}
            >
              Temizle
            </button>
            <button type="button" className="btn-large btn-confirm"
              style={{ width: 'auto', padding: '0 32px' }}
              onClick={handleSearch}
              disabled={!isSearchEnabled || loading}
              aria-disabled={!isSearchEnabled || loading}
              data-speech="Randevu Ara. Doktor sonuçlarını görmek için Enter tuşuna basın."
            >
              Randevu Ara →
            </button>
          </div>
        </div>

        {/* Guide */}
        <div className="guide-bar" style={{ marginTop: '16px' }}>
          <span>⌨️</span>
          <span><strong>Rehber:</strong> * işaretli alanlar zorunludur. Seçimler sıralı şekilde açılır. Sesli rehber açıksa <kbd style={{ background: '#e5e5e5', padding: '1px 5px', borderRadius: '4px', fontSize: '0.82rem' }}>R</kbd> ile tekrar dinleyebilirsiniz.</span>
        </div>

      </div>
    </div>
  );
}

export default AppointmentSearchPage;

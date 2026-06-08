import React from 'react';

function LocationPermissionModal({ isOpen, onClose, onPermissionGranted }) {
  if (!isOpen) return null;

  const handlePermission = (type) => {
    if (type === 'always') {
      localStorage.setItem('locationPermission', 'always');
      onPermissionGranted();
    } else if (type === 'while_using') {
      // Don't save to localStorage, just grant for this session
      onPermissionGranted();
    } else if (type === 'never') {
      localStorage.setItem('locationPermission', 'never');
      onClose(); // Just close, it won't trigger geolocation
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '90%', margin: 0, padding: '24px' }}>
        <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📍</span> Konum İzni
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: 1.5 }}>
          Size en yakın hastaneleri gösterebilmemiz için konum bilginize ihtiyacımız var.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            type="button" 
            className="btn-large btn-primary"
            onClick={() => handlePermission('while_using')}
          >
            Uygulamayı kullanırken izin ver
          </button>
          <button 
            type="button" 
            className="btn-large btn-ghost"
            style={{ border: '1px solid var(--primary)', color: 'var(--primary)' }}
            onClick={() => handlePermission('always')}
          >
            Her zaman izin ver
          </button>
          <button 
            type="button" 
            className="btn-large btn-ghost"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            onClick={() => handlePermission('never')}
          >
            Asla izin verme
          </button>
        </div>
      </div>
    </div>
  );
}

export default LocationPermissionModal;

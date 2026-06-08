import React, { useEffect, useRef } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';

function Modal({ isOpen, onClose, title, children, showCloseBtn = true }) {
  const modalRef = useRef(null);
  const { speak } = useAccessibility();

  useEffect(() => {
    if (isOpen) {
      if (modalRef.current) modalRef.current.focus();
      speak(`${title} penceresi açıldı. İçeriğe erişmek için sekme tuşunu kullanın.`, { priority: 3 });
      document.body.style.overflow = 'hidden';
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === modalRef.current) {
            last?.focus(); e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first?.focus(); e.preventDefault();
          }
        }
      }
    };

    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, title, speak]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        ref={modalRef}
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 0,
          padding: 0,
          borderRadius: '14px',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Title Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          backgroundColor: 'var(--primary)',
          borderRadius: '14px 14px 0 0',
        }}>
          <h2 id="modal-title" style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: 700 }}>
            {title}
          </h2>
          {showCloseBtn && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: 'none',
                color: '#fff',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                lineHeight: 1,
                transition: 'background 0.12s'
              }}
              aria-label="Kapat"
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
              onMouseOut={(e)  => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;

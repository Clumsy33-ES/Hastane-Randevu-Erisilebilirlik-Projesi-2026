import React from 'react';
import { Navigate } from 'react-router-dom';

const AdminRoute = ({ children }) => {
  const userStr = localStorage.getItem('user');
  let user = null;
  
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.error(e);
    }
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== 'admin') {
    return (
      <div className="page-wrapper">
        <div className="container" style={{ textAlign: 'center', marginTop: '100px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
          <h1 style={{ color: 'var(--danger)' }}>Erişim Engellendi</h1>
          <p style={{ fontSize: '1.2rem', marginBottom: '30px' }}>Bu sayfaya erişim yetkiniz yok.</p>
          <a href="/dashboard" className="btn-large btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Ana Sayfaya Dön
          </a>
        </div>
      </div>
    );
  }

  return children;
};

export default AdminRoute;

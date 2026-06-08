import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AppointmentSearchPage from "./pages/AppointmentSearchPage";
import DoctorResultsPage from "./pages/DoctorResultsPage";
import AppointmentSuccessPage from "./pages/AppointmentSuccessPage";
import ActiveAppointmentsPage from "./pages/ActiveAppointmentsPage";
import PastAppointmentsPage from "./pages/PastAppointmentsPage";
import ProfilePage from "./pages/ProfilePage";
import ConnectionErrorPage from "./pages/ConnectionErrorPage";
import FamilyPhysicianSlotsPage from "./pages/FamilyPhysicianSlotsPage";

import AdminRoute from "./components/AdminRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminHospitalsPage from "./pages/admin/AdminHospitalsPage";
import AdminBranchesPage from "./pages/admin/AdminBranchesPage";
import AdminDoctorsPage from "./pages/admin/AdminDoctorsPage";
import AdminSlotsPage from "./pages/admin/AdminSlotsPage";
import AdminAppointmentsPage from "./pages/admin/AdminAppointmentsPage";

function App() {
  const location = useLocation();
  const showHeader = location.pathname !== "/login" && location.pathname !== "/register";

  return (
    <>
      {showHeader && <Header />}
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/appointment-search" element={<AppointmentSearchPage />} />
        <Route path="/doctor-results" element={<DoctorResultsPage />} />
        <Route path="/family-physician-slots" element={<FamilyPhysicianSlotsPage />} />
        <Route path="/appointment-success" element={<AppointmentSuccessPage />} />
        <Route path="/active-appointments" element={<ActiveAppointmentsPage />} />
        <Route path="/past-appointments" element={<PastAppointmentsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/error" element={<ConnectionErrorPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/hospitals" element={<AdminRoute><AdminHospitalsPage /></AdminRoute>} />
        <Route path="/admin/branches" element={<AdminRoute><AdminBranchesPage /></AdminRoute>} />
        <Route path="/admin/doctors" element={<AdminRoute><AdminDoctorsPage /></AdminRoute>} />
        <Route path="/admin/slots" element={<AdminRoute><AdminSlotsPage /></AdminRoute>} />
        <Route path="/admin/appointments" element={<AdminRoute><AdminAppointmentsPage /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </>
  );
}

export default App;
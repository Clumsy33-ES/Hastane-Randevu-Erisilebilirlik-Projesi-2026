import React, { createContext, useState, useContext } from 'react';

const AppointmentContext = createContext();

export function AppointmentProvider({ children }) {
  // Store the user's search criteria across pages
  const [searchCriteria, setSearchCriteria] = useState({
    city_id: "",
    district_id: "",
    branch_id: "",
    hospital_id: "",
    doctor_id: "",
    date: ""
  });

  // Store the selected doctor and slot for confirmation
  const [selectedDoctorObj, setSelectedDoctorObj] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState("");

  const updateSearchCriteria = (key, value) => {
    setSearchCriteria(prev => ({ ...prev, [key]: value }));
  };

  const resetSearchCriteria = () => {
    setSearchCriteria({
      city_id: "",
      district_id: "",
      branch_id: "",
      hospital_id: "",
      doctor_id: "",
      date: ""
    });
    setSelectedDoctorObj(null);
    setSelectedSlot("");
  };

  return (
    <AppointmentContext.Provider value={{
      searchCriteria, updateSearchCriteria, resetSearchCriteria,
      selectedDoctorObj, setSelectedDoctorObj,
      selectedSlot, setSelectedSlot
    }}>
      {children}
    </AppointmentContext.Provider>
  );
}

export function useAppointment() {
  return useContext(AppointmentContext);
}

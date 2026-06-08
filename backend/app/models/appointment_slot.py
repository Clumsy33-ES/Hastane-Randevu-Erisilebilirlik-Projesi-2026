from sqlalchemy import Column, Integer, Date, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class AppointmentSlot(Base):
    __tablename__ = "appointment_slots"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    family_physician_id = Column(Integer, ForeignKey("family_physicians.id"), nullable=True)
    date = Column(Date, nullable=False)
    time = Column(String, nullable=False)
    is_booked = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    doctor = relationship("Doctor", back_populates="slots")
    family_physician = relationship("FamilyPhysician")
    appointment = relationship("Appointment", back_populates="slot", uselist=False)

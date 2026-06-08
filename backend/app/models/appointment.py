from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    slot_id = Column(Integer, ForeignKey("appointment_slots.id"))
    status = Column(String, default="active")
    appointment_type = Column(String, default="hospital") # "hospital" or "family_physician"
    family_physician_id = Column(Integer, ForeignKey("family_physicians.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    slot = relationship("AppointmentSlot", back_populates="appointment")
    family_physician = relationship("FamilyPhysician")

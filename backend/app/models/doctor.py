from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    title = Column(String, nullable=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"))
    branch_id = Column(Integer, ForeignKey("branches.id"))
    is_active = Column(Boolean, default=True)

    hospital = relationship("Hospital", back_populates="doctors")
    branch = relationship("Branch", back_populates="doctors")
    slots = relationship("AppointmentSlot", back_populates="doctor")
    appointments = relationship("Appointment", back_populates="doctor")

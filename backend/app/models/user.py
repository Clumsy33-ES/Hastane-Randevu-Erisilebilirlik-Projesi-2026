from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    tc_no = Column(String(11), unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")
    phone = Column(String, nullable=True)
    birth_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)

    family_physician_id = Column(Integer, ForeignKey("family_physicians.id"), nullable=True)

    appointments = relationship("Appointment", back_populates="user")
    family_physician = relationship("FamilyPhysician", back_populates="patients")

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class FamilyPhysician(Base):
    __tablename__ = "family_physicians"

    id = Column(Integer, primary_key=True, index=True)
    doctor_name = Column(String, nullable=False)
    clinic_name = Column(String, nullable=False)
    city = Column(String, nullable=False)
    district = Column(String, nullable=False)

    patients = relationship("User", back_populates="family_physician")

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from datetime import date as dt_date
from app.database import get_db
from app.models import Hospital, Branch, Doctor, AppointmentSlot, Appointment, User
from app.security import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])

# --- Models ---
class HospitalCreate(BaseModel):
    name: str
    city: str
    district: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class BranchCreate(BaseModel):
    name: str

class DoctorCreate(BaseModel):
    full_name: str
    title: str = "Dr."
    hospital_id: int
    branch_id: int

class SlotCreate(BaseModel):
    doctor_id: int
    date: str
    time: str

# --- Hospitals ---
@router.get("/hospitals")
def admin_get_hospitals(db: Session = Depends(get_db)):
    return db.query(Hospital).order_by(Hospital.id.desc()).all()

@router.post("/hospitals")
def admin_create_hospital(data: HospitalCreate, db: Session = Depends(get_db)):
    h = Hospital(
        name=data.name, city=data.city, district=data.district, 
        address=data.address, latitude=data.latitude, longitude=data.longitude,
        is_active=True
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return h

@router.put("/hospitals/{id}")
def admin_update_hospital(id: int, data: HospitalCreate, db: Session = Depends(get_db)):
    h = db.query(Hospital).filter(Hospital.id == id).first()
    if not h: raise HTTPException(status_code=404, detail="Not found")
    h.name = data.name
    h.city = data.city
    h.district = data.district
    h.address = data.address
    h.latitude = data.latitude
    h.longitude = data.longitude
    db.commit()
    db.refresh(h)
    return h

@router.patch("/hospitals/{id}/toggle-active")
def admin_toggle_hospital(id: int, db: Session = Depends(get_db)):
    h = db.query(Hospital).filter(Hospital.id == id).first()
    if not h: raise HTTPException(status_code=404, detail="Not found")
    h.is_active = not h.is_active
    db.commit()
    return {"success": True, "is_active": h.is_active}

# --- Branches ---
@router.get("/branches")
def admin_get_branches(db: Session = Depends(get_db)):
    return db.query(Branch).order_by(Branch.id.desc()).all()

@router.post("/branches")
def admin_create_branch(data: BranchCreate, db: Session = Depends(get_db)):
    b = Branch(name=data.name, is_active=True)
    db.add(b)
    db.commit()
    db.refresh(b)
    return b

@router.put("/branches/{id}")
def admin_update_branch(id: int, data: BranchCreate, db: Session = Depends(get_db)):
    b = db.query(Branch).filter(Branch.id == id).first()
    if not b: raise HTTPException(status_code=404, detail="Not found")
    b.name = data.name
    db.commit()
    db.refresh(b)
    return b

@router.patch("/branches/{id}/toggle-active")
def admin_toggle_branch(id: int, db: Session = Depends(get_db)):
    b = db.query(Branch).filter(Branch.id == id).first()
    if not b: raise HTTPException(status_code=404, detail="Not found")
    b.is_active = not b.is_active
    db.commit()
    return {"success": True, "is_active": b.is_active}

# --- Doctors ---
@router.get("/doctors")
def admin_get_doctors(is_active: Optional[str] = "true", db: Session = Depends(get_db)):
    query = db.query(Doctor)
    if is_active == "true":
        query = query.filter(Doctor.is_active == True)
    elif is_active == "false":
        query = query.filter(Doctor.is_active == False)
    doctors = query.order_by(Doctor.id.desc()).all()
    # Serialize relationships manually since models might not be configured with fast serialization
    return [{
        "id": d.id, "full_name": d.full_name, "title": d.title,
        "hospital_id": d.hospital_id, "hospital_name": d.hospital.name if d.hospital else None,
        "branch_id": d.branch_id, "branch_name": d.branch.name if d.branch else None,
        "is_active": d.is_active
    } for d in doctors]

@router.post("/doctors")
def admin_create_doctor(data: DoctorCreate, db: Session = Depends(get_db)):
    d = Doctor(
        full_name=data.full_name, title=data.title, 
        hospital_id=data.hospital_id, branch_id=data.branch_id,
        is_active=True
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    
    # Generate slots for the next 10 days
    from datetime import date, timedelta
    today = date.today()
    times = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"]
    for day_offset in range(10):
        slot_date = today + timedelta(days=day_offset)
        for t in times:
            slot = AppointmentSlot(
                doctor_id=d.id,
                date=slot_date,
                time=t,
                is_booked=False,
                is_active=True
            )
            db.add(slot)
    db.commit()
    
    return {"id": d.id, "full_name": d.full_name}

@router.put("/doctors/{id}")
def admin_update_doctor(id: int, data: DoctorCreate, db: Session = Depends(get_db)):
    d = db.query(Doctor).filter(Doctor.id == id).first()
    if not d: raise HTTPException(status_code=404, detail="Not found")
    d.full_name = data.full_name
    d.title = data.title
    d.hospital_id = data.hospital_id
    d.branch_id = data.branch_id
    db.commit()
    return {"id": d.id, "full_name": d.full_name}

@router.patch("/doctors/{id}/toggle-active")
def admin_toggle_doctor(id: int, db: Session = Depends(get_db)):
    d = db.query(Doctor).filter(Doctor.id == id).first()
    if not d: raise HTTPException(status_code=404, detail="Not found")
    d.is_active = not d.is_active
    db.commit()
    return {"success": True, "is_active": d.is_active}

# --- Slots ---
@router.get("/slots")
@router.get("/slots/doctor-summary")
def admin_get_slots(
    doctor_id: Optional[int] = None,
    hospital_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AppointmentSlot).filter(AppointmentSlot.doctor_id.isnot(None)).options(
        joinedload(AppointmentSlot.doctor).joinedload(Doctor.hospital),
        joinedload(AppointmentSlot.doctor).joinedload(Doctor.branch)
    )
    
    if doctor_id:
        query = query.filter(AppointmentSlot.doctor_id == doctor_id)
    else:
        if hospital_id or branch_id:
            query = query.join(AppointmentSlot.doctor)
            if hospital_id:
                query = query.filter(Doctor.hospital_id == hospital_id)
            if branch_id:
                query = query.filter(Doctor.branch_id == branch_id)
                
    if not doctor_id and not hospital_id and not branch_id:
        slots = query.order_by(AppointmentSlot.id.desc()).limit(200).all()
    else:
        slots = query.order_by(AppointmentSlot.id.desc()).all()
        
    return [{
        "id": s.id, "date": str(s.date), "time": s.time, "is_booked": s.is_booked, "is_active": s.is_active,
        "doctor_id": s.doctor_id,
        "doctor_name": s.doctor.full_name if s.doctor else "Bilinmeyen Doktor",
        "hospital_id": s.doctor.hospital_id if s.doctor else None,
        "hospital_name": s.doctor.hospital.name if s.doctor and s.doctor.hospital else "Bilinmiyor",
        "branch_id": s.doctor.branch_id if s.doctor else None,
        "branch_name": s.doctor.branch.name if s.doctor and s.doctor.branch else "Bilinmiyor"
    } for s in slots]

@router.post("/slots")
def admin_create_slot(data: SlotCreate, db: Session = Depends(get_db)):
    # Check duplicates
    existing = db.query(AppointmentSlot).filter(
        AppointmentSlot.doctor_id == data.doctor_id,
        AppointmentSlot.date == data.date,
        AppointmentSlot.time == data.time
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu doktor için bu tarih ve saatte zaten slot var.")
    
    s = AppointmentSlot(
        doctor_id=data.doctor_id, date=data.date, time=data.time,
        is_booked=False, is_active=True
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "success": True}

@router.patch("/slots/{id}/toggle-active")
def admin_toggle_slot(id: int, db: Session = Depends(get_db)):
    s = db.query(AppointmentSlot).filter(AppointmentSlot.id == id).first()
    if not s: raise HTTPException(status_code=404, detail="Not found")
    s.is_active = not s.is_active
    db.commit()
    return {"success": True, "is_active": s.is_active}

# --- Appointments ---
@router.get("/appointments")
def admin_get_appointments(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    apts = db.query(Appointment).options(
        joinedload(Appointment.user),
        joinedload(Appointment.slot).options(
            joinedload(AppointmentSlot.doctor).options(
                joinedload(Doctor.hospital),
                joinedload(Doctor.branch)
            )
        ),
        joinedload(Appointment.family_physician)
    ).order_by(Appointment.id.desc()).limit(limit).offset(offset).all()
    res = []
    today = dt_date.today()
    for a in apts:
        # Null safety helpers
        user_name = a.user.full_name if a.user else "Bilinmiyor"
        user_tc = a.user.tc_no if a.user else "Bilinmiyor"
        date_str = str(a.slot.date) if a.slot and a.slot.date else "Bilinmiyor"
        time_str = a.slot.time if a.slot and a.slot.time else "Bilinmiyor"
        
        # Dynamic status for past appointments
        display_status = a.status
        if display_status == "active" and a.slot and a.slot.date:
            if a.slot.date < today:
                display_status = "past"
        
        if a.appointment_type == "family_physician":
            doctor_name = a.family_physician.doctor_name if a.family_physician else "Bilinmiyor"
            hospital_name = a.family_physician.clinic_name if a.family_physician else "Bilinmiyor"
            branch_name = "Aile Hekimliği"
            
            res.append({
                "id": a.id, "type": "Aile Hekimi",
                "patient_name": user_name,
                "patient_tc": user_tc,
                "doctor_name": doctor_name,
                "hospital_name": hospital_name,
                "branch_name": branch_name,
                "date": date_str, "time": time_str, "status": display_status
            })
        else:
            # Default hospital appointment
            doctor = a.slot.doctor if a.slot else None
            doctor_name = doctor.full_name if doctor else "Bilinmiyor"
            hospital_name = doctor.hospital.name if doctor and getattr(doctor, 'hospital', None) else "Bilinmiyor"
            branch_name = doctor.branch.name if doctor and getattr(doctor, 'branch', None) else "Bilinmiyor"
            
            res.append({
                "id": a.id, "type": "Hastane",
                "patient_name": user_name,
                "patient_tc": user_tc,
                "doctor_name": doctor_name,
                "hospital_name": hospital_name,
                "branch_name": branch_name,
                "date": date_str, "time": time_str, "status": display_status
            })
    return res

@router.patch("/appointments/{id}/cancel")
def admin_cancel_appointment(id: int, db: Session = Depends(get_db)):
    apt = db.query(Appointment).options(joinedload(Appointment.slot)).filter(Appointment.id == id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Not found")
    
    if apt.status == "active":
        apt.status = "cancelled"
        if apt.slot:
            apt.slot.is_booked = False
        db.commit()
    return {
        "message": "Randevu iptal edildi",
        "appointment_id": id,
        "status": "cancelled"
    }

@router.get("/stats")
def admin_get_stats(db: Session = Depends(get_db)):
    hospitals_count = db.query(Hospital).count()
    branches_count = db.query(Branch).count()
    doctors_count = db.query(Doctor).count()
    active_appointments_count = db.query(Appointment).filter(Appointment.status == "active").count()
    total_slots = db.query(AppointmentSlot).count()
    available_slots = db.query(AppointmentSlot).filter(AppointmentSlot.is_booked == False).count()
    
    return {
        "total_hospitals": hospitals_count,
        "total_branches": branches_count,
        "total_doctors": doctors_count,
        "active_appointments": active_appointments_count,
        "total_slots": total_slots,
        "available_slots": available_slots
    }

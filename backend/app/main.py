import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime
import traceback
import logging
from app.security import hash_password, verify_password, create_access_token, get_current_user
from fastapi.security import OAuth2PasswordRequestForm

logger = logging.getLogger(__name__)
import math

# ── Database altyapısı ──
from app.database import Base, engine, test_connection, get_db
from app.models import User, Hospital, Branch, Doctor, AppointmentSlot, Appointment, FamilyPhysician

app = FastAPI(title="Hospital Appointment API")

@app.on_event("startup")
def on_startup():
    """Uygulama başladığında DB bağlantısını test et ve tabloları oluştur."""
    connected = test_connection()
    if connected and engine is not None:
        Base.metadata.create_all(bind=engine)
        logger.info("[DB] PostgreSQL baglantisi basarili. Tablolar hazir.")
    else:
        logger.info("[DB] Veritabani baglantisi yok -- Mock data ile devam ediliyor.")

import os

# Get CORS_ORIGINS from env, split by comma, remove whitespace
cors_env = os.getenv("CORS_ORIGINS", "")
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:19006",
    "http://127.0.0.1:19006",
    "https://hastane-randevu-erisilebilirlik-pro.vercel.app",
    "https://hastane-randevu-erisilebilirlik-projesi-2026-1wvk72arp.vercel.app",
]
if cors_env:
    for origin in cors_env.split(","):
        o = origin.strip()
        if o and o not in origins:
            origins.append(o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class LoginRequest(BaseModel):
    tc: str
    password: str

class RegisterRequest(BaseModel):
    tc_no: str
    full_name: str
    password: str
    phone: Optional[str] = None
    birth_date: Optional[str] = None

class BookAppointmentRequest(BaseModel):
    doctor_id: int
    doctor_name: str
    date: str
    time: str
    hospital_id: int
    hospital_name: str
    branch_id: int
    branch_name: str
    patient_tc: str
    patient_name: str
    slot_id: Optional[int] = None

class FamilyPhysicianAppointmentRequest(BaseModel):
    user_id: int
    family_physician_id: int
    date: str
    time: str
    slot_id: Optional[int] = None

# --- Endpoints ---

@app.get("/")
def root():
    return {"message": "API çalışıyor"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.tc_no == request.tc).first()
    if user and verify_password(request.password, user.password_hash):
        access_token = create_access_token(data={"sub": user.tc_no, "role": user.role})
        return {
            "success": True,
            "message": "Giriş başarılı",
            "access_token": access_token,
            "token_type": "bearer",
            "role": user.role,
            "user": {
                "id": user.id,
                "tc": user.tc_no,
                "name": user.full_name,
                "role": user.role
            }
        }
    raise HTTPException(status_code=401, detail="TC Kimlik No veya Şifre hatalı")

@app.post("/auth/token")
def login_for_swagger(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Swagger UI Authorize butonu için OAuth2 uyumlu endpoint"""
    user = db.query(User).filter(User.tc_no == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Yanlış TC Kimlik No veya Şifre", headers={"WWW-Authenticate": "Bearer"})
    
    access_token = create_access_token(data={"sub": user.tc_no, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.tc_no == request.tc_no).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Bu TC numarası ile kayıtlı kullanıcı zaten var.")
    
    # Create new user, enforce role='user'
    hashed_pw = hash_password(request.password)
    new_user = User(
        tc_no=request.tc_no,
        full_name=request.full_name,
        password_hash=hashed_pw,
        phone=request.phone,
        birth_date=datetime.strptime(request.birth_date, "%Y-%m-%d").date() if request.birth_date else None,
        role="user",
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "success": True,
        "message": "Kayıt başarılı",
        "user_id": new_user.id
    }


@app.get("/locations/cities")
def get_cities():
    return [
        {"id": 1, "name": "Elazığ"},
        {"id": 2, "name": "Malatya"},
        {"id": 3, "name": "Ankara"},
        {"id": 4, "name": "İstanbul"},
        {"id": 5, "name": "İzmir"},
        {"id": 6, "name": "Diyarbakır"}
    ]

@app.get("/locations/districts")
def get_districts(city_id: int):
    data = {
        1: [{"id": 1, "name": "Merkez"}, {"id": 2, "name": "Kovancılar"}],
        2: [{"id": 3, "name": "Battalgazi"}, {"id": 4, "name": "Yeşilyurt"}],
        3: [{"id": 5, "name": "Çankaya"}, {"id": 6, "name": "Keçiören"}, {"id": 16, "name": "Yenimahalle"}],
        4: [{"id": 7, "name": "Kadıköy"}, {"id": 8, "name": "Bakırköy"}, {"id": 9, "name": "Üsküdar"}],
        5: [{"id": 10, "name": "Bornova"}, {"id": 11, "name": "Konak"}, {"id": 12, "name": "Karşıyaka"}],
        6: [{"id": 13, "name": "Bağlar"}, {"id": 14, "name": "Sur"}, {"id": 15, "name": "Kayapınar"}]
    }
    return data.get(city_id, [])

@app.get("/branches")
def get_branches(db: Session = Depends(get_db)):
    try:
        branches = db.query(Branch).filter(Branch.is_active == True).all()
        return [{"id": b.id, "name": b.name, "is_active": b.is_active} for b in branches]
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/hospitals")
def get_hospitals(city_id: Optional[int] = None, district_id: Optional[int] = None, branch_id: Optional[int] = None, db: Session = Depends(get_db)):
    try:
        query = db.query(Hospital).filter(Hospital.is_active == True)

        # Filter by city name
        CITY_MAP = {
            1: "Elazığ", 2: "Malatya", 3: "Ankara",
            4: "İstanbul", 5: "İzmir", 6: "Diyarbakır"
        }
        if city_id and city_id in CITY_MAP:
            city_name = CITY_MAP[city_id]
            query = query.filter(Hospital.city == city_name)
            
        # Filter by district name
        DISTRICT_MAP = {
            1: "Merkez", 2: "Kovancılar",
            3: "Battalgazi", 4: "Yeşilyurt",
            5: "Çankaya", 6: "Keçiören", 16: "Yenimahalle",
            7: "Kadıköy", 8: "Bakırköy", 9: "Üsküdar",
            10: "Bornova", 11: "Konak", 12: "Karşıyaka",
            13: "Bağlar", 14: "Sur", 15: "Kayapınar"
        }
        if district_id and district_id in DISTRICT_MAP:
            district_name = DISTRICT_MAP[district_id]
            query = query.filter(Hospital.district == district_name)

        # Filter by branch: only hospitals that have at least one active doctor in that branch
        if branch_id:
            from sqlalchemy import exists
            query = query.filter(
                exists().where(
                    (Doctor.hospital_id == Hospital.id) &
                    (Doctor.branch_id == branch_id) &
                    (Doctor.is_active == True)
                )
            )

        hospitals = query.all()
        return [{
            "id": h.id,
            "name": h.name,
            "city": h.city,
            "district": h.district,
            "address": h.address,
            "is_active": h.is_active
        } for h in hospitals]
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@app.get("/hospitals/nearby")
def get_nearby_hospitals(lat: float, lng: float, db: Session = Depends(get_db)):
    try:
        hospitals = db.query(Hospital).filter(Hospital.is_active == True, Hospital.latitude.isnot(None), Hospital.longitude.isnot(None)).all()
        
        result = []
        for h in hospitals:
            distance = haversine(lat, lng, h.latitude, h.longitude)
            result.append({
                "id": h.id, 
                "name": h.name, 
                "city": h.city,
                "district": h.district,
                "address": h.address,
                "latitude": h.latitude,
                "longitude": h.longitude,
                "distance_km": round(distance, 1)
            })
            
        result.sort(key=lambda x: x["distance_km"])
        return result
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/doctors")
def get_doctors(hospital_id: Optional[int] = None, branch_id: Optional[int] = None, db: Session = Depends(get_db)):
    if not hospital_id or not branch_id:
        return []
    try:
        query = db.query(Doctor).filter(Doctor.is_active == True)
        if hospital_id:
            query = query.filter(Doctor.hospital_id == hospital_id)
        if branch_id:
            query = query.filter(Doctor.branch_id == branch_id)
        doctors = query.all()
        return [{
            "id": d.id, 
            "full_name": d.full_name or "Doktor Bilgisi Yok", 
            "name": d.full_name or "Doktor Bilgisi Yok", # frontend compatibility
            "title": d.title or "Dr.",
            "hospital_id": d.hospital_id,
            "branch_id": d.branch_id, 
            "hospital_name": d.hospital.name if d.hospital else "Bilinmiyor",
            "branch_name": d.branch.name if d.branch else "Bilinmiyor",
            "is_active": d.is_active
        } for d in doctors]
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/appointments/slots")
def get_slots(
    doctor_id: Optional[int] = None, 
    hospital_id: Optional[int] = None, 
    branch_id: Optional[int] = None,
    date: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    try:
        # Base query joining Doctor to access hospital/branch
        query = db.query(AppointmentSlot).join(Doctor).filter(
            AppointmentSlot.is_active == True,
            AppointmentSlot.is_booked == False,
            Doctor.is_active == True
        )
        
        # 1. If doctor_id is provided, only return that doctor's slots
        if doctor_id:
            query = query.filter(AppointmentSlot.doctor_id == doctor_id)
        # 2. If no doctor_id but hospital and branch are provided, return slots for all matching doctors
        elif hospital_id and branch_id:
            query = query.filter(Doctor.hospital_id == hospital_id, Doctor.branch_id == branch_id)
        else:
            # If neither mode is met, return empty or handle as invalid
            return []
        
        # 3. Date filtering
        if date and date.strip():
            try:
                date_obj = datetime.strptime(date, "%Y-%m-%d").date()
                query = query.filter(AppointmentSlot.date == date_obj)
            except ValueError:
                pass
        else:
            # Show from today onwards
            query = query.filter(AppointmentSlot.date >= datetime.now().date())
                
        # Order by nearest date and time
        slots = query.order_by(AppointmentSlot.date.asc(), AppointmentSlot.time.asc()).limit(20).all()
        
        result = []
        for s in slots:
            doc_title = s.doctor.title if s.doctor and s.doctor.title else "Dr."
            doc_name = s.doctor.full_name if s.doctor else "Bilinmiyor"
            
            result.append({
                "id": s.id, 
                "doctor_id": s.doctor_id,
                "doctor_name": f"{doc_title} {doc_name}",
                "hospital_id": s.doctor.hospital_id if s.doctor else None,
                "hospital_name": s.doctor.hospital.name if s.doctor and s.doctor.hospital else "Bilinmiyor",
                "branch_id": s.doctor.branch_id if s.doctor else None,
                "branch_name": s.doctor.branch.name if s.doctor and s.doctor.branch else "Bilinmiyor",
                "date": s.date.isoformat() if s.date else "",
                "time": s.time, 
                "is_booked": s.is_booked,
                "available": not s.is_booked,
                "is_active": s.is_active
            })
        return result
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/appointments/book")
def book_appointment(req: BookAppointmentRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        user = db.query(User).filter(User.tc_no == req.patient_tc).first()
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

        slot = None
        if req.slot_id:
            slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == req.slot_id).first()
        else:
            try:
                date_obj = datetime.strptime(req.date, "%Y-%m-%d").date()
                slot = db.query(AppointmentSlot).filter(
                    AppointmentSlot.doctor_id == req.doctor_id,
                    AppointmentSlot.date == date_obj,
                    AppointmentSlot.time == req.time
                ).first()
            except Exception:
                pass

        if not slot:
            raise HTTPException(status_code=404, detail="Slot bulunamadı")
        if slot.is_booked:
            raise HTTPException(status_code=400, detail="Bu randevu saati dolu")

        slot.is_booked = True
        
        new_apt = Appointment(
            user_id=user.id,
            doctor_id=req.doctor_id,
            slot_id=slot.id,
            status="active"
        )
        db.add(new_apt)
        db.commit()
        db.refresh(new_apt)

        return {
            "success": True, 
            "message": "Randevu başarıyla oluşturuldu", 
            "appointment": {
                "id": new_apt.id,
                "date": req.date,
                "time": req.time,
                "hospital_name": req.hospital_name,
                "doctor_name": req.doctor_name,
                "status": "active"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/appointments/active")
def get_active_appointments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        user = current_user
        if not user:
            return []
        
        apts = db.query(Appointment).filter(
            Appointment.user_id == user.id,
            Appointment.status == "active"
        ).all()
        
        res = []
        for apt in apts:
            doctor_name = "Bilinmiyor"
            hospital_name = "Bilinmiyor"
            branch_name = "Bilinmiyor"
            
            if apt.appointment_type == "family_physician" and apt.family_physician:
                doctor_name = apt.family_physician.doctor_name
                hospital_name = apt.family_physician.clinic_name
                branch_name = "Aile Hekimliği"
            elif apt.doctor:
                doctor_name = apt.doctor.full_name
                hospital_name = apt.doctor.hospital.name if apt.doctor.hospital else "Bilinmiyor"
                branch_name = apt.doctor.branch.name if apt.doctor.branch else "Bilinmiyor"

            res.append({
                "id": apt.id,
                "user_id": apt.user_id,
                "doctor_name": doctor_name,
                "hospital_name": hospital_name,
                "branch_name": branch_name,
                "date": apt.slot.date.isoformat() if apt.slot and apt.slot.date else "",
                "time": apt.slot.time if apt.slot and apt.slot.time else "",
                "status": apt.status,
                "appointment_type": apt.appointment_type,
                "patient_tc": current_user.tc_no
            })
        return res
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/appointments/past")
def get_past_appointments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        user = current_user
        if not user:
            return []
        
        apts = db.query(Appointment).filter(
            Appointment.user_id == user.id,
            Appointment.status != "active"
        ).all()
        
        res = []
        for apt in apts:
            doctor_name = "Bilinmiyor"
            hospital_name = "Bilinmiyor"
            branch_name = "Bilinmiyor"
            
            if apt.appointment_type == "family_physician" and apt.family_physician:
                doctor_name = apt.family_physician.doctor_name
                hospital_name = apt.family_physician.clinic_name
                branch_name = "Aile Hekimliği"
            elif apt.doctor:
                doctor_name = apt.doctor.full_name
                hospital_name = apt.doctor.hospital.name if apt.doctor.hospital else "Bilinmiyor"
                branch_name = apt.doctor.branch.name if apt.doctor.branch else "Bilinmiyor"

            res.append({
                "id": apt.id,
                "user_id": apt.user_id,
                "doctor_name": doctor_name,
                "hospital_name": hospital_name,
                "branch_name": branch_name,
                "date": apt.slot.date.isoformat() if apt.slot and apt.slot.date else "",
                "time": apt.slot.time if apt.slot and apt.slot.time else "",
                "status": apt.status,
                "appointment_type": apt.appointment_type,
                "patient_tc": current_user.tc_no
            })
        return res
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/appointments/{appointment_id}")
@app.delete("/appointments/{appointment_id}/cancel")
@app.patch("/appointments/{appointment_id}/cancel")
def cancel_appointment(appointment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Hastane randevusunu iptal et (sadece 'hospital' türü)."""
    try:
        apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not apt:
            raise HTTPException(status_code=404, detail="Randevu bulunamadı")
        if apt.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Bu randevuyu iptal etme yetkiniz yok")

        if apt.appointment_type == "family_physician":
            raise HTTPException(
                status_code=400,
                detail="Bu bir aile hekimi randevusudur. Lütfen /family-physician/appointments/{id}/cancel kullanın."
            )

        if apt.status == "canceled" or apt.status == "cancelled":
            raise HTTPException(status_code=400, detail="Bu randevu zaten iptal edilmiş")

        apt.status = "cancelled"
        if apt.slot:
            apt.slot.is_booked = False

        db.commit()
        return {"success": True, "message": "Randevu iptal edildi"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/family-physician/appointments/{appointment_id}")
@app.delete("/family-physician/appointments/{appointment_id}/cancel")
@app.patch("/family-physician/appointments/{appointment_id}/cancel")
def cancel_family_physician_appointment(appointment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Aile hekimi randevusunu iptal et (sadece 'family_physician' türü)."""
    try:
        apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not apt:
            raise HTTPException(
                status_code=404,
                detail="Aile hekimi randevusu bulunamadı"
            )
        if apt.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Bu randevuyu iptal etme yetkiniz yok")

        if apt.appointment_type != "family_physician":
            raise HTTPException(
                status_code=400,
                detail="Bu işlem için yanlış endpoint kullanıldı. Lütfen genel randevu iptalini kullanın."
            )

        if apt.status == "canceled" or apt.status == "cancelled":
            raise HTTPException(status_code=400, detail="Bu randevu zaten iptal edilmiş")

        apt.status = "cancelled"
        if apt.slot:
            apt.slot.is_booked = False

        db.commit()
        return {"success": True, "message": "Aile hekimi randevusu iptal edildi"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/family-physician/me")
def get_my_family_physician(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        if not user or not user.family_physician_id:
            return {"has_family_physician": False}
        
        fp = db.query(FamilyPhysician).filter(FamilyPhysician.id == user.family_physician_id).first()
        if not fp:
            return {"has_family_physician": False}
            
        return {
            "has_family_physician": True,
            "id": fp.id,
            "doctor_name": fp.doctor_name,
            "clinic_name": fp.clinic_name,
            "city": fp.city,
            "district": fp.district
        }
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/family-physician/slots")
def get_family_physician_slots(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        if not user or not user.family_physician_id:
            return []
            
        fp_id = user.family_physician_id
        slots = db.query(AppointmentSlot).filter(
            AppointmentSlot.family_physician_id == fp_id,
            AppointmentSlot.is_active == True,
            AppointmentSlot.is_booked == False,
            AppointmentSlot.date >= datetime.now().date()
        ).order_by(AppointmentSlot.date.asc(), AppointmentSlot.time.asc()).all()
        
        return [{
            "id": s.id,
            "family_physician_id": s.family_physician_id,
            "date": s.date.isoformat(),
            "time": s.time,
            "available": True
        } for s in slots]
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/family-physician/book")
@app.post("/family-physician/appointments")
def book_family_physician_appointment(req: FamilyPhysicianAppointmentRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        # Check if slot exists and is available
        slot = db.query(AppointmentSlot).filter(
            AppointmentSlot.family_physician_id == req.family_physician_id,
            AppointmentSlot.date == datetime.strptime(req.date, "%Y-%m-%d").date(),
            AppointmentSlot.time == req.time
        ).first()
        
        if not slot:
            raise HTTPException(status_code=404, detail="Seçilen saat için slot bulunamadı")
        if slot.is_booked:
            raise HTTPException(status_code=409, detail="Bu saat dolu")
            
        slot.is_booked = True
        
        new_apt = Appointment(
            user_id=current_user.id,  # Force current user ID for security
            family_physician_id=req.family_physician_id,
            slot_id=slot.id,
            appointment_type="family_physician",
            status="active"
        )
        db.add(new_apt)
        db.commit()
        db.refresh(new_apt)
        
        return {
            "success": True,
            "message": "Aile hekimi randevusu başarıyla oluşturuldu",
            "appointment": {
                "id": new_apt.id,
                "date": req.date,
                "time": req.time,
                "doctor_name": new_apt.family_physician.doctor_name,
                "status": "active"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
class FamilyPhysicianAssignRequest(BaseModel):
    family_physician_id: int

@app.post("/family-physician/assign")
def assign_family_physician(req: FamilyPhysicianAssignRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
            
        fp = db.query(FamilyPhysician).filter(FamilyPhysician.id == req.family_physician_id).first()
        if not fp:
            raise HTTPException(status_code=404, detail="Aile hekimi bulunamadı")
            
        user.family_physician_id = fp.id
        db.commit()
        return {"success": True, "message": "Aile hekimi atandı"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/family-physicians")
def list_family_physicians(city: Optional[str] = None, district: Optional[str] = None, clinic_name: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        query = db.query(FamilyPhysician)
        if city:
            query = query.filter(FamilyPhysician.city == city)
        if district:
            query = query.filter(FamilyPhysician.district == district)
        if clinic_name:
            query = query.filter(FamilyPhysician.clinic_name == clinic_name)
            
        fps = query.all()
        return [{
            "id": fp.id,
            "doctor_name": fp.doctor_name,
            "clinic_name": fp.clinic_name,
            "city": fp.city,
            "district": fp.district
        } for fp in fps]
    except Exception as e:
        logger.error("Exception occurred", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


from app import admin_router
app.include_router(admin_router.router)

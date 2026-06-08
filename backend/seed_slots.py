import sys
import io
import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from app.database import SessionLocal
from app.models import AppointmentSlot, Doctor

def seed():
    db = SessionLocal()
    try:
        # Check current slots
        total = db.query(AppointmentSlot).count()
        available = db.query(AppointmentSlot).filter(AppointmentSlot.is_booked == False, AppointmentSlot.is_active == True).count()
        future = db.query(AppointmentSlot).filter(
            AppointmentSlot.is_booked == False, 
            AppointmentSlot.is_active == True,
            AppointmentSlot.date >= datetime.date.today()
        ).count()
        
        print(f"Total slots: {total}")
        print(f"Available slots: {available}")
        print(f"Future available slots: {future}")

        # Get all active doctors
        doctors = db.query(Doctor).filter(Doctor.is_active == True).all()
        print(f"Found {len(doctors)} active doctors.")

        times = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"]
        
        added_count = 0
        today = datetime.date.today()

        for d in doctors:
            existing_slots = db.query(AppointmentSlot).filter(
                AppointmentSlot.doctor_id == d.id,
                AppointmentSlot.date >= today
            ).all()
            
            existing_set = set((s.date, s.time) for s in existing_slots)
            
            for day_offset in range(1, 11):
                date_val = today + datetime.timedelta(days=day_offset)
                for time_val in times:
                    if (date_val, time_val) not in existing_set:
                        slot = AppointmentSlot(
                            doctor_id=d.id,
                            date=date_val,
                            time=time_val,
                            is_booked=False,
                            is_active=True
                        )
                        db.add(slot)
                        added_count += 1
                        
        db.commit()
        print(f"Successfully added {added_count} new slots.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()

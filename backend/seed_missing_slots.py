import os
import sys
from datetime import date, timedelta

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import Doctor, AppointmentSlot

def main():
    db = SessionLocal()
    try:
        # 1. Fetch all active doctors
        active_doctors = db.query(Doctor).filter(Doctor.is_active == True).all()
        total_active_doctors = len(active_doctors)
        print(f"Total active doctors found: {total_active_doctors}")
        
        today = date.today()
        end_date = today + timedelta(days=9)
        
        # 2. Fetch all unique doctor IDs that have ANY slots in database
        print("Loading unique doctors with slots...")
        docs_with_slots_rows = db.query(AppointmentSlot.doctor_id).filter(
            AppointmentSlot.doctor_id.isnot(None)
        ).distinct().all()
        docs_with_slots = {row[0] for row in docs_with_slots_rows}
        
        # 3. Fetch all existing slots in the date range to memory
        print("Loading existing slots from DB...")
        existing_slots = db.query(AppointmentSlot.doctor_id, AppointmentSlot.date, AppointmentSlot.time).filter(
            AppointmentSlot.doctor_id.isnot(None),
            AppointmentSlot.date >= today,
            AppointmentSlot.date <= end_date
        ).all()
        
        # Convert to a lookup set
        existing_set = {(row.doctor_id, row.date, row.time) for row in existing_slots}
        print(f"Loaded {len(existing_set)} existing slots in date range {today} to {end_date}.")
        
        # 4. Check and create missing slots (100% in-memory loop)
        doctors_without_slots = 0
        new_slots_created = 0
        times = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"]
        
        for doc in active_doctors:
            if doc.id not in docs_with_slots:
                doctors_without_slots += 1
                
            for day_offset in range(10):
                slot_date = today + timedelta(days=day_offset)
                for t in times:
                    key = (doc.id, slot_date, t)
                    if key not in existing_set:
                        new_slot = AppointmentSlot(
                            doctor_id=doc.id,
                            date=slot_date,
                            time=t,
                            is_booked=False,
                            is_active=True
                        )
                        db.add(new_slot)
                        new_slots_created += 1
                        # Add to set to prevent duplicates if any within same run
                        existing_set.add(key)
        
        print(f"Creating {new_slots_created} new slots in database...")
        db.commit()
        print("Database commit successful.")
        
        # Calculate stats
        total_slots_now = db.query(AppointmentSlot).filter(
            AppointmentSlot.doctor_id.isnot(None),
            AppointmentSlot.is_active == True
        ).count()
        avg_slots = total_slots_now / total_active_doctors if total_active_doctors > 0 else 0
        
        # Verify if any active doctor has 0 slots (in-memory)
        # Fetch updated slots set
        final_slots_rows = db.query(AppointmentSlot.doctor_id).filter(
            AppointmentSlot.doctor_id.isnot(None)
        ).distinct().all()
        final_docs_with_slots = {row[0] for row in final_slots_rows}
        
        zero_slot_docs = 0
        for doc in active_doctors:
            if doc.id not in final_docs_with_slots:
                zero_slot_docs += 1
                
        print("\n=== SLOT SEEDING REPORT ===")
        print(f"* Toplam aktif doktor sayisi: {total_active_doctors}")
        print(f"* Baslangicta slotu olmayan aktif doktor sayisi: {doctors_without_slots}")
        print(f"* Yeni olusturulan slot sayisi: {new_slots_created}")
        print(f"* Ortalama slot sayisi: {avg_slots:.1f}")
        print(f"* Slotu olmayan aktif doktor kaldi mi?: {'Evet' if zero_slot_docs > 0 else 'Hayir'}")
        print("===========================\n")
        
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    main()

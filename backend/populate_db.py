import os
import sys
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.database import SessionLocal
from app.models import Doctor, AppointmentSlot, Hospital, Branch
from faker import Faker

fake = Faker('tr_TR')

def main():
    db = SessionLocal()
    try:
        # 1. Total counts before
        initial_doctors = db.execute(text("SELECT COUNT(*) FROM doctors")).scalar()
        initial_slots = db.execute(text("SELECT COUNT(*) FROM appointment_slots")).scalar()
        
        # 2. Find missing combinations
        query = text("""
            SELECT 
                h.id AS hospital_id,
                b.id AS branch_id,
                COUNT(d.id) AS doctor_count
            FROM hospitals h
            CROSS JOIN branches b
            LEFT JOIN doctors d 
                ON d.hospital_id = h.id 
                AND d.branch_id = b.id 
                AND d.is_active = true
            WHERE h.is_active = true 
            AND b.is_active = true
            GROUP BY h.id, b.id
            HAVING COUNT(d.id) < 2
        """)
        missing_combos = db.execute(query).fetchall()
        
        # 3. Add Doctors
        new_doctors_count = 0
        for row in missing_combos:
            needed = 2 - row.doctor_count
            for _ in range(needed):
                # Generate fake name
                full_name = fake.name()
                # Remove common titles that Faker sometimes adds
                for prefix in ['Dr. ', 'Prof. Dr. ', 'Doç. Dr. ']:
                    if full_name.startswith(prefix):
                        full_name = full_name[len(prefix):]
                
                new_doc = Doctor(
                    full_name=full_name,
                    title="Dr.",
                    hospital_id=row.hospital_id,
                    branch_id=row.branch_id,
                    is_active=True
                )
                db.add(new_doc)
                new_doctors_count += 1
                
        db.commit()
        print(f"Added {new_doctors_count} new doctors.")
        
        # 4. Add Slots for ALL active doctors
        # Fetch all active doctors
        all_doctors = db.query(Doctor).filter(Doctor.is_active == True).all()
        
        hours = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"]
        today = datetime.now().date()
        
        # We will cache existing slots to avoid massive DB queries
        # tuple: (doctor_id, date, time)
        existing_slots_query = db.query(AppointmentSlot.doctor_id, AppointmentSlot.date, AppointmentSlot.time).all()
        existing_slots = set()
        for doc_id, d_date, d_time in existing_slots_query:
            # d_time is likely string or time object, convert to string HH:MM
            time_str = d_time if isinstance(d_time, str) else d_time.strftime("%H:%M")
            # If it has seconds like 09:00:00, slice it
            time_str = time_str[:5]
            existing_slots.add((doc_id, d_date, time_str))
            
        new_slots_count = 0
        slots_to_add = []
        
        for doc in all_doctors:
            for day_offset in range(10): # Next 10 days
                slot_date = today + timedelta(days=day_offset)
                
                # Skip weekends if desired, but user didn't specify. We'll add for all 10 days to be safe.
                for h in hours:
                    if (doc.id, slot_date, h) not in existing_slots:
                        # Add slot
                        slots_to_add.append(
                            AppointmentSlot(
                                doctor_id=doc.id,
                                date=slot_date,
                                time=h,
                                is_booked=False,
                                is_active=True
                            )
                        )
                        existing_slots.add((doc.id, slot_date, h))
                        new_slots_count += 1
                        
        # Batch insert for performance
        if slots_to_add:
            db.bulk_save_objects(slots_to_add)
            db.commit()
            
        print(f"Added {new_slots_count} new slots.")
        
        # Final Verification
        final_doctors = db.execute(text("SELECT COUNT(*) FROM doctors")).scalar()
        final_slots = db.execute(text("SELECT COUNT(*) FROM appointment_slots")).scalar()
        total_hospitals = db.execute(text("SELECT COUNT(*) FROM hospitals WHERE is_active = true")).scalar()
        total_branches = db.execute(text("SELECT COUNT(*) FROM branches WHERE is_active = true")).scalar()
        
        missing_combos_final = db.execute(query).fetchall()
        
        # Check doctors without slots
        slots_query = text("""
            SELECT d.id 
            FROM doctors d
            LEFT JOIN appointment_slots s ON s.doctor_id = d.id AND s.date >= CURRENT_DATE
            WHERE d.is_active = true
            GROUP BY d.id
            HAVING COUNT(s.id) = 0
        """)
        docs_without_slots = db.execute(slots_query).fetchall()
        
        print("=== RAPOR ===")
        print(f"Toplam aktif hastane sayisi: {total_hospitals}")
        print(f"Toplam aktif brans sayisi: {total_branches}")
        print(f"Toplam doktor sayisi: {final_doctors}")
        print(f"Toplam slot sayisi: {final_slots}")
        print(f"Doktorsuz kombinasyon kaldi mi?: {'Evet' if missing_combos_final else 'Hayir'}")
        print(f"Slotsuz aktif doktor kaldi mi?: {'Evet' if docs_without_slots else 'Hayir'}")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()

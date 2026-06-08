import os
import sys

# Add the backend directory to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.database import SessionLocal, engine

def main():
    db = SessionLocal()
    try:
        # 1. Total doctors
        doctor_count = db.execute(text("SELECT COUNT(*) FROM doctors")).scalar()
        print(f"Total doctors: {doctor_count}")
        
        # 2. Total slots
        slot_count = db.execute(text("SELECT COUNT(*) FROM appointment_slots")).scalar()
        print(f"Total slots: {slot_count}")
        
        # 3. Missing combinations
        query = text("""
            SELECT 
                h.id AS hospital_id,
                h.name AS hospital_name,
                b.id AS branch_id,
                b.name AS branch_name,
                COUNT(d.id) AS doctor_count
            FROM hospitals h
            CROSS JOIN branches b
            LEFT JOIN doctors d 
                ON d.hospital_id = h.id 
                AND d.branch_id = b.id 
                AND d.is_active = true
            WHERE h.is_active = true 
            AND b.is_active = true
            GROUP BY h.id, h.name, b.id, b.name
            HAVING COUNT(d.id) < 2
            ORDER BY h.name, b.name;
        """)
        missing_combos = db.execute(query).fetchall()
        print(f"Combinations with < 2 doctors: {len(missing_combos)}")
        
        for idx, row in enumerate(missing_combos[:10]):
            print(f"- {row.hospital_name} / {row.branch_name} (Doctors: {row.doctor_count})")
        
        if len(missing_combos) > 10:
            print(f"... and {len(missing_combos) - 10} more.")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()

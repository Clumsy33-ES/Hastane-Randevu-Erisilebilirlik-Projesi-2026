import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import engine, SessionLocal

def main():
    # Execute DDL first using engine connection
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE hospitals ADD COLUMN latitude FLOAT;"))
            print("Added latitude column.")
        except Exception as e:
            print("latitude column might already exist:", str(e))
            
        try:
            conn.execute(text("ALTER TABLE hospitals ADD COLUMN longitude FLOAT;"))
            print("Added longitude column.")
        except Exception as e:
            print("longitude column might already exist:", str(e))
        
        conn.commit()

    # Now update data using Session
    db = SessionLocal()
    try:
        # Specific coordinates
        specific_coords = {
            "Ankara Şehir Hastanesi": (39.9010, 32.7476),
            "Fırat Üniversitesi Hastanesi": (38.6748, 39.2232),
            "İstanbul Eğitim ve Araştırma Hastanesi": (41.0029, 28.9329),
            "İzmir Devlet Hastanesi": (38.4237, 27.1428),
            "Diyarbakır Gazi Yaşargil Eğitim ve Araştırma Hastanesi": (37.9351, 40.1583)
        }
        
        # General city coordinates
        city_coords = {
            "Ankara": (39.9208, 32.8541),
            "İstanbul": (41.0082, 28.9784),
            "İzmir": (38.4192, 27.1287),
            "Diyarbakır": (37.9144, 40.2306),
            "Elazığ": (38.6810, 39.2264)
        }
        
        from app.models.hospital import Hospital
        hospitals = db.query(Hospital).all()
        count = 0
        
        for h in hospitals:
            if h.name in specific_coords:
                h.latitude = specific_coords[h.name][0]
                h.longitude = specific_coords[h.name][1]
                count += 1
            elif h.city in city_coords:
                # Add some small random variance to district hospitals so they aren't EXACTLY same coords
                import random
                lat_offset = random.uniform(-0.05, 0.05)
                lng_offset = random.uniform(-0.05, 0.05)
                h.latitude = city_coords[h.city][0] + lat_offset
                h.longitude = city_coords[h.city][1] + lng_offset
                count += 1
                
        db.commit()
        print(f"Updated coordinates for {count} hospitals.")
    except Exception as e:
        db.rollback()
        print("Error updating coordinates:", str(e))
    finally:
        db.close()

if __name__ == "__main__":
    main()

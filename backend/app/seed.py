import random
from datetime import date, timedelta
from faker import Faker
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import engine, SessionLocal, Base
from app.models import User, Hospital, Branch, Doctor, AppointmentSlot, Appointment, FamilyPhysician
from app.security import hash_password

fake = Faker("tr_TR")

def clear_db(db: Session):
    # DANGEROUS: Do not use in production or without explicit intent.
    # TRUNCATE statements removed to prevent accidental data loss in Neon DB.
    pass

def generate_turkish_address(city, district):
    streets = ["Atatürk Caddesi", "Cumhuriyet Caddesi", "Fatih Sultan Mehmet Bulvarı", "İnönü Caddesi", "Zübeyde Hanım Caddesi", "Mimar Sinan Sokak", "Gazi Mustafa Kemal Bulvarı", "Vatan Caddesi", "İstiklal Caddesi"]
    mahalles = ["Hürriyet Mahallesi", "Cumhuriyet Mahallesi", "Yeni Mahalle", "Atatürk Mahallesi", "Fatih Mahallesi", "Bahçelievler Mahallesi", "Mimar Sinan Mahallesi"]
    street = random.choice(streets)
    mahalle = random.choice(mahalles)
    no = random.randint(1, 150)
    return f"{mahalle}, {street}, No: {no}, {district}/{city}"

def seed_data(db: Session):
    # clear_db(db) # Disabled to prevent accidental resets
    print("Starting idempotent seed with realistic Turkish data...")

    # USERS
    admin = db.query(User).filter(User.tc_no == "11111111111").first()
    if not admin:
        admin = User(
            tc_no="11111111111",
            full_name="Admin User",
            password_hash=hash_password("1234"),
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    existing_users_count = db.query(User).count()
    users = []
    if existing_users_count < 30:
        generated_tcs = {"11111111111"}
        for _ in range(30 - existing_users_count):
            while True:
                tc = fake.numerify("###########")
                if tc not in generated_tcs:
                    generated_tcs.add(tc)
                    break
            user = User(
                tc_no=tc,
                full_name=fake.name(),
                password_hash=hash_password("1234"),
                role="user",
                is_active=True
            )
            db.add(user)
            users.append(user)
        db.commit()
    else:
        users = db.query(User).filter(User.role == "user").all()

    # BRANCHES
    branch_names = ["Kardiyoloji", "Dahiliye", "Ortopedi", "Göz Hastalıkları", "Nöroloji"]
    branches = []
    for name in branch_names:
        b = db.query(Branch).filter(Branch.name == name).first()
        if not b:
            b = Branch(name=name, is_active=True)
            db.add(b)
        branches.append(b)
    db.commit()

    # LOCATIONS & HOSPITALS (User Requested)
    # Ankara: Çankaya, Keçiören, Yenimahalle
    # İstanbul: Kadıköy, Üsküdar, Bakırköy
    # İzmir: Bornova, Konak, Karşıyaka
    # Diyarbakır: Kayapınar, Bağlar, Sur
    # Elazığ: Merkez, Kovancılar
    
    locations = {
        "Ankara": ["Çankaya", "Keçiören", "Yenimahalle"],
        "İstanbul": ["Kadıköy", "Üsküdar", "Bakırköy"],
        "İzmir": ["Bornova", "Konak", "Karşıyaka"],
        "Diyarbakır": ["Kayapınar", "Bağlar", "Sur"],
        "Elazığ": ["Merkez", "Kovancılar"],
        "Malatya": ["Battalgazi", "Yeşilyurt"]
    }

    hospitals_data = [
        {"city": "Ankara", "district": "Çankaya", "name": "Ankara Şehir Hastanesi", "lat": 39.9010, "lng": 32.7476},
        {"city": "İstanbul", "district": "Kadıköy", "name": "İstanbul Eğitim ve Araştırma Hastanesi", "lat": 41.0029, "lng": 28.9329},
        {"city": "İzmir", "district": "Konak", "name": "İzmir Devlet Hastanesi", "lat": 38.4237, "lng": 27.1428},
        {"city": "Diyarbakır", "district": "Kayapınar", "name": "Diyarbakır Gazi Yaşargil Eğitim ve Araştırma Hastanesi", "lat": 37.9351, "lng": 40.1583},
        {"city": "Elazığ", "district": "Merkez", "name": "Fırat Üniversitesi Hastanesi", "lat": 38.6748, "lng": 39.2232},
        {"city": "Malatya", "district": "Battalgazi", "name": "Malatya Eğitim ve Araştırma Hastanesi", "lat": 38.3552, "lng": 38.3095}
    ]

    hospitals = []
    # Add explicit requested hospitals
    for hd in hospitals_data:
        h = Hospital(name=hd["name"], city=hd["city"], district=hd["district"], address=generate_turkish_address(hd["city"], hd["district"]), latitude=hd["lat"], longitude=hd["lng"], is_active=True)
        db.add(h)
        hospitals.append(h)

    # Add hospitals for other districts to ensure variety
    city_coords = {
        "Ankara": (39.9208, 32.8541),
        "İstanbul": (41.0082, 28.9784),
        "İzmir": (38.4192, 27.1287),
        "Diyarbakır": (37.9144, 40.2306),
        "Elazığ": (38.6810, 39.2264),
        "Malatya": (38.3552, 38.3095)
    }
    
    for city, dists in locations.items():
        for dist in dists:
            exists = any(h.city == city and h.district == dist for h in hospitals)
            if not exists:
                lat = city_coords[city][0] + random.uniform(-0.05, 0.05) if city in city_coords else None
                lng = city_coords[city][1] + random.uniform(-0.05, 0.05) if city in city_coords else None
                h = Hospital(name=f"{city} {dist} Devlet Hastanesi", city=city, district=dist, address=generate_turkish_address(city, dist), latitude=lat, longitude=lng, is_active=True)
                db.add(h)
                hospitals.append(h)
    db.commit()

    # DOCTORS
    doctors = []
    # Her hastanede her branştan en az 1 doktor olsun
    for h in hospitals:
        for b in branches:
            doctor = Doctor(
                full_name=fake.name(),
                title="Dr.",
                hospital_id=h.id,
                branch_id=b.id,
                is_active=True
            )
            db.add(doctor)
            doctors.append(doctor)
            
    # Biraz da rastgele fazladan doktor ekleyelim (çeşitlilik için)
    for _ in range(50):
        doctor = Doctor(
            full_name=fake.name(),
            title="Dr.",
            hospital_id=random.choice(hospitals).id,
            branch_id=random.choice(branches).id,
            is_active=True
        )
        db.add(doctor)
        doctors.append(doctor)
    db.commit()

    # SLOTS
    # Performansı korumak adına saatleri ve günleri optimum tutuyoruz
    times = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"]
    today = date.today()
    for doctor in doctors:
        for day_offset in range(0, 10): # Bugün + önümüzdeki 9 gün
            slot_date = today + timedelta(days=day_offset)
            for t in times:
                slot = AppointmentSlot(
                    doctor_id=doctor.id,
                    date=slot_date,
                    time=t,
                    is_booked=False,
                    is_active=True
                )
                db.add(slot)
        db.commit() # Commit per doctor to avoid large transactions and deadlocks

    # APPOINTMENTS
    # Yaklaşık %20'sini dolu yap (en az %70 boş kalsın istendi)
    all_slots = db.query(AppointmentSlot).all()
    num_to_book = int(len(all_slots) * 0.2)
    selected_slots = random.sample(all_slots, min(num_to_book, len(all_slots)))
    
    count = 0
    for s in selected_slots:
        u = random.choice(users)
        s.is_booked = True
        apt = Appointment(user_id=u.id, doctor_id=s.doctor_id, slot_id=s.id, status="active")
        db.add(apt)
        count += 1
        if count % 100 == 0:
            db.commit()
    db.commit()

    # FAMILY PHYSICIANS & SLOTS
    print("Seeding family physicians and slots...")
    times = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"]
    today = date.today()
    
    fps = []
    
    specific_fps = [
        {"name": "Dr. Ayşe Yılmaz", "city": "Elazığ", "district": "Merkez", "clinic": "Elazığ Merkez 1 Nolu Aile Sağlığı Merkezi"},
        {"name": "Dr. Mehmet Demir", "city": "Elazığ", "district": "Merkez", "clinic": "Elazığ Merkez 2 Nolu Aile Sağlığı Merkezi"},
        {"name": "Dr. Fatma Kaya", "city": "Malatya", "district": "Battalgazi", "clinic": "Battalgazi 3 Nolu Aile Sağlığı Merkezi"},
        {"name": "Dr. Ahmet Çelik", "city": "İstanbul", "district": "Kadıköy", "clinic": "Kadıköy 4 Nolu Aile Sağlığı Merkezi"}
    ]
    
    # Create the requested family physicians
    for fp_data in specific_fps:
        fp = FamilyPhysician(
            doctor_name=fp_data["name"],
            clinic_name=fp_data["clinic"],
            city=fp_data["city"],
            district=fp_data["district"]
        )
        db.add(fp)
        fps.append(fp)
        
    # Add a few more random ones for other cities
    for _ in range(10):
        city = random.choice(list(locations.keys()))
        dist = random.choice(locations[city])
        fp = FamilyPhysician(
            doctor_name="Dr. " + fake.name(),
            clinic_name=f"{city} {dist} Aile Sağlığı Merkezi",
            city=city,
            district=dist
        )
        db.add(fp)
        fps.append(fp)
        
    db.commit()

    for fp in fps:
        # Generate slots for this family physician
        for day_offset in range(0, 10): # Önümüzdeki 10 gün
            slot_date = today + timedelta(days=day_offset)
            for t in times:
                slot = AppointmentSlot(
                    family_physician_id=fp.id,
                    date=slot_date,
                    time=t,
                    is_booked=False,
                    is_active=True
                )
                db.add(slot)
        db.commit() # Commit per family physician

    # Assign family physicians to SOME users (leaving others null to test assignment flow)
    all_eligible_users = [admin] + users
    for u in all_eligible_users:
        if random.random() > 0.3: # 70% chance to have a family physician
            u.family_physician_id = random.choice(fps).id
            db.add(u)
    db.commit()
    print("Family physician seeding completed.")

    print("Seed completed successfully.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()

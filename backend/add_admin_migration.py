import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.user import User

def main():
    db = SessionLocal()
    try:
        # Check if test admin already exists
        admin = db.query(User).filter(User.tc_no == "99999999999").first()
        if not admin:
            admin = User(
                tc_no="99999999999",
                full_name="Sistem Yöneticisi",
                password_hash="1234", # Cleartext for demo as requested by user
                role="admin",
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("Admin user created successfully.")
        else:
            print("Admin user already exists.")
            
        # Optional: ensure role is admin just in case
        if admin.role != "admin":
            admin.role = "admin"
            db.commit()
            print("Admin role enforced.")
            
        # Ensure test normal user exists
        user = db.query(User).filter(User.tc_no == "11111111111").first()
        if not user:
            user = User(
                tc_no="11111111111",
                full_name="Neslihan Yılmaz",
                password_hash="1234",
                role="user",
                is_active=True
            )
            db.add(user)
            db.commit()
            print("Normal test user created successfully.")
        else:
            print("Normal test user already exists.")
            if user.role != "user":
                user.role = "user"
                db.commit()
                print("Normal test user role enforced.")
                
    except Exception as e:
        db.rollback()
        print("Error:", str(e))
    finally:
        db.close()

if __name__ == "__main__":
    main()

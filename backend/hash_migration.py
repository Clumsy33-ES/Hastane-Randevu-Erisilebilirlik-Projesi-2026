import os
import sys

# Ensure relative imports work if run directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user import User
from app.security import hash_password

def run_migration():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        count = 0
        for u in users:
            # If it's already a bcrypt hash, it starts with $2b$
            if not u.password_hash.startswith("$2b$"):
                print(f"Hashing password for user: {u.tc_no}")
                u.password_hash = hash_password(u.password_hash)
                count += 1
        db.commit()
        print(f"Migration completed. {count} passwords hashed.")
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()

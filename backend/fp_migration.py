from sqlalchemy import text
from app.database import engine, SessionLocal

def run_migration():
    if engine is None:
        print("Engine is None. Cannot run migration.")
        return

    print("Running Family Physician Schema Migration...")
    
    with engine.begin() as conn:
        try:
            # 1. Add family_physician_id to users
            # Using PostgreSQL syntax. Using IF NOT EXISTS is sometimes not natively supported without DO block, but let's try direct.
            # It's safer to just run it and catch exception if column exists.
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN family_physician_id INTEGER REFERENCES family_physicians(id)"))
                print("Added family_physician_id to users.")
            except Exception as e:
                print("Column family_physician_id might already exist in users:", e)
                
            # 2. Drop user_id from family_physicians
            try:
                conn.execute(text("ALTER TABLE family_physicians DROP COLUMN user_id"))
                print("Dropped user_id from family_physicians.")
            except Exception as e:
                print("Column user_id might already be dropped:", e)
                
        except Exception as e:
            print(f"Migration error: {e}")

if __name__ == "__main__":
    run_migration()
    print("Migration finished. Please run seed.py to populate.")

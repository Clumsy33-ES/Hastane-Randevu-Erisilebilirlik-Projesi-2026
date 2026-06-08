"""
app/database.py
PostgreSQL bağlantı altyapısı — SQLAlchemy 2.x + python-dotenv
"""
import os
import sys
import logging

logger = logging.getLogger(__name__)

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# .env dosyasını yükle (backend/ kök dizininden)
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logger.error(
        "\n[HATA] DATABASE_URL ortam değişkeni tanımlanmamış!\n"
        "  1. backend/.env.example dosyasını backend/.env olarak kopyalayın.\n"
        "  2. PostgreSQL bağlantı bilgilerinizi girin.\n"
        "  Örnek: DATABASE_URL=postgresql://postgres:sifre@localhost:5432/hospital_appointment_db\n"
    )
    # Uygulama import hatasıyla çökmemesi için engine=None olarak devam ediyoruz.
    # Endpoint'ler DB kullanmaya başladığında get_db() RuntimeError fırlatacak.
    engine = None
    SessionLocal = None
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,      # Kopuk bağlantıları otomatik tespit et
        pool_size=5,
        max_overflow=10,
        echo=False,              # SQL sorgularını loglamak için True yapılabilir
    )
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

# Tüm modeller bu Base'den türeyecek
Base = declarative_base()


def get_db():
    """
    FastAPI dependency — her istek için bağımsız bir DB oturumu sağlar.
    Kullanım:
        from app.database import get_db
        from sqlalchemy.orm import Session
        from fastapi import Depends

        @app.get("/ornek")
        def ornek(db: Session = Depends(get_db)):
            ...
    """
    if SessionLocal is None:
        raise RuntimeError(
            "Veritabanı bağlantısı yapılandırılmamış. "
            "Lütfen backend/.env dosyasını kontrol edin."
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection() -> bool:
    """
    Uygulama başlarken çağrılır. Bağlantı başarısızsa False döner, loglar.
    """
    if engine is None:
        return False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning(f"[UYARI] PostgreSQL bağlantısı kurulamadı: {exc}")
        logger.warning("  → Mock data ile devam ediliyor.")
        return False

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool


def _default_database_url() -> str:
    """Build a safer default DB URL depending on environment."""
    # Si existe disco persistente (Render: /var/data), priorizarlo siempre
    # para evitar pérdida de datos entre reinicios/deploys.
    if os.path.isdir("/var/data"):
        return "sqlite:////var/data/dashboard.db"
    return "sqlite:///./test.db"


def _normalize_database_url(raw_url: str) -> str:
    # Render provee postgres:// pero SQLAlchemy 2.x necesita postgresql+psycopg2://
    if raw_url.startswith("postgres://"):
        return raw_url.replace("postgres://", "postgresql+psycopg2://", 1)
    return raw_url


DATABASE_URL = _normalize_database_url(os.getenv("DATABASE_URL", _default_database_url()))

# SQLite necesita check_same_thread=False para funcionar con FastAPI (async/multihilo)
if DATABASE_URL.startswith("sqlite"):
    # Si el archivo SQLite está en una ruta local, creamos el directorio si no existe.
    sqlite_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if sqlite_path and sqlite_path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(sqlite_path)), exist_ok=True)

    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        # StaticPool se recomienda para in-memory; para archivo también funciona
        # y mantiene un comportamiento consistente en este proyecto.
        poolclass=StaticPool,
        echo=False,
    )
else:
    engine = create_engine(DATABASE_URL, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

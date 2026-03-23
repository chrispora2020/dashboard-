import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool


def _is_truthy(value: str | None) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _default_database_url() -> str:
    """Build a safer default DB URL depending on environment."""
    # Priorizar rutas persistentes conocidas antes de usar un archivo local del contenedor.
    persistent_candidates = (
        "/var/data/dashboard.db",  # Render Disk
        "/data/dashboard.db",      # Docker volume habitual en este repo
    )

    for candidate in persistent_candidates:
        parent = os.path.dirname(candidate)
        if os.path.isdir(parent):
            return f"sqlite:///{candidate}"

    # Último recurso: archivo local (puede perderse al reiniciar el contenedor).
    return "sqlite:///./test.db"


def _normalize_database_url(raw_url: str) -> str:
    # Render provee postgres:// pero SQLAlchemy 2.x necesita postgresql+psycopg2://
    if raw_url.startswith("postgres://"):
        return raw_url.replace("postgres://", "postgresql+psycopg2://", 1)
    return raw_url


def _mask_database_url(url: str) -> str:
    if "@" not in url or "://" not in url:
        return url

    scheme, rest = url.split("://", 1)
    creds_host = rest.split("@", 1)
    if len(creds_host) != 2:
        return url

    creds, host = creds_host
    if ":" not in creds:
        return url

    user = creds.split(":", 1)[0]
    return f"{scheme}://{user}:***@{host}"


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


def db_runtime_diagnostics() -> dict[str, str | bool]:
    is_sqlite = DATABASE_URL.startswith("sqlite")
    sqlite_path = DATABASE_URL.replace("sqlite:///", "", 1) if is_sqlite else ""
    is_persistent_sqlite = sqlite_path.startswith("/var/data/") or sqlite_path.startswith("/data/")
    is_ephemeral_sqlite = is_sqlite and not is_persistent_sqlite

    return {
        "database_url_masked": _mask_database_url(DATABASE_URL),
        "is_sqlite": is_sqlite,
        "sqlite_path": sqlite_path,
        "is_persistent_sqlite": is_persistent_sqlite,
        "is_ephemeral_sqlite": is_ephemeral_sqlite,
        "is_render": _is_truthy(os.getenv("RENDER")),
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

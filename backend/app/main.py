import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import init_db
from .routes_auth import router as auth_router
from .routes_files import router as files_router
from .routes_internal import router as internal_router
from .routes_conversos import router as conversos_router
from .routes_kpis import router as kpis_router
from .routes_jovenes import router as jovenes_router
from .routes_adultos import router as adultos_router
from .routes_misioneros import router as misioneros_router
from .routes_asistencia import router as asistencia_router
from .routes_lcr import router as lcr_router

app = FastAPI(title="KPI PDF Extractor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db.init()


app.include_router(auth_router, prefix="/api/auth")
app.include_router(files_router, prefix="/api/files")
app.include_router(internal_router, prefix="/api/internal")
app.include_router(conversos_router, prefix="/api")
app.include_router(kpis_router, prefix="/api")
app.include_router(jovenes_router, prefix="/api")
app.include_router(adultos_router, prefix="/api")
app.include_router(misioneros_router, prefix="/api")
app.include_router(asistencia_router, prefix="/api")
app.include_router(lcr_router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "message": "Dashboard API running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}

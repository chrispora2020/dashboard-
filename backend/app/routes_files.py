import os
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from . import db
from .models import PdfFile
import shutil
import uuid

router = APIRouter()

UPLOAD_DIR = os.getenv('UPLOAD_DIR', '/data/uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post('/')
async def upload_files(files: list[UploadFile] = File(...), period_id: str | None = None, db: Session = Depends(db.get_db)):
    # Limpiar tabla personas_conversos antes de importar
    from .models import PersonaConverso, PdfFile
    db.query(PersonaConverso).delete()
    db.query(PdfFile).delete()
    db.commit()

    # Limpiar tabla IndicadorKPI si existe
    try:
        from .models import IndicadorKPI
        db.query(IndicadorKPI).delete()
        db.commit()
    except Exception:
        pass

    saved = []
    for f in files:
        file_id = str(uuid.uuid4())
        dest_path = os.path.join(UPLOAD_DIR, f"{file_id}_{f.filename}")
        with open(dest_path, 'wb') as out:
            shutil.copyfileobj(f.file, out)
        pf = PdfFile(id=file_id, filename=f.filename, s3_path=dest_path, size_bytes=os.path.getsize(dest_path), mime=f.content_type)
        db.add(pf)
        saved.append({"id": file_id, "filename": f.filename, "status": pf.status})
    db.commit()
    # enqueue processing (simple: call Celery task by name)
    try:
        from .tasks import process_pdf
        for s in saved:
            process_pdf.delay(s['id'])
    except Exception:
        pass

    return JSONResponse(status_code=201, content={"files": saved})


@router.get('/')
def list_files(db: Session = Depends(db.get_db)):
    files = db.query(PdfFile).order_by(PdfFile.uploaded_at.desc()).limit(100).all()
    return [{"id": f.id, "filename": f.filename, "status": f.status, "uploaded_at": f.uploaded_at.isoformat()} for f in files]

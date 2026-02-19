from fastapi import APIRouter, Depends, HTTPException
from . import db
from .schemas import UserCreate, UserLogin, UserOut
from .models import User
from .auth import hash_password, verify_password, create_access_token
from sqlalchemy.orm import Session

router = APIRouter()


@router.post('/register')
def register(payload: UserCreate, db: Session = Depends(db.get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        raise HTTPException(status_code=400, detail='User exists')
    u = User(email=payload.email, password_hash=hash_password(payload.password), name=payload.name)
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"id": u.id, "email": u.email, "name": u.name}


@router.post('/login')
def login(payload: UserLogin, db: Session = Depends(db.get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    token = create_access_token(user.id)
    return {"access_token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}

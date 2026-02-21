import os
import bcrypt
from datetime import datetime, timedelta
from jose import jwt

JWT_SECRET = os.getenv("JWT_SECRET", "changeme")
JWT_ALGO = "HS256"
# Extend default session to reduce unexpected logouts in deployments.
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24 * 30)))


def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    pwd_bytes = password.encode('utf-8')
    hashed_bytes = hashed.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)


def create_access_token(subject: str, expires_delta: int = JWT_EXPIRE_MINUTES) -> str:
    expire = datetime.utcnow() + timedelta(minutes=expires_delta)
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGO)

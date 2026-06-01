from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import sqlite3
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta

SECRET_KEY = "teamspend-secret-key-2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

DB_PATH = "teamspend.db"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
    """)

    conn.commit()
    conn.close()


init_db()


def get_db():
    return sqlite3.connect(DB_PATH)


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)


def create_token(email: str, user_id: int):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    data = {
        "sub": email,
        "user_id": user_id,
        "exp": expire
    }

    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


@app.get("/")
def home():
    return {"message": "TeamSpend API działa"}


@app.post("/auth/register", status_code=201)
def register(user: UserRegister):
    if len(user.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Hasło musi mieć minimum 6 znaków"
        )

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id FROM users WHERE email = ?",
        (user.email,)
    )

    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Email już istnieje"
        )

    password_hash = hash_password(user.password)

    cursor.execute(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    (user.name, user.email, password_hash)
)

    conn.commit()
    conn.close()

    return {
        "message": "Użytkownik został zarejestrowany pomyślnie"
    }


@app.post("/auth/login")
def login(user: UserLogin):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, name, email, password_hash FROM users WHERE email = ?",
        (user.email,)
    )

    db_user = cursor.fetchone()
    conn.close()

    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="Nieprawidłowy email lub hasło"
        )

    if not verify_password(user.password, db_user[3]):
        raise HTTPException(
            status_code=401,
            detail="Nieprawidłowy email lub hasło"
        )

    token = create_token(db_user[2], db_user[0])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": db_user[0],
        "name": db_user[1],
        "email": db_user[2]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001, reload=True)
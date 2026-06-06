from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from database import get_db, init_db
from expenses_service import register_expense_routes
from team_service import register_team_routes

SECRET_KEY = "teamspend-secret-key-2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

init_db()

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


def get_current_user_from_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Brak tokenu autoryzacyjnego lub token jest niepoprawny"
        )

    token = authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id = payload.get("user_id")
        email = payload.get("sub")

        if user_id is None or email is None:
            raise HTTPException(status_code=401, detail="Nieprawidłowy token")

        return {
            "user_id": user_id,
            "email": email
        }

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Token wygasł lub jest nieprawidłowy"
        )


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

    user_id = cursor.lastrowid

    conn.commit()
    conn.close()

    token = create_token(user.email, user_id)

    return {
        "message": "Użytkownik został zarejestrowany pomyślnie",
        "access_token": token,
        "token_type": "bearer",
        "user_id": user_id,
        "name": user.name,
        "email": user.email
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

    if not db_user or not verify_password(user.password, db_user[3]):
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


register_expense_routes(app, get_db, get_current_user_from_token)
register_team_routes(app, get_db, get_current_user_from_token)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001, reload=True)
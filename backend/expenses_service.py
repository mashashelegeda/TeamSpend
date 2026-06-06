from fastapi import Header, HTTPException
from pydantic import BaseModel


class ExpenseCreate(BaseModel):
    name: str
    amount: float
    category: str
    date: str
    team_id: int


def check_user_in_team(cursor, user_id, team_id):
    cursor.execute(
        "SELECT id FROM team_members WHERE user_id = ? AND team_id = ?",
        (user_id, team_id)
    )

    if not cursor.fetchone():
        raise HTTPException(
            status_code=403,
            detail="Użytkownik nie należy do tego zespołu"
        )


def register_expense_routes(app, get_db, get_current_user_from_token):

    @app.get("/expenses")
    def get_expenses(team_id: int, authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        user_id = user_info["user_id"]

        conn = get_db()
        cursor = conn.cursor()

        check_user_in_team(cursor, user_id, team_id)

        cursor.execute("""
            SELECT id, team_id, user_id, user_name, name, amount, category, date
            FROM expenses
            WHERE team_id = ?
        """, (team_id,))

        rows = cursor.fetchall()
        conn.close()

        expenses = []

        for row in rows:
            expenses.append({
                "id": row[0],
                "team_id": row[1],
                "user_id": row[2],
                "user_name": row[3],
                "name": row[4],
                "amount": row[5],
                "category": row[6],
                "date": row[7]
            })

        return expenses

    @app.post("/expenses", status_code=201)
    def add_expense(expense: ExpenseCreate, authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        user_id = user_info["user_id"]

        conn = get_db()
        cursor = conn.cursor()

        team_id = expense.team_id

        check_user_in_team(cursor, user_id, team_id)

        cursor.execute(
            "SELECT name FROM users WHERE id = ?",
            (user_id,)
        )

        user_row = cursor.fetchone()

        if not user_row:
            conn.close()
            raise HTTPException(
                status_code=404,
                detail="Nie znaleziono użytkownika"
            )

        user_name = user_row[0]

        cursor.execute(
            """
            INSERT INTO expenses (team_id, user_id, user_name, name, amount, category, date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                team_id,
                user_id,
                user_name,
                expense.name,
                expense.amount,
                expense.category,
                expense.date
            )
        )

        conn.commit()
        conn.close()

        return {"message": "Wydatek został dodany"}

    @app.put("/expenses/{expense_id}")
    def update_expense(expense_id: int, expense: ExpenseCreate, authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        user_id = user_info["user_id"]

        conn = get_db()
        cursor = conn.cursor()

        team_id = expense.team_id

        check_user_in_team(cursor, user_id, team_id)

        cursor.execute(
            "SELECT id FROM expenses WHERE id = ? AND team_id = ?",
            (expense_id, team_id)
        )

        if not cursor.fetchone():
            conn.close()
            raise HTTPException(
                status_code=404,
                detail="Nie znaleziono wydatku o podanym ID"
            )

        cursor.execute(
            """
            UPDATE expenses
            SET name = ?, amount = ?, category = ?, date = ?
            WHERE id = ? AND team_id = ?
            """,
            (
                expense.name,
                expense.amount,
                expense.category,
                expense.date,
                expense_id,
                team_id
            )
        )

        conn.commit()
        conn.close()

        return {"message": "Wydatek został pomyślnie zaktualizowany"}

    @app.delete("/expenses/{expense_id}")
    def delete_expense(expense_id: int, team_id: int, authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        user_id = user_info["user_id"]

        conn = get_db()
        cursor = conn.cursor()

        check_user_in_team(cursor, user_id, team_id)

        cursor.execute(
            "DELETE FROM expenses WHERE id = ? AND team_id = ?",
            (expense_id, team_id)
        )

        conn.commit()
        conn.close()

        return {"message": "Wydatek został pomyślnie usunięty"}
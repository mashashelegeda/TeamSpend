from fastapi import Header, HTTPException
from pydantic import BaseModel, EmailStr


class TeamCreate(BaseModel):
    name: str


class InvitationCreate(BaseModel):
    email: EmailStr


def register_team_routes(app, get_db, get_current_user_from_token):
    
    @app.get("/teams")
    def get_my_teams(authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        user_id = user_info["user_id"]

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT teams.id, teams.name, team_members.role
            FROM team_members
            JOIN teams ON team_members.team_id = teams.id
            WHERE team_members.user_id = ?
        """, (user_id,))

        rows = cursor.fetchall()
        conn.close()

        teams = []

        for row in rows:
            teams.append({
                "id": row[0],
                "name": row[1],
                "role": row[2]
            })

        return teams

    @app.post("/teams", status_code=201)
    def create_team(team: TeamCreate, authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        user_id = user_info["user_id"]

        if not team.name.strip():
            raise HTTPException(
                status_code=400,
                detail="Nazwa zespołu nie może być pusta"
            )

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO teams (name, owner_id) VALUES (?, ?)",
            (team.name, user_id)
        )

        team_id = cursor.lastrowid

        cursor.execute(
            "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)",
            (team_id, user_id, "owner")
        )

        conn.commit()
        conn.close()

        return {
            "message": "Zespół został utworzony",
            "team_id": team_id,
            "team_name": team.name
        }

    @app.get("/teams/my")
    def get_my_team(authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        user_id = user_info["user_id"]

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT teams.id, teams.name, team_members.role
            FROM team_members
            JOIN teams ON team_members.team_id = teams.id
            WHERE team_members.user_id = ?
        """, (user_id,))

        team = cursor.fetchone()
        conn.close()

        if not team:
            return {
                "has_team": False
            }

        return {
            "has_team": True,
            "team_id": team[0],
            "team_name": team[1],
            "role": team[2]
        }

    @app.get("/teams/invitations")
    def get_invitations(authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        user_id = user_info["user_id"]

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT team_invitations.id, teams.name
            FROM team_invitations
            JOIN teams ON team_invitations.team_id = teams.id
            WHERE team_invitations.invited_user_id = ?
            AND team_invitations.status = 'pending'
        """, (user_id,))

        rows = cursor.fetchall()
        conn.close()

        invitations = []

        for row in rows:
            invitations.append({
                "id": row[0],
                "team_name": row[1]
            })

        return invitations

    @app.post("/teams/invitations/{invitation_id}/accept")
    def accept_invitation(invitation_id: int, authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        user_id = user_info["user_id"]

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, team_id
            FROM team_invitations
            WHERE id = ?
            AND invited_user_id = ?
            AND status = 'pending'
        """, (invitation_id, user_id))

        invitation = cursor.fetchone()

        if not invitation:
            conn.close()
            raise HTTPException(
                status_code=404,
                detail="Nie znaleziono zaproszenia"
            )

        team_id = invitation[1]

        cursor.execute(
            "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)",
            (team_id, user_id, "member")
        )

        cursor.execute(
            "UPDATE team_invitations SET status = 'accepted' WHERE id = ?",
            (invitation_id,)
        )

        conn.commit()
        conn.close()

        return {
            "message": "Dołączono do zespołu"
        }

    @app.post("/teams/invitations/{invitation_id}/reject")
    def reject_invitation(invitation_id: int, authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        user_id = user_info["user_id"]

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id
            FROM team_invitations
            WHERE id = ?
            AND invited_user_id = ?
            AND status = 'pending'
        """, (invitation_id, user_id))

        invitation = cursor.fetchone()

        if not invitation:
            conn.close()
            raise HTTPException(
                status_code=404,
                detail="Nie znaleziono zaproszenia"
            )

        cursor.execute(
            "UPDATE team_invitations SET status = 'rejected' WHERE id = ?",
            (invitation_id,)
        )

        conn.commit()
        conn.close()

        return {
            "message": "Zaproszenie zostało odrzucone"
        }

    @app.post("/teams/{team_id}/invite")
    def invite_user(team_id: int, invitation: InvitationCreate, authorization: str = Header(None)):
        user_info = get_current_user_from_token(authorization)
        owner_id = user_info["user_id"]

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT role
            FROM team_members
            WHERE team_id = ?
            AND user_id = ?
        """, (team_id, owner_id))

        member = cursor.fetchone()

        if not member or member[0] != "owner":
            conn.close()
            raise HTTPException(
                status_code=403,
                detail="Tylko właściciel zespołu może zapraszać użytkowników"
            )

        cursor.execute(
            "SELECT id FROM users WHERE email = ?",
            (invitation.email,)
        )

        invited_user = cursor.fetchone()

        if not invited_user:
            conn.close()
            raise HTTPException(
                status_code=404,
                detail="Nie znaleziono użytkownika z takim emailem"
            )

        invited_user_id = invited_user[0]

        if invited_user_id == owner_id:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Nie możesz zaprosić samego siebie"
            )

        cursor.execute("""
            SELECT id
            FROM team_members
            WHERE team_id = ?
            AND user_id = ?
        """, (team_id, invited_user_id))

        already_member = cursor.fetchone()

        if already_member:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Ten użytkownik już należy do zespołu"
            )

        cursor.execute("""
            SELECT id
            FROM team_invitations
            WHERE team_id = ?
            AND invited_user_id = ?
            AND status = 'pending'
        """, (team_id, invited_user_id))

        existing_invitation = cursor.fetchone()

        if existing_invitation:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Zaproszenie już istnieje"
            )

        cursor.execute(
            "INSERT INTO team_invitations (team_id, invited_user_id) VALUES (?, ?)",
            (team_id, invited_user_id)
        )

        conn.commit()
        conn.close()

        return {
            "message": "Zaproszenie zostało wysłane"
        }
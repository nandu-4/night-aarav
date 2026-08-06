from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import current_user, hash_password, make_token, verify_password
from db import users
from services.portal import log_activity

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def login(payload: LoginRequest):
    user = await users.find_one({"email": payload.email.lower().strip()})
    if not user or not verify_password(payload.password, user.get("pw_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await log_activity(user["email"], "login", "Signed in to SkillForge")
    return {
        "token": make_token(user),
        "user": {"email": user["email"], "name": user["name"], "role": user["role"],
                 "resource_code": user.get("resource_code"), "department": user.get("department")},
    }


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return user


@router.post("/change-password")
async def change_password(payload: ChangePasswordRequest, user: dict = Depends(current_user)):
    row = await users.find_one({"email": user["email"]})
    if not verify_password(payload.current_password, row.get("pw_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    await users.update_one({"email": user["email"]}, {"$set": {"pw_hash": hash_password(payload.new_password)}})
    return {"ok": True}

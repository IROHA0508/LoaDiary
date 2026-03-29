from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.db.supabase_client import supabase

router = APIRouter()


# ── 헬퍼 ────────────────────────────────────────────────────
def _resolve_user_id(fingerprint: str) -> str:
    result = (
        supabase.table("users")
        .select("id")
        .eq("fingerprint", fingerprint)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    return result.data[0]["id"]


def _get_group_with_members(group_id: str) -> dict:
    """그룹 + 멤버 목록 조합하여 반환"""
    group = supabase.table("groups").select("*").eq("id", group_id).execute()
    if not group.data:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    g = group.data[0]

    members_rows = (
        supabase.table("group_members")
        .select("id, user_id, created_at")
        .eq("group_id", group_id)
        .execute()
    ).data or []

    member_user_ids = [m["user_id"] for m in members_rows]
    users_info = {}
    if member_user_ids:
        users_rows = (
            supabase.table("users")
            .select("id, representative")
            .in_("id", member_user_ids)
            .execute()
        ).data or []
        users_info = {u["id"]: u["representative"] for u in users_rows}

    g["members"] = [
        {
            "member_row_id": m["id"],
            "user_id": m["user_id"],
            "representative": users_info.get(m["user_id"], ""),
        }
        for m in members_rows
    ]
    return g


# ── 스키마 ──────────────────────────────────────────────────
class GroupCreate(BaseModel):
    fingerprint: str


class GroupNameUpdate(BaseModel):
    name: str


class MemberAdd(BaseModel):
    representative: str   # 원정대 대표 캐릭터명으로 유저 검색


# ── 엔드포인트 ───────────────────────────────────────────────

# 내 그룹 목록 조회 (멤버 포함)
@router.get("/{fingerprint}")
def get_my_groups(fingerprint: str):
    user_id = _resolve_user_id(fingerprint)
    groups = (
        supabase.table("groups")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    ).data or []

    result = []
    for g in groups:
        members_rows = (
            supabase.table("group_members")
            .select("id, user_id")
            .eq("group_id", g["id"])
            .execute()
        ).data or []

        member_user_ids = [m["user_id"] for m in members_rows]
        users_info = {}
        if member_user_ids:
            users_rows = (
                supabase.table("users")
                .select("id, representative")
                .in_("id", member_user_ids)
                .execute()
            ).data or []
            users_info = {u["id"]: u["representative"] for u in users_rows}

        g["members"] = [
            {
                "member_row_id": m["id"],
                "user_id": m["user_id"],
                "representative": users_info.get(m["user_id"], ""),
            }
            for m in members_rows
        ]
        result.append(g)

    return result


# 그룹 생성 (자동 이름: 그룹1, 그룹2, ...)
@router.post("/", status_code=201)
def create_group(payload: GroupCreate):
    user_id = _resolve_user_id(payload.fingerprint)
    if payload.name and payload.name.strip():
        group_name = payload.name.strip()
    else:
        existing = supabase.table("groups").select("id", count="exact").eq("user_id", user_id).execute()
        count = existing.count or 0
        group_name = f"그룹{count + 1}"
    result = supabase.table("groups").insert({"user_id": user_id, "name": group_name}).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="그룹 생성에 실패했습니다.")
    g = result.data[0]
    g["members"] = []
    return g


# 그룹 이름 수정
@router.patch("/{group_id}")
def update_group_name(group_id: str, payload: GroupNameUpdate):
    result = (
        supabase.table("groups")
        .update({"name": payload.name.strip()})
        .eq("id", group_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    return result.data[0]


# 그룹 삭제
@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: str):
    supabase.table("groups").delete().eq("id", group_id).execute()


# 멤버 추가 (대표 캐릭터명으로 검색)
@router.post("/{group_id}/members", status_code=201)
def add_member(group_id: str, payload: MemberAdd):
    # 대표 캐릭터명으로 유저 검색
    user_result = (
        supabase.table("users")
        .select("id, representative")
        .eq("representative", payload.representative.strip())
        .execute()
    )
    if not user_result.data:
        raise HTTPException(status_code=404, detail="해당 원정대를 찾을 수 없습니다.")

    target_user_id = user_result.data[0]["id"]

    # 이미 멤버인지 확인
    existing = (
        supabase.table("group_members")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", target_user_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="이미 그룹에 포함된 원정대입니다.")

    result = (
        supabase.table("group_members")
        .insert({"group_id": group_id, "user_id": target_user_id})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="멤버 추가에 실패했습니다.")

    return _get_group_with_members(group_id)


# 멤버 제거
@router.delete("/{group_id}/members/{member_row_id}", status_code=204)
def remove_member(group_id: str, member_row_id: str):
    supabase.table("group_members").delete().eq("id", member_row_id).execute()
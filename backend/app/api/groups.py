from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.db.supabase_client import supabase

router = APIRouter()


def _resolve_user_id(fingerprint: str) -> str:
    result = supabase.table("users").select("id").eq("fingerprint", fingerprint).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    return result.data[0]["id"]


def _build_group_with_members(g: dict) -> dict:
    """그룹 dict에 members 리스트 붙여서 반환 (sort_order 순)"""
    members_rows = (
        supabase.table("group_members")
        .select("id, user_id, sort_order")
        .eq("group_id", g["id"])
        .order("sort_order")
        .execute()
    ).data or []
    member_user_ids = [m["user_id"] for m in members_rows]
    users_info = {}
    if member_user_ids:
        users_rows = (
            supabase.table("users").select("id, representative").in_("id", member_user_ids).execute()
        ).data or []
        users_info = {u["id"]: u["representative"] for u in users_rows}
    g["members"] = [
        {
            "member_row_id": m["id"],
            "user_id": m["user_id"],
            "representative": users_info.get(m["user_id"], ""),
            "sort_order": m["sort_order"],
        }
        for m in members_rows
    ]
    return g


# ── 스키마 ──────────────────────────────────────────────────
class GroupCreate(BaseModel):
    fingerprint: str
    name: Optional[str] = None

class GroupNameUpdate(BaseModel):
    name: str

class MemberAdd(BaseModel):
    representative: str

class MemberReorder(BaseModel):
    member_ids: List[str]

class GroupReorder(BaseModel):
    fingerprint: str
    group_ids: List[str]


# ── 엔드포인트 ───────────────────────────────────────────────

# 내 그룹 목록 조회 (sort_order 순)
@router.get("/{fingerprint}")
def get_my_groups(fingerprint: str):
    user_id = _resolve_user_id(fingerprint)
    groups = (
        supabase.table("groups")
        .select("*")
        .eq("user_id", user_id)
        .order("sort_order")
        .execute()
    ).data or []
    return [_build_group_with_members(g) for g in groups]


# 그룹 생성 (이름 직접 지정 or 자동)
@router.post("/", status_code=201)
def create_group(payload: GroupCreate):
    user_id = _resolve_user_id(payload.fingerprint)
    if payload.name and payload.name.strip():
        group_name = payload.name.strip()
    else:
        existing = supabase.table("groups").select("id", count="exact").eq("user_id", user_id).execute()
        count = existing.count or 0
        group_name = f"그룹{count + 1}"

    # sort_order = 현재 그룹 수 (마지막에 추가)
    count_result = supabase.table("groups").select("id", count="exact").eq("user_id", user_id).execute()
    sort_order = count_result.count or 0

    result = supabase.table("groups").insert({
        "user_id": user_id, "name": group_name, "sort_order": sort_order
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="그룹 생성에 실패했습니다.")
    g = result.data[0]
    g["members"] = []
    return g


# 그룹 이름 수정
@router.patch("/{group_id}")
def update_group_name(group_id: str, payload: GroupNameUpdate):
    result = supabase.table("groups").update({"name": payload.name.strip()}).eq("id", group_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    return result.data[0]


# 그룹 순서 변경
@router.patch("/reorder")
def reorder_groups(payload: GroupReorder):
    user_id = _resolve_user_id(payload.fingerprint)
    for i, group_id in enumerate(payload.group_ids):
        supabase.table("groups").update({"sort_order": i}).eq("id", group_id).eq("user_id", user_id).execute()
    return {"ok": True}


# 그룹 삭제
@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: str):
    supabase.table("groups").delete().eq("id", group_id).execute()


# 멤버 추가
@router.post("/{group_id}/members", status_code=201)
def add_member(group_id: str, payload: MemberAdd):
    user_result = (
        supabase.table("users").select("id").eq("representative", payload.representative.strip()).execute()
    )
    if not user_result.data:
        raise HTTPException(status_code=404, detail="해당 대표 캐릭터를 찾을 수 없어요. 캐릭터명을 다시 확인해주세요.")

    target_user_id = user_result.data[0]["id"]
    existing = supabase.table("group_members").select("id").eq("group_id", group_id).eq("user_id", target_user_id).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="이미 그룹에 포함된 멤버입니다.")

    count_result = supabase.table("group_members").select("id", count="exact").eq("group_id", group_id).execute()
    sort_order = count_result.count or 0

    result = supabase.table("group_members").insert({
        "group_id": group_id, "user_id": target_user_id, "sort_order": sort_order
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="멤버 추가에 실패했습니다.")

    g = supabase.table("groups").select("*").eq("id", group_id).execute().data[0]
    return _build_group_with_members(g)


# 멤버 순서 변경
@router.patch("/{group_id}/members/reorder")
def reorder_members(group_id: str, payload: MemberReorder):
    for i, member_row_id in enumerate(payload.member_ids):
        supabase.table("group_members").update({"sort_order": i}).eq("id", member_row_id).execute()
    g = supabase.table("groups").select("*").eq("id", group_id).execute().data[0]
    return _build_group_with_members(g)


# 멤버 제거
@router.delete("/{group_id}/members/{member_row_id}", status_code=204)
def remove_member(group_id: str, member_row_id: str):
    supabase.table("group_members").delete().eq("id", member_row_id).execute()
    remaining = (
        supabase.table("group_members").select("id").eq("group_id", group_id).order("sort_order").execute()
    ).data or []
    for i, row in enumerate(remaining):
        supabase.table("group_members").update({"sort_order": i}).eq("id", row["id"]).execute()
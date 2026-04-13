from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.db.supabase_client import supabase
from app.lostark import resolve_or_create_user_by_character_name

router = APIRouter()


def _resolve_user_id(fingerprint: str) -> str:
    result = supabase.table("users").select("id").eq("fingerprint", fingerprint).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    return result.data[0]["id"]


def _build_group_with_members(g: dict) -> dict:
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

@router.get("/{fingerprint}")
def get_my_groups(fingerprint: str):
    try:
        user_id = _resolve_user_id(fingerprint)
        print(f"[DEBUG] resolved user_id: {user_id}")
    except HTTPException as e:
        print(f"[DEBUG] _resolve_user_id FAILED: {e.detail}")
        return []

    member_rows = (
        supabase.table("group_members")
        .select("group_id")
        .eq("user_id", user_id)
        .execute()
    ).data or []
    print(f"[DEBUG] group_members rows: {member_rows}")

    group_ids = list({m["group_id"] for m in member_rows})

    if not group_ids:
        print(f"[DEBUG] no group_ids found for user_id: {user_id}")
        return []


@router.post("/", status_code=201)
def create_group(payload: GroupCreate):
    user_id = _resolve_user_id(payload.fingerprint)
    if payload.name and payload.name.strip():
        group_name = payload.name.strip()
    else:
        existing = supabase.table("groups").select("id", count="exact").eq("user_id", user_id).execute()
        count = existing.count or 0
        group_name = f"그룹{count + 1}"

    count_result = supabase.table("groups").select("id", count="exact").eq("user_id", user_id).execute()
    sort_order = count_result.count or 0

    result = supabase.table("groups").insert({
        "user_id": user_id, "name": group_name, "sort_order": sort_order
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="그룹 생성에 실패했습니다.")
    g = result.data[0]

    # 그룹 생성자를 자동으로 첫 번째 멤버로 추가
    supabase.table("group_members").insert({
        "group_id": g["id"],
        "user_id": user_id,
        "sort_order": 0,
    }).execute()

    return _build_group_with_members(g)

@router.patch("/reorder")
def reorder_groups(payload: GroupReorder):
    user_id = _resolve_user_id(payload.fingerprint)
    for i, group_id in enumerate(payload.group_ids):
        supabase.table("groups").update({"sort_order": i}).eq("id", group_id).eq("user_id", user_id).execute()
    return {"ok": True}

@router.patch("/{group_id}")
def update_group_name(group_id: str, payload: GroupNameUpdate):
    result = supabase.table("groups").update({"name": payload.name.strip()}).eq("id", group_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    return result.data[0]

@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: str):
    supabase.table("groups").delete().eq("id", group_id).execute()


# ── 멤버 추가: LoA API로 캐릭터 검증 + 원정대 식별 ──────
@router.post("/{group_id}/members", status_code=201)
async def add_member(group_id: str, payload: MemberAdd):
    # 공통 헬퍼 호출:
    # ① DB exact match → ② LoA API siblings 조회 → ③ 같은 원정대 유저 탐색 → ④ 임시 유저 생성
    user = await resolve_or_create_user_by_character_name(payload.representative)
    target_user_id = user["id"]

    existing = (
        supabase.table("group_members").select("id")
        .eq("group_id", group_id).eq("user_id", target_user_id).execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="이미 그룹에 포함된 멤버입니다.")

    count_result = (
        supabase.table("group_members").select("id", count="exact").eq("group_id", group_id).execute()
    )
    sort_order = count_result.count or 0

    result = supabase.table("group_members").insert({
        "group_id": group_id,
        "user_id": target_user_id,
        "sort_order": sort_order,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="멤버 추가에 실패했습니다.")

    g = supabase.table("groups").select("*").eq("id", group_id).execute().data[0]
    return _build_group_with_members(g)


@router.patch("/{group_id}/members/reorder")
def reorder_members(group_id: str, payload: MemberReorder):
    for i, member_row_id in enumerate(payload.member_ids):
        supabase.table("group_members").update({"sort_order": i}).eq("id", member_row_id).execute()
    g = supabase.table("groups").select("*").eq("id", group_id).execute().data[0]
    return _build_group_with_members(g)


@router.delete("/{group_id}/members/{member_row_id}", status_code=204)
def remove_member(group_id: str, member_row_id: str):
    supabase.table("group_members").delete().eq("id", member_row_id).execute()
    remaining = (
        supabase.table("group_members").select("id").eq("group_id", group_id).order("sort_order").execute()
    ).data or []
    for i, row in enumerate(remaining):
        supabase.table("group_members").update({"sort_order": i}).eq("id", row["id"]).execute()
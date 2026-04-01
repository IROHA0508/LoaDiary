from fastapi import APIRouter, HTTPException, Query
from app.schemas import UserCreate, UserResponse
from app.db.supabase_client import supabase
from typing import List
from pydantic import BaseModel

router = APIRouter()

# 유저 생성/조회 (온보딩)
@router.post("/", response_model=UserResponse, status_code=201)
def create_or_get_user(payload: UserCreate):
  # 1. 동일 representative 임시 유저 → fingerprint 부여
  temp_user = (
    supabase.table("users")
    .select("*")
    .eq("representative", payload.representative)
    .is_("fingerprint", "null")
    .execute()
  )
  if temp_user.data:
    updated = (
      supabase.table("users")
      .update({"fingerprint": payload.fingerprint})
      .eq("id", temp_user.data[0]["id"])
      .execute()
    )
    return updated.data[0]

  # 2. fingerprint로 기존 유저 확인
  existing = (
    supabase.table("users")
    .select("*")
    .eq("fingerprint", payload.fingerprint)
    .execute()
  )
  if existing.data:
    if existing.data[0]["representative"] != payload.representative:
      updated = (
        supabase.table("users")
        .update({"representative": payload.representative})
        .eq("id", existing.data[0]["id"])
        .execute()
      )
      return updated.data[0]
    return existing.data[0]

  # 3. 새 유저 생성
  result = (
    supabase.table("users")
    .insert({"fingerprint": payload.fingerprint, "representative": payload.representative})
    .execute()
  )
  if not result.data:
    raise HTTPException(status_code=500, detail="유저 생성에 실패했습니다.")
  return result.data[0]

# ── 대표 캐릭터명 목록으로 캐릭터 일괄 조회 (DB only, LoA API 호출 없음) ──
# 자동 로드(최근 검색, 그룹 멤버) 전용 엔드포인트
# 반드시 /{fingerprint} 보다 먼저 선언
@router.get("/characters-by-representatives")
async def get_characters_by_representatives(reps: str = Query(...)):
    rep_list = [r.strip() for r in reps.split(",") if r.strip()]
    if not rep_list:
        return []

    # 1. 대표 캐릭터명으로 유저 배치 조회 (1 query)
    users_result = (
        supabase.table("users")
        .select("id, representative")
        .in_("representative", rep_list)
        .execute()
    )
    users = users_result.data or []
    if not users:
        return []

    user_ids = [u["id"] for u in users]

    # 2. 캐릭터 배치 조회 (1 query)
    chars_result = (
        supabase.table("characters")
        .select("*")
        .in_("user_id", user_ids)
        .order("item_level", desc=True)
        .execute()
    )

    # user_id 기준으로 캐릭터 그룹핑
    chars_by_user: dict = {}
    for row in (chars_result.data or []):
        uid = row["user_id"]
        row["class_name"] = row.pop("class", None)
        chars_by_user.setdefault(uid, []).append(row)

    # 3. 조립 — rep_list 순서 유지
    rep_to_user = {u["representative"]: u for u in users}
    result = []
    for rep in rep_list:
        user = rep_to_user.get(rep)
        if not user:
            continue
        result.append({
            "user_id": user["id"],
            "representative": user["representative"],
            "characters": chars_by_user.get(user["id"], []),
        })

    return result

# ── 캐릭터명으로 원정대 대표 캐릭터 해석 (프론트 검증용) ──
# 반드시 /{fingerprint} 보다 먼저 선언해야 라우트 충돌이 없음
@router.get("/resolve")
async def resolve_user_by_character_name(character_name: str = Query(...)):
    # 1단계: DB에서 먼저 검색 (빠름)
    existing = (
        supabase.table("characters")
        .select("user_id, name")
        .eq("name", character_name)
        .limit(1)
        .execute()
    )
    if existing.data:
        user_id = existing.data[0]["user_id"]
        user = supabase.table("users").select("*").eq("id", user_id).execute()
        if user.data:
            return user.data[0]
    
    # 2단계: DB에 없을 때만 외부 API 호출
    from app.lostark import resolve_or_create_user_by_character_name
    user = await resolve_or_create_user_by_character_name(character_name)
    return user


# 대표 캐릭터명 exact match 조회 — /{fingerprint} 보다 먼저 선언
@router.get("/search/by-representative", response_model=UserResponse)
def search_user_by_representative(representative: str = Query(...)):
  result = (
    supabase.table("users")
    .select("*")
    .eq("representative", representative)
    .execute()
  )
  if not result.data:
    raise HTTPException(status_code=404, detail="해당 대표 캐릭터를 가진 유저를 찾을 수 없습니다.")
  return result.data[0]


# 유저 조회 (fingerprint 기준) — 반드시 고정 경로들 아래에 선언
@router.get("/{fingerprint}", response_model=UserResponse)
def get_user(fingerprint: str):
  result = (
    supabase.table("users")
    .select("*")
    .eq("fingerprint", fingerprint)
    .execute()
  )
  if not result.data:
    raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
  return result.data[0]

class RaidOrderUpdate(BaseModel):
    raid_ids: List[str]

# 레이드 순서 조회
@router.get("/{fingerprint}/raid-order")
def get_raid_order(fingerprint: str):
    result = (
        supabase.table("users")
        .select("raid_order")
        .eq("fingerprint", fingerprint)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    return {"raid_order": result.data[0].get("raid_order") or []}


# 레이드 순서 저장
@router.patch("/{fingerprint}/raid-order")
def save_raid_order(fingerprint: str, payload: RaidOrderUpdate):
    result = (
        supabase.table("users")
        .update({"raid_order": payload.raid_ids})
        .eq("fingerprint", fingerprint)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    return {"ok": True}
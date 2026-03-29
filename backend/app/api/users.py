from fastapi import APIRouter, HTTPException, Query
from app.schemas import UserCreate, UserResponse
from app.db.supabase_client import supabase

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


# ── 캐릭터명으로 원정대 대표 캐릭터 해석 (프론트 검증용) ──
# 반드시 /{fingerprint} 보다 먼저 선언해야 라우트 충돌이 없음
@router.get("/resolve")
async def resolve_user_by_character_name(character_name: str = Query(...)):
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
from fastapi import APIRouter, HTTPException, Query
from app.schemas import UserCreate, UserResponse
from app.db.supabase_client import supabase

# 라우터 인스턴스 생성
router = APIRouter()

# 유저 생성/조회 엔드포인트 (온보딩)
# 1. 동일 representative로 임시 유저가 있으면 → fingerprint 업데이트 (임시 → 정식)
# 2. fingerprint로 기존 유저가 있으면 → representative 업데이트 후 반환
# 3. 둘 다 없으면 → 새로 생성
@router.post("/", response_model=UserResponse, status_code=201)
def create_or_get_user(payload: UserCreate):
  # 1. 동일 representative로 임시 등록된 유저 확인 (fingerprint가 null인 경우)
  temp_user = (
    supabase.table("users")
    .select("*")
    .eq("representative", payload.representative)
    .is_("fingerprint", "null")
    .execute()
  )

  if temp_user.data:
    # 임시 유저에 fingerprint 부여 (정식 가입)
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
    # 대표 캐릭터명이 바뀐 경우 업데이트
    if existing.data[0]["representative"] != payload.representative:
      updated = (
        supabase.table("users")
        .update({"representative": payload.representative})
        .eq("id", existing.data[0]["id"])
        .execute()
      )
      return updated.data[0]
    return existing.data[0]

  # 3. 완전히 새로운 유저 생성
  result = (
    supabase.table("users")
    .insert({"fingerprint": payload.fingerprint, "representative": payload.representative})
    .execute()
  )

  if not result.data:
    raise HTTPException(status_code=500, detail="유저 생성에 실패했습니다.")

  return result.data[0]

# 유저 조회 (fingerprint 기준)
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

# 대표 캐릭터명으로 유저 검색
# GET /api/users/search/by-representative?representative=홍길동
@router.get("/search/by-representative", response_model=UserResponse)
def search_user_by_representative(representative: str = Query(..., description="대표 캐릭터명")):
  result = (
    supabase.table("users")
    .select("*")
    .eq("representative", representative)
    .execute()
  )

  if not result.data:
    raise HTTPException(status_code=404, detail="해당 대표 캐릭터를 가진 유저를 찾을 수 없습니다.")

  return result.data[0]
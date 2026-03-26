from fastapi import APIRouter, HTTPException, Query
from app.schemas import UserCreate, UserResponse
from app.db.supabase_client import supabase

# 라우터 인스턴스 생성
router = APIRouter()

# 유저 생성/조회 엔드포인트
@router.post("/", response_model = UserResponse, status_code = 201)
def create_or_get_user(payload: UserCreate):
  existing = (
    supabase.table("users")
    .select("*")
    .eq("fingerprint", payload.fingerprint)
    .execute()
  )

  if existing.data:
    return existing.data[0]
  
  result = (
    supabase.table("users")
    .insert({"fingerprint" : payload.fingerprint, "representative" : payload.representative})
    .execute()
  )

  if not result.data:
    raise HTTPException(status_code = 500, detail = "유저 생성에 실패했습니다.")
  
  return result.data[0]

# 대표 캐릭터명으로 유저 검색
# GET /api/users/search?representative=홍길동
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

# 유저 조회 엔드포인트 추가
@router.get("/{fingerprint}", response_model = UserResponse)
def get_user(fingerprint: str):
  result = (
    supabase.table("users")
    .select("*")
    .eq("fingerprint", fingerprint)
    .execute()
  )

  if not result.data:
    raise HTTPException(status_code = 500, detail = "유저 생성에 실패했습니다.")
  
  return result.data[0]
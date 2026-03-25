from fastapi import APIRouter, HTTPException
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
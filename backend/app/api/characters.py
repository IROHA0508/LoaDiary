from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas import CharacterResponse
from app.db.supabase_client import supabase
from app.lostark import get_characters, parse_characters
from datetime import datetime, timezone

# 라우터
router = APIRouter()

# 헬퍼 함수
# fingerprint -> user.id로 변환
def _resolve_user_id(fingerprint: str) -> str:
  result = (
    supabase.table("users")
    .select("id")
    .eq("fingerprint", fingerprint)
    .execute()
  )

  if not result.data:
    raise HTTPException(status_code = 404, detail = "유저를 찾을 수 없습니다.")
  
  return result.data[0]["id"]

# 캐릭터 목록 조회
@router.get("/{fingerprint}", response_model = List[CharacterResponse])
async def get_my_characters(fingerprint: str):
  user_id = _resolve_user_id(fingerprint)

  result = (
    supabase.table("characters")
    .select("*")
    .eq("user_id", user_id)
    .order("item_level", desc=True)
    .execute()
  )

  rows = []
  for row in result.data:
    row["class_name"] = row.pop("class", None)
    rows.append(row)

  return rows

# 캐릭터 동기화
@router.post("/{fingerprint}/sync", response_model = List[CharacterResponse])
async def sync_characters(fingerprint: str, representative: str):
  user_id = _resolve_user_id(fingerprint)

  # 로스트아크 API 호출
  raw = await get_characters(representative)
  if not raw:
    raise HTTPException(status_code = 404, detail = "캐릭터를 찾을 수 없습니다. 캐릭터명을 확인해주세요")
  
  # DB 저장용 데이터로 변환
  characters = await parse_characters(raw, user_id)

  # 기존 캐릭터 전체 삭제 후 새로 저장 (동기화)
  supabase.table("characters").delete().eq("user_id", user_id).execute()

  now = datetime.now(timezone.utc).isoformat()
  for c in characters:
    c["updated_at"] = now

  result = supabase.table("characters").insert(characters).execute()

  if not result.data:
    raise HTTPException(status_code = 500, detail = "캐릭터 동기화에 실패했습니다.")
  
  rows = []
  for row in result.data:
    row["class_name"] = row.pop("class", None)
    rows.append(row)

  return rows

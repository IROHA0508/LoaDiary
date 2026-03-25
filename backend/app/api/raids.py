from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas import RaidCreate, RaidResponse, RaidSlotCreate, RaidSlotResponse
from app.db.supabase_client import supabase

# 라우터 생성
router = APIRouter()

# 레이드 생성
@router.post("/", response_model = RaidResponse, status_code = 201)
async def create_raid(payload: RaidCreate):
  user_result = (
    supabase.table("users")
    .select("id")
    .eq("fingerprint", payload.created_by)
    .execute()
  )

  if not user_result.data:
    raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
  
  data = payload.model_dump()
  data["created_by"] = user_result.data[0]["id"]

  result = supabase.table("raids").insert(data).execute()

  if not result.data:
    raise HTTPException(status_code=500, detail="레이드 생성에 실패했습니다.")

  return result.data[0]

# 생성한 레이드 목록 조회
@router.get("/my/{fingerprint}", response_model=List[RaidResponse])
async def get_my_raids(fingerprint: str):
  user_result = (
    supabase.table("users")
    .select("id")
    .eq("fingerprint", fingerprint)
    .execute()
  )
  
  if not user_result.data:
    raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
  
  user_id = user_result.data[0]["id"]

  result = (
    supabase.table("raids")
    .select("*")
    .eq("created_by", user_id)
    .order("created_at", desc=True)
    .execute()
  )

  return result.data

# 내 캐릭터가 포함된 레이드 조회
@router.get("/joined/{fingerprint}", response_model=List[RaidResponse])
async def get_joined_raids(fingerprint: str):
    """내 캐릭터가 슬롯에 포함된 레이드 목록"""
    # 1. fingerprint로 내 캐릭터 id 목록 조회
    user_result = (
      supabase.table("users")
      .select("id")
      .eq("fingerprint", fingerprint)
      .execute()
    )

    if not user_result.data:
      raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    user_id = user_result.data[0]["id"]

    character_result = (
      supabase.table("characters")
      .select("id")
      .eq("user_id", user_id)
      .execute()
    )

    character_ids = [c["id"] for c in character_result.data]

    if not character_ids:
      return []

    # 2. 내 캐릭터가 포함된 슬롯 조회
    slot_result = (
      supabase.table("raid_slots")
      .select("raid_id")
      .in_("character_id", character_ids)
      .execute()
    )

    raid_ids = list(set([s["raid_id"] for s in slot_result.data]))

    if not raid_ids:
      return []

    # 3. 해당 raid_id로 레이드 정보 조회
    raid_result = (
      supabase.table("raids")
      .select("*")
      .in_("id", raid_ids)
      .order("created_at", desc=True)
      .execute()
    )

    return raid_result.data

# 단일 레이드 조회
@router.get("/{raid_id}", response_model=RaidResponse)
async def get_raid(raid_id: str):
  result = (
    supabase.table("raids")
    .select("*")
    .eq("id", raid_id)
    .execute()
  )

  if not result.data:
    raise HTTPException(status_code=404, detail="레이드를 찾을 수 없습니다.")

  return result.data[0]

# 슬롯에서 캐릭터 제거
@router.delete("/slots/{slot_id}", status_code=204)
async def remove_slot(slot_id: str):
  result = (
    supabase.table("raid_slots")
    .delete()
    .eq("id", slot_id)
    .execute()
  )

  if not result.data:
    raise HTTPException(status_code=404, detail="슬롯을 찾을 수 없습니다.")
  
# 레이드 삭제
@router.delete("/{raid_id}", status_code=204)
async def delete_raid(raid_id: str):
  result = (
    supabase.table("raids")
    .delete()
    .eq("id", raid_id)
    .execute()
  )

  if not result.data:
    raise HTTPException(status_code=404, detail="레이드를 찾을 수 없습니다.")
  
# 슬롯 목록 조회
@router.get("/{raid_id}/slots", response_model=List[RaidSlotResponse])
async def get_slots(raid_id: str):
  result = (
    supabase.table("raid_slots")
    .select("*")
    .eq("raid_id", raid_id)
    .order("slot_order")
    .execute()
  )

  return result.data

# 슬롯에 캐릭터 배치
@router.post("/{raid_id}/slots", response_model=RaidSlotResponse, status_code=201)
async def add_slot(raid_id: str, payload: RaidSlotCreate):
  # 최대 슬롯 수 체크
  raid_result = (
    supabase.table("raids")
    .select("max_slots")
    .eq("id", raid_id)
    .execute()
  )

  if not raid_result.data:
    raise HTTPException(status_code=404, detail="레이드를 찾을 수 없습니다.")

  current_slots = (
    supabase.table("raid_slots")
    .select("id", count="exact")
    .eq("raid_id", raid_id)
    .execute()
  )

  if current_slots.count >= raid_result.data[0]["max_slots"]:
    raise HTTPException(status_code=400, detail="슬롯이 가득 찼습니다.")

  data = {
    "raid_id": raid_id,
    "character_id": payload.character_id,
    "slot_order": payload.slot_order,
    "role": payload.role,
  }

  result = supabase.table("raid_slots").insert(data).execute()

  if not result.data:
    raise HTTPException(status_code=500, detail="슬롯 추가에 실패했습니다.")

  return result.data[0]

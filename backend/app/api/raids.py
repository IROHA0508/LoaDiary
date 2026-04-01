from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from app.schemas import (
  RaidCreate, RaidResponse,
  RaidSlotCreate, RaidSlotResponse,
  RaidMemberCreate, RaidMemberResponse, RaidMemberWithCharacters,
  CharacterResponse,
  WeeklyUsedSlotResponse,
)
from app.db.supabase_client import supabase
from app.lostark import get_characters, parse_characters, resolve_or_create_user_by_character_name
import asyncio

# 라우터 생성
router = APIRouter()

# 레이드 수정 요청 바디
class RaidUpdate(BaseModel):
  difficulty: str
  max_slots: int
  raid_id: Optional[str] = None
  raid_name: Optional[str] = None


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
    # users 조회를 raids 쿼리와 JOIN으로 합치기
    result = (
        supabase.table("raids")
        .select("*, users!created_by(fingerprint)")
        .eq("users.fingerprint", fingerprint)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data

# 내 캐릭터가 포함된 레이드 조회
@router.get("/joined/{fingerprint}", response_model=List[RaidResponse])
async def get_joined_raids(fingerprint: str):
    # users + characters를 asyncio.gather로 병렬 처리
    user_result = supabase.table("users").select("id").eq("fingerprint", fingerprint).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    user_id = user_result.data[0]["id"]

    # characters와 이후 쿼리를 최소화: 단일 JOIN 쿼리로 대체
    # raid_slots → characters(user_id) → raids 를 한 번에
    slot_result = (
        supabase.table("raid_slots")
        .select("raid_id, characters!inner(user_id)")
        .eq("characters.user_id", user_id)
        .execute()
    )

    raid_ids = list(set(s["raid_id"] for s in slot_result.data))
    if not raid_ids:
        return []

    raid_result = (
        supabase.table("raids")
        .select("*")
        .in_("id", raid_ids)
        .order("created_at", desc=True)
        .execute()
    )
    return raid_result.data

# 주간 참여 완료 슬롯 조회
# GET /api/raids/weekly-used-slots?raid_type=serca&week_start=2025-01-01T21:00:00Z
# - 동일 raid_id(종류)에 week_start 이후 생성된 레이드 인스턴스의 모든 슬롯을 반환
# - 프론트엔드에서 현재 인스턴스를 제외한 나머지로 주간 중복 참여를 판단
@router.get("/weekly-used-slots", response_model=List[WeeklyUsedSlotResponse])
async def get_weekly_used_slots(
  raid_type: str = Query(..., description="레이드 종류 id (e.g. 'valtan', 'behemoth')"),
  week_start: str = Query(..., description="이번 주 초기화 시각 (ISO 8601 UTC)"),
):
  # 1. 해당 raid_type의 모든 인스턴스 조회 (날짜 필터 제거)
  #    레이드가 언제 만들어졌든, 슬롯 저장일 기준으로 주간 잠금 판단
  raid_result = (
    supabase.table("raids")
    .select("id")
    .eq("raid_id", raid_type)
    .execute()
  )

  if not raid_result.data:
    return []

  raid_instance_ids = [r["id"] for r in raid_result.data]

  # 2. 이번 주에 저장된 슬롯만 조회 (슬롯 created_at 기준)
  #    → 이전 주 만든 레이드에 이번 주 추가된 슬롯도 정확히 잠금 처리
  slot_result = (
    supabase.table("raid_slots")
    .select("raid_id, character_id")
    .in_("raid_id", raid_instance_ids)
    .gte("created_at", week_start)   # ← 핵심 변경: 슬롯 저장일 기준
    .execute()
  )

  return [
    {"raid_instance_id": s["raid_id"], "character_id": s["character_id"]}
    for s in slot_result.data
  ]

# 레이드 수정
@router.patch("/{raid_id}", response_model=RaidResponse)
async def update_raid(raid_id: str, payload: RaidUpdate):
  # 수정 대상 레이드 존재 여부 확인
  raid_result = (
    supabase.table("raids")
    .select("*")
    .eq("id", raid_id)
    .execute()
  )

  if not raid_result.data:
    raise HTTPException(status_code=404, detail="레이드를 찾을 수 없습니다.")

  current_raid = raid_result.data[0]

  # 최대 슬롯 수를 줄일 때, 이미 배치된 슬롯보다 작게는 변경할 수 없음
  current_slot_result = (
    supabase.table("raid_slots")
    .select("id", count="exact")
    .eq("raid_id", raid_id)
    .execute()
  )

  current_slot_count = current_slot_result.count or 0
  if payload.max_slots < current_slot_count:
    raise HTTPException(
      status_code=400,
      detail=f"현재 {current_slot_count}명이 배치되어 있어 {payload.max_slots}인으로 줄일 수 없습니다."
    )

  update_data = {
      "difficulty": payload.difficulty,
      "max_slots": payload.max_slots,
    }
  if payload.raid_id is not None:
    update_data["raid_id"] = payload.raid_id
  if payload.raid_name is not None:
    update_data["raid_name"] = payload.raid_name

  updated = (
    supabase.table("raids")
    .update(update_data)
    .eq("id", raid_id)
    .execute()
  )

  if not updated.data:
    raise HTTPException(status_code=500, detail="레이드 수정에 실패했습니다.")

  # 축소된 슬롯 수보다 뒤에 있는 빈 슬롯 데이터가 있다면 정리
  if payload.max_slots < current_raid["max_slots"]:
    (
      supabase.table("raid_slots")
      .delete()
      .eq("raid_id", raid_id)
      .gte("slot_order", payload.max_slots)
      .execute()
    )

  return updated.data[0]

# 레이드 + 슬롯 통합 조회 (메인페이지 최적화용)
# GET /api/raids/all-with-slots/{fingerprint}
@router.get("/all-with-slots/{fingerprint}")
async def get_all_raids_with_slots(fingerprint: str):
    # 1. user_id 조회
    user_result = supabase.table("users").select("id").eq("fingerprint", fingerprint).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    user_id = user_result.data[0]["id"]

    # 2. 내가 만든 레이드 + 내 캐릭터가 슬롯에 있는 레이드를 한번에 조회
    my_raids_result = (
        supabase.table("raids")
        .select("*")
        .eq("created_by", user_id)
        .execute()
    )
    my_raid_ids = {r["id"] for r in (my_raids_result.data or [])}

    slot_result = (
        supabase.table("raid_slots")
        .select("raid_id, characters!inner(user_id)")
        .eq("characters.user_id", user_id)
        .execute()
    )
    joined_raid_ids = {s["raid_id"] for s in (slot_result.data or [])}

    all_raid_ids = list(my_raid_ids | joined_raid_ids)
    if not all_raid_ids:
        return []

    # 3. 해당 레이드들 전체 조회
    raids_result = (
        supabase.table("raids")
        .select("*")
        .in_("id", all_raid_ids)
        .execute()
    )
    raids = raids_result.data or []

    # 4. 모든 레이드의 슬롯을 characters 테이블과 JOIN해서 한번에 조회
    # → character_name, class_name, is_support를 JOIN으로 채워야 다른 유저 캐릭터도 표시됨
    slots_result = (
        supabase.table("raid_slots")
        .select("id, raid_id, character_id, slot_order, role, characters(name, class, is_support)")
        .in_("raid_id", all_raid_ids)
        .execute()
    )
    slots_data = slots_result.data or []

    # 5. JOIN 결과 플래튼 + 슬롯을 raid_id 기준으로 그룹핑
    slots_by_raid = {}
    for slot in slots_data:
        char_info = slot.pop("characters", None) or {}
        slot["character_name"] = char_info.get("name")
        slot["class_name"]     = char_info.get("class")   # DB 컬럼명이 "class"
        slot["is_support"]     = char_info.get("is_support")

        rid = slot["raid_id"]
        if rid not in slots_by_raid:
            slots_by_raid[rid] = []
        slots_by_raid[rid].append(slot)

    # 6. 슬롯이 1개 이상 있는 레이드만 반환
    # - 내가 만든 빈 레이드(0명 배치)는 메인페이지에 노출되지 않음
    # - joined_raid_ids는 내 캐릭터가 이미 슬롯에 있으므로 항상 slots_by_raid에 포함됨
    for raid in raids:
        raid["slots"] = slots_by_raid.get(raid["id"], [])

    return [r for r in raids if r["slots"]]

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
  
@router.get("/{raid_id}/slots", response_model=List[RaidSlotResponse])
async def get_slots(raid_id: str):
  # 1. 슬롯 목록 조회
  result = (
    supabase.table("raid_slots")
    .select("*")
    .eq("raid_id", raid_id)
    .order("slot_order")
    .execute()
  )
 
  slots = result.data
  if not slots:
    return []
 
  # 2. 슬롯의 character_id로 캐릭터 정보(이름·직업·서포터 여부) 일괄 조회
  character_ids = list(set(s["character_id"] for s in slots))
  char_result = (
    supabase.table("characters")
    .select("id, name, class, is_support")
    .in_("id", character_ids)
    .execute()
  )
 
  # id → 캐릭터 정보 맵
  char_map = {c["id"]: c for c in char_result.data}
 
  # 3. 슬롯 데이터에 캐릭터 이름·직업·역할 추가
  for slot in slots:
    char = char_map.get(slot["character_id"])
    slot["character_name"] = char["name"] if char else None
    slot["class_name"] = char["class"] if char else None       # DB 컬럼명은 "class"
    slot["is_support"] = char.get("is_support") if char else None
 
  return slots

# 슬롯에 캐릭터 배치
@router.post("/{raid_id}/slots", response_model=RaidSlotResponse, status_code=201)
async def add_slot(raid_id: str, payload: RaidSlotCreate):
  # 레이드 정보 조회
  raid_result = (
    supabase.table("raids")
    .select("max_slots, raid_id")
    .eq("id", raid_id)
    .execute()
  )

  if not raid_result.data:
    raise HTTPException(status_code=404, detail="레이드를 찾을 수 없습니다.")

  raid_info = raid_result.data[0]

  # 최대 슬롯 수 체크
  current_slots = (
    supabase.table("raid_slots")
    .select("id", count="exact")
    .eq("raid_id", raid_id)
    .execute()
  )

  if current_slots.count >= raid_info["max_slots"]:
    raise HTTPException(status_code=400, detail="슬롯이 가득 찼습니다.")

  # ── 주간 중복 참여 차단 ───────────────────────────────────────
  # 수요일 06:00 KST(= 수요일 21:00 UTC 전날) 기준 이번 주 초기화 시각 계산
  now_utc = datetime.now(timezone.utc)
  # KST = UTC+9
  now_kst = now_utc.replace(tzinfo=None)
  now_kst_aware = datetime.now(timezone.utc)

  # UTC 기준으로 이번 주 수요일 21:00 UTC (= KST 수요일 06:00) 계산
  weekday = now_utc.weekday()   # 0=월 1=화 2=수 3=목 4=금 5=토 6=일
  hour_utc = now_utc.hour

  # 가장 최근 수요일 21:00 UTC 를 구함
  # 수요일 = weekday 2
  days_back = (weekday - 2) % 7
  if days_back == 0 and hour_utc < 21:
    days_back = 7   # 수요일이지만 21:00 UTC 이전 → 지난 주 수요일

  from datetime import timedelta
  reset_utc = now_utc.replace(hour=21, minute=0, second=0, microsecond=0) \
              - timedelta(days=days_back)
  week_start_iso = reset_utc.isoformat()

  # 같은 raid_id(종류)의 모든 인스턴스 조회 (날짜 필터 없음)
  same_type_raids = (
    supabase.table("raids")
    .select("id")
    .eq("raid_id", raid_info["raid_id"])
    .neq("id", raid_id)          # 현재 인스턴스 제외
    .execute()
  )

  if same_type_raids.data:
    other_ids = [r["id"] for r in same_type_raids.data]
    # 슬롯 저장일(created_at) 기준으로 이번 주 중복 체크
    # 레이드가 언제 만들어졌든 관계없이 슬롯이 이번 주에 추가됐으면 잠금
    already_used = (
      supabase.table("raid_slots")
      .select("id")
      .in_("raid_id", other_ids)
      .eq("character_id", payload.character_id)
      .gte("created_at", week_start_iso)   # ← 슬롯 저장일 기준
      .execute()
    )
    if already_used.data:
      raise HTTPException(
        status_code=409,
        detail="이번 주 해당 레이드에 이미 참여한 캐릭터입니다."
      )
  # ────────────────────────────────────────────────────────────

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

# ──────────────────────────────────────────
# 레이드 멤버 (참여 유저)
# ──────────────────────────────────────────
 
# 멤버 등록 (대표 캐릭터명으로 유저 검색 후 추가)
@router.post("/{raid_id}/members", response_model=RaidMemberResponse, status_code=201)
async def add_member(raid_id: str, payload: RaidMemberCreate, added_by: str):
  # 1. added_by fingerprint → user_id 변환
  adder_result = (
    supabase.table("users")
    .select("id")
    .eq("fingerprint", added_by)
    .execute()
  )
 
  if not adder_result.data:
    raise HTTPException(status_code=404, detail="요청한 유저를 찾을 수 없습니다.")
 
  adder_id = adder_result.data[0]["id"]
 
#   # 2. LoA API로 캐릭터 검증 + 원정대 식별 (groups.py와 동일 헬퍼 사용)
  target_user = await resolve_or_create_user_by_character_name(payload.representative)
  target_user_id = target_user["id"]
 
  # 3. 본인을 추가하려는 경우 차단
  if adder_id == target_user_id:
    raise HTTPException(status_code=400, detail="본인은 추가할 수 없습니다.")
 
  # 4. raid_members에 등록 (중복이면 DB UNIQUE 제약으로 에러)
  try:
    result = (
      supabase.table("raid_members")
      .insert({
        "raid_id": raid_id,
        "user_id": target_user_id,
        "added_by": adder_id,
      })
      .execute()
    )
  except Exception:
    raise HTTPException(status_code=409, detail="이미 등록된 유저입니다.")
 
  if not result.data:
    raise HTTPException(status_code=500, detail="멤버 등록에 실패했습니다.")
 
  return result.data[0]
 
# 멤버 목록 조회 (유저 정보 + 원정대 캐릭터 포함)
@router.get("/{raid_id}/members", response_model=List[RaidMemberWithCharacters])
async def get_members(raid_id: str):
  # 1. 멤버 목록 조회
  member_result = (
    supabase.table("raid_members")
    .select("user_id")
    .eq("raid_id", raid_id)
    .execute()
  )
  if not member_result.data:
    return []

  user_ids = [m["user_id"] for m in member_result.data]

  # 2. 유저 정보 배치 조회 (N번 → 1번)
  users_result = (
    supabase.table("users")
    .select("id, representative")
    .in_("id", user_ids)
    .execute()
  )
  user_map = {u["id"]: u for u in (users_result.data or [])}

  # 3. 캐릭터 배치 조회 (N번 → 1번)
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

  # 4. 조립 (루프 1회, DB 호출 없음)
  members_with_chars = []
  for user_id in user_ids:
    user = user_map.get(user_id)
    if not user:
      continue
    members_with_chars.append({
      "user_id": user_id,
      "representative": user["representative"],
      "characters": chars_by_user.get(user_id, []),
    })

  return members_with_chars

# 멤버 제거
@router.delete("/{raid_id}/members/{user_id}", status_code=204)
async def remove_member(raid_id: str, user_id: str):
  result = (
    supabase.table("raid_members")
    .delete()
    .eq("raid_id", raid_id)
    .eq("user_id", user_id)
    .execute()
  )
 
  if not result.data:
    raise HTTPException(status_code=404, detail="해당 멤버를 찾을 수 없습니다.")
  
# 레이드 완료 토글 (완료 <-> 미완료)
class RaidCompleteUpdate(BaseModel):
    is_completed: bool

@router.patch("/{raid_id}/complete", response_model=RaidResponse)
async def set_complete(raid_id: str, payload: RaidCompleteUpdate):
    # SELECT 없이 UPDATE 1회만 실행 (DB 쿼리 절감)
    result = (
        supabase.table("raids")
        .update({"is_completed": payload.is_completed})
        .eq("id", raid_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="레이드를 찾을 수 없습니다.")
    return result.data[0]

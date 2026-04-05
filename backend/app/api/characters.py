from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas import CharacterResponse
from app.db.supabase_client import supabase
from app.lostark import get_characters, parse_characters, get_armory
from datetime import datetime, timezone

# 라우터
router = APIRouter()

# 헬퍼 함수
def _resolve_user_id(fingerprint: str) -> str:
  result = (
    supabase.table("users")
    .select("id")
    .eq("fingerprint", fingerprint)
    .execute()
  )
  if not result.data:
    raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
  return result.data[0]["id"]


def _upsert_characters(user_id: str, parsed: list, now: str):
  """
  캐릭터를 이름 기준으로 upsert.
  - 기존에 같은 이름의 캐릭터가 있으면 → ID 유지하면서 update (raid_slots FK 보존)
  - 없으면 → insert
  - 로스트아크에서 사라진 캐릭터 → 삭제
  """
  # 기존 캐릭터 조회 (name → id 맵)
  existing = (
    supabase.table("characters")
    .select("id, name")
    .eq("user_id", user_id)
    .execute()
  ).data or []
  existing_map = {c["name"]: c["id"] for c in existing}
  existing_names = set(existing_map.keys())
  new_names = {c["name"] for c in parsed}

  for c in parsed:
    c["updated_at"] = now
    name = c["name"]
    if name in existing_map:
      # 기존 캐릭터 업데이트 (ID 유지)
      char_id = existing_map[name]
      update_data = {k: v for k, v in c.items() if k != "user_id"}
      supabase.table("characters").update(update_data).eq("id", char_id).execute()
    else:
      # 새 캐릭터 삽입
      supabase.table("characters").insert(c).execute()

  # 로스트아크에서 사라진 캐릭터 삭제 (raid_slots에 없는 것만)
  removed_names = existing_names - new_names
  for name in removed_names:
    char_id = existing_map[name]
    # 슬롯에 배치된 캐릭터는 삭제하지 않음
    in_slot = (
      supabase.table("raid_slots")
      .select("id", count="exact")
      .eq("character_id", char_id)
      .execute()
    )
    if (in_slot.count or 0) == 0:
      supabase.table("characters").delete().eq("id", char_id).execute()


# 캐릭터 목록 조회
@router.get("/{fingerprint}", response_model=List[CharacterResponse])
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


# 캐릭터 동기화 (나 혼자)
@router.post("/{fingerprint}/sync", response_model=List[CharacterResponse])
async def sync_characters(fingerprint: str, representative: str):
    user_id = _resolve_user_id(fingerprint)

    raw = await get_characters(representative)
    if not raw:
        raise HTTPException(
            status_code=404,
            detail="캐릭터를 찾을 수 없습니다. 캐릭터명을 다시 확인해주세요."
        )

    parsed = await parse_characters(raw, user_id)
    now = datetime.now(timezone.utc).isoformat()
    _upsert_characters(user_id, parsed, now)

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

# 전체 동기화: 내 캐릭터 + 레이드 멤버 전원
@router.post("/{fingerprint}/sync-all")
async def sync_all(fingerprint: str):
  """
  내 캐릭터 + 내가 속한 레이드의 멤버 캐릭터 일괄 동기화.
  upsert 방식으로 기존 character ID를 유지하여 raid_slots 참조를 보존.
  반환: { synced: [...], failed: [...] }
  """
  user_id = _resolve_user_id(fingerprint)
  now = datetime.now(timezone.utc).isoformat()

  # 1. 내 대표 캐릭터명
  user_result = (
    supabase.table("users")
    .select("representative")
    .eq("id", user_id)
    .execute()
  )
  if not user_result.data:
    raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
  my_representative = user_result.data[0]["representative"]

  # 2. 내 레이드 ID 수집
  my_raids = (
    supabase.table("raids")
    .select("id")
    .eq("created_by", user_id)
    .execute()
  ).data or []

  my_char_ids = [
    c["id"] for c in (
      supabase.table("characters")
      .select("id")
      .eq("user_id", user_id)
      .execute()
    ).data or []
  ]
  joined_raid_ids = []
  if my_char_ids:
    slots = (
      supabase.table("raid_slots")
      .select("raid_id")
      .in_("character_id", my_char_ids)
      .execute()
    ).data or []
    joined_raid_ids = list(set(s["raid_id"] for s in slots))

  all_raid_ids = list(set([r["id"] for r in my_raids] + joined_raid_ids))

  # 3. 레이드 멤버들의 (user_id, representative) 수집
  member_targets = []   # [(user_id, representative)]
  if all_raid_ids:
    member_rows = (
      supabase.table("raid_members")
      .select("user_id")
      .in_("raid_id", all_raid_ids)
      .execute()
    ).data or []
    member_user_ids = list(set(m["user_id"] for m in member_rows if m["user_id"] != user_id))

    if member_user_ids:
      member_users = (
        supabase.table("users")
        .select("id, representative")
        .in_("id", member_user_ids)
        .execute()
      ).data or []
      for u in member_users:
        if u.get("representative"):
          member_targets.append((u["id"], u["representative"]))

  # 4. 동기화: 나 먼저, 그 다음 멤버들
  all_targets = [(user_id, my_representative)] + member_targets
  results = {"synced": [], "failed": []}

  for target_user_id, rep in all_targets:
    try:
      raw = await get_characters(rep)
      if not raw:
        results["failed"].append(rep)
        continue
      parsed = await parse_characters(raw, target_user_id)
      _upsert_characters(target_user_id, parsed, now)
      results["synced"].append(rep)
    except Exception as e:
      results["failed"].append(rep)

  return results


# 캐릭터 상세 조회
@router.get("/{character_name}/armory")
async def get_character_armory(character_name: str):
  data = await get_armory(character_name)
  if not data:
    raise HTTPException(status_code=404, detail="캐릭터 정보를 불러올 수 없습니다.")
  return data
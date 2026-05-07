import os
import httpx
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

LOSTARK_API_KEY = os.environ.get("LOSTARK_API_KEY", "")
BASE_URL = "https://developer-lostark.game.onstove.com"

SUPPORT_ARKPASSIVE = {"축복의 오라", "해방자", "절실한 구원", "만개"}

def _headers() -> dict:
  return {
    "Authorization": f"bearer {LOSTARK_API_KEY}",
    "Accept": "application/json",
  }

def _parse_level(level_str: str | None) -> float | None:
  if not level_str:
    return None
  try:
    return float(level_str.replace(",", ""))
  except ValueError:
    return None

# ── 원정대 전체 캐릭터 목록 조회 ──────────────────────
async def get_characters(character_name: str) -> list:
  url = f"{BASE_URL}/characters/{character_name}/siblings"
  try:
    async with httpx.AsyncClient() as client:
      response = await client.get(url, headers=_headers())
    if response.status_code == 200:
      data = response.json()
      return data if isinstance(data, list) else []
  except Exception:
    pass
  return []

# ── 캐릭터 프로필 조회 — 전투력 수집 ──────────────────
async def get_character_profile(character_name: str, client: httpx.AsyncClient) -> dict:
  url = f"{BASE_URL}/armories/characters/{character_name}/profiles"
  try:
    response = await client.get(url, headers=_headers())
    if response.status_code == 200:
      data = response.json()
      return data if isinstance(data, dict) else {}
  except Exception:
    pass
  return {}

# ── 아크패시브 조회 — 서포터 빌드 여부 판별 ────────────
async def get_character_engravings(character_name: str, client: httpx.AsyncClient) -> bool:
  url = f"{BASE_URL}/armories/characters/{character_name}/arkpassive"
  try:
    response = await client.get(url, headers=_headers())
    if response.status_code == 200:
      data = response.json()
      if not data:
        return False
      title = data.get("Title", "")
      if title in SUPPORT_ARKPASSIVE:
        return True
  except Exception:
    pass
  return False

# ── DB 저장용 데이터로 변환 ────────────────────────────
async def parse_characters(raw: list, user_id: str) -> list:
  result = []

  async with httpx.AsyncClient() as client:
    for c in raw:
      name = c.get("CharacterName")
      item_level = _parse_level(c.get("ItemAvgLevel"))

      combat_power = None
      is_support = False

      if item_level is not None:
        profile = await get_character_profile(name, client)
        if profile:
          combat_power = _parse_level(profile.get("CombatPower"))

        is_support = await get_character_engravings(name, client)

      result.append({
        "user_id": user_id,
        "name": name,
        "class": c.get("CharacterClassName"),
        "server": c.get("ServerName"),
        "item_level": item_level,
        "combat_power": combat_power,
        "is_support": is_support,
      })

  return result

# ── 캐릭터명으로 유저를 찾거나 생성하는 공통 헬퍼 ────────
# 동작 순서:
#   ① DB에서 입력명 exact match (이미 대표 캐릭터로 등록된 경우)
#   ② 로스트아크 API로 siblings 조회 (유효한 캐릭터인지 검증 + 원정대 목록 획득)
#      → API 응답 없으면 404 raise (존재하지 않는 캐릭터)
#   ③ siblings 중 DB에 등록된 대표 캐릭터가 있으면 그 유저 반환
#   ④ 없으면 임시 유저 생성 + 캐릭터 동기화
# 반환값: users 테이블 row dict (id, representative, fingerprint, ...)
async def resolve_or_create_user_by_character_name(character_name: str) -> dict:
  from fastapi import HTTPException
  from app.db.supabase_client import supabase

  rep = character_name.strip()
  if not rep:
    raise HTTPException(status_code=400, detail="캐릭터명을 입력해주세요.")

  # ① DB exact match
  direct = supabase.table("users").select("*").eq("representative", rep).execute()
  if direct.data:
    return direct.data[0]

  # ② 로스트아크 API로 원정대 캐릭터 목록 조회
  raw = await get_characters(rep)
  if not raw:
    raise HTTPException(
      status_code=404,
      detail=f"'{rep}' 캐릭터를 찾을 수 없어요. 캐릭터명을 다시 확인해주세요."
    )

  sibling_names = [c.get("CharacterName") for c in raw if c.get("CharacterName")]

  # ③ siblings 중 DB에 대표 캐릭터로 등록된 유저 탐색
  # ③ siblings 전체를 한 번의 배치 쿼리로 조회 (N+1 → 1)
  if sibling_names:
      batch = (
          supabase.table("users")
          .select("*")
          .in_("representative", sibling_names)
          .limit(1)
          .execute()
      )
      if batch.data:
          return batch.data[0]

  # ④ 없으면 임시 유저 생성
  # 대표 캐릭터 = 원정대 내 아이템 레벨이 가장 높은 캐릭터
  def _parse_level_local(s):
    try: return float(s.replace(",", "")) if s else 0.0
    except: return 0.0

  best = max(raw, key=lambda c: _parse_level_local(c.get("ItemAvgLevel", "0")))
  representative_name = best.get("CharacterName") or rep
  created = supabase.table("users").insert({
    "representative": representative_name,
    "fingerprint": None,
  }).execute()
  if not created.data:
    raise HTTPException(status_code=500, detail="유저 생성에 실패했습니다.")

  user = created.data[0]

  # 캐릭터 동기화
  characters = await parse_characters(raw, user["id"])
  if characters:
    now = datetime.now(timezone.utc).isoformat()
    for c in characters:
      c["updated_at"] = now
    supabase.table("characters").insert(characters).execute()

  return user


# ── 캐릭터 상세 정보 일괄 조회 (캐릭터 상세 페이지용) ──
async def get_armory(character_name: str) -> dict:
  filters = "profiles+equipment+engravings+gems+cards+arkpassive"
  url = f"{BASE_URL}/armories/characters/{character_name}?filters={filters}"
  try:
    async with httpx.AsyncClient(timeout=15.0) as client:
      response = await client.get(url, headers=_headers())
      if response.status_code == 200:
        data = response.json()
        return data if isinstance(data, dict) else {}
  except Exception:
    pass
  return {}

# ── 거래소 아이템 30일 히스토리 조회 (그래프용)
# item_id   : Items[].Id 값
# item_grade: Items[].Grade 값
async def get_market_item_history(item_id: int) -> list:
  # ✅ /grade 없이 itemId만으로 Stats(Date, AvgPrice, TradeCount) 조회
  url = f"{BASE_URL}/markets/items/{item_id}"
  try:
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
      res = await client.get(url, headers=_headers())
      print(f"[history] item_id={item_id} status={res.status_code}")
      if res.status_code == 200:
        data = res.json()
        result = []
        for obj in (data if isinstance(data, list) else []):
          for stat in obj.get("Stats", []):
            result.append({
              "Date":       stat.get("Date", ""),
              "AvgPrice":   stat.get("AvgPrice"),
              "TradeCount": stat.get("TradeCount"),
            })
        return result
  except Exception as e:
    print(f"[history] error: {e}")
  return []

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

LOSTARK_API_KEY = os.environ.get("LOSTARK_API_KEY", "")
BASE_URL = "https://developer-lostark.game.onstove.com"

# ── 서포터 판별용 직업 각인 목록 ──────────────────────
# 해당 각인이 Effects에 있으면 서포터 빌드로 판정
SUPPORT_ENGRAVINGS = {"축복의 오라", "빛의 기사", "절실한 구원", "만개"}


# 캐릭터 목록 호출 (원정대 전체)
async def get_characters(character_name: str) -> list:
  headers = {
    "Authorization": f"bearer {LOSTARK_API_KEY}",
    "Accept": "application/json",
  }
  url = f"{BASE_URL}/characters/{character_name}/siblings"

  try:
    async with httpx.AsyncClient() as client:
      response = await client.get(url, headers=headers)
    if response.status_code == 200:
      data = response.json()
      return data if isinstance(data, list) else []
  except Exception:
    pass

  return []


# 캐릭터 프로필 조회 — 전투력 수집
async def get_character_profile(character_name: str, client: httpx.AsyncClient) -> dict:
  headers = {
    "Authorization": f"bearer {LOSTARK_API_KEY}",
    "Accept": "application/json",
  }
  url = f"{BASE_URL}/armories/characters/{character_name}/profiles"

  try:
    response = await client.get(url, headers=headers)
    if response.status_code == 200:
      data = response.json()
      return data if isinstance(data, dict) else {}
  except Exception:
    pass

  return {}


# 캐릭터 아크패시브 조회 — 서포터 빌드 여부 판별
# /armories/characters/{name}/arkpassive 응답:
#   "Engravings": [{Slot, Name, Icon, Tooltip}, ...]  → 장착된 각인 아이템
#   "Effects":    [{Icon, Name, Description}, ...]    → 실제 활성화된 각인 효과
# Effects[].Name 형식 예: "절실한 구원 Lv.3"
# → Name이 서포터 각인 이름으로 시작하면 서포터로 판정
async def get_character_engravings(character_name: str, client: httpx.AsyncClient) -> bool:
  headers = {
    "Authorization": f"bearer {LOSTARK_API_KEY}",
    "Accept": "application/json",
  }
  url = f"{BASE_URL}/armories/characters/{character_name}/arkpassive"

  try:
    response = await client.get(url, headers=headers)
    if response.status_code == 200:
      data = response.json()
      if not data:
        return False

      title = data.get("Title", "")
      if title in SUPPORT_ENGRAVINGS:
        return True
  except Exception:
    pass

  return False


# DB 저장용 데이터로 변환
async def parse_characters(raw: list, user_id: str) -> list:
  result = []

  async with httpx.AsyncClient() as client:
    for c in raw:
      name = c.get("CharacterName")
      item_level = _parse_level(c.get("ItemAvgLevel"))

      combat_power = None
      is_support = False

      # 아이템 레벨이 있는 캐릭터만 프로필·각인 조회
      if item_level is not None:
        profile = await get_character_profile(name, client)
        if profile:
          combat_power = _parse_level(profile.get("CombatPower"))

        # 각인 조회 → 서포터 빌드 여부 판별
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

def _parse_level(level_str: str | None) -> float | None:
  if not level_str:
    return None
  try:
    return float(level_str.replace(",", ""))
  except ValueError:
    return None
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

LOSTARK_API_KEY = os.environ.get("LOSTARK_API_KEY", "")
BASE_URL = "https://developer-lostark.game.onstove.com"

# 임시 디버그
# print(f"API KEY: {LOSTARK_API_KEY}")
# print(f"BASE URL: {BASE_URL}")

# 캐릭터 정보 호출 함수
async def get_characters(character_name: str) -> list:
  headers = {
    "Authorization" : f"bearer {LOSTARK_API_KEY}",
    "Accept" : "application/json"
  }
  
  url = f"{BASE_URL}/characters/{character_name}/siblings"
  # 디버그용
  # print(f"요청 URL: {url}")

  async with httpx.AsyncClient() as client:
    response = await client.get(url, headers = headers)

  # 디버그용
  # print(f"응답 코드: {response.status_code}")
  # print(f"응답 내용: {response.text}")

  if response.status_code == 200:
    return response.json()
  else:
    return []
    
# 캐릭터 개인 프로필 조회 - 전투력 가져오기 위해서 필요함
async def get_character_profile(character_name: str, client: httpx.AsyncClient) -> dict:
  headers = {
    "Authorization": f"bearer {LOSTARK_API_KEY}",
    "Accept": "application/json",
  }

  url = f"{BASE_URL}/armories/characters/{character_name}/profiles"
  response = await client.get(url, headers=headers)

  if response.status_code == 200:
    return response.json()
  else:
    return {}
    
# DB 저장용 데이터로 변환
async def parse_characters(raw: list, user_id: str) -> list:
  result = []

  async with httpx.AsyncClient() as client:
    for c in raw:
      name = c.get("CharacterName")
      item_level = _parse_level(c.get("ItemAvgLevel"))

      # 아이템 레벨 있는 캐릭터만 profiles 호출해서 전투력 가져옴
      combat_power = None
      if item_level is not None:
        profile = await get_character_profile(name, client)
        combat_power = _parse_level(profile.get("CombatPower"))

      result.append({
        "user_id": user_id,
        "name": name,
        "class": c.get("CharacterClassName"),
        "server": c.get("ServerName"),
        "item_level": item_level,
        "combat_power": combat_power,
      })

  return result

def _parse_level(level_str: str | None) -> float | None:
  if not level_str:
    return None
  try:
    return float(level_str.replace(",", ""))
  except ValueError:
    return None
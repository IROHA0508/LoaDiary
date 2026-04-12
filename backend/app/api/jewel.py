from fastapi import APIRouter
from app.lostark import get_all_jewel_prices, get_jewel_price, JEWEL_NAMES

router = APIRouter()

# ── 전체 보석 12종 최저가 조회 ────────────────────────────────
# GET /api/jewel/items
# ✅ 최적화: asyncio.gather 병렬 조회 — lostark.py의 get_all_jewel_prices 참고
@router.get("/items")
async def get_jewel_items():
  results = await get_all_jewel_prices()
  return results
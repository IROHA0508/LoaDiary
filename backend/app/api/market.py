from fastapi import APIRouter, HTTPException, Query
from app.lostark import get_market_item_history

router = APIRouter()

# ── 히스토리 조회 (차트용) ────────────────────────────────────
@router.get("/history/{item_id}")
async def get_history(item_id: int):
  # ✅ grade 파라미터 불필요
  data = await get_market_item_history(item_id)
  if not data:
    return []
  return [
    {
      "date":        row.get("Date", "")[:10],
      "avg_price":   row.get("AvgPrice"),
      "trade_count": row.get("TradeCount"),
    }
    for row in data
  ]
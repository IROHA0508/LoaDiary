from fastapi import APIRouter, HTTPException, Query
from app.lostark import get_market_item_history

router = APIRouter()

# ── 히스토리 조회 (차트용) ────────────────────────────────────
@router.get("/history/{item_id}")
async def get_history(item_id: int, grade: str = Query(...)):
  data = await get_market_item_history(item_id, grade)
  if not data:
    return []

  return [
    {
      "date":        row.get("Date", "")[:10],  # YYYY-MM-DD 만 사용
      "avg_price":   row.get("AvgPrice"),
      "trade_count": row.get("TradeCount"),
    }
    for row in data
  ]
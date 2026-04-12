from fastapi import APIRouter, HTTPException, Query
from app.lostark import get_market_items, get_market_item_history

router = APIRouter()

# ── CategoryCode 매핑 ──────────────────────────────────────────
# GET /markets/options 로 확인한 실제 코드값
CATEGORY_MAP = {
  # 재련 재료: 강화재료(50010) + 강화추가재료(50020) 두 카테고리 병합
  "refine": [
    {"code": 50010, "grade": None},   # 강화재료
    {"code": 50020, "grade": None},   # 강화추가재료
  ],
  # 생활(융화) 재료
  "life": [
    {"code": 90200, "grade": None},   # 생활재료
  ],
  # 각인서 — 유물 등급만
  "engraving": [
    {"code": 40000, "grade": "유물"},  # 전투 각인서
    {"code": 45000, "grade": "유물"},  # 직업 각인서
  ],
}

# ── 시세 목록 조회 ─────────────────────────────────────────────
# GET /api/market/{category}/items
# category: refine | life | engraving
@router.get("/{category}/items")
async def get_items(category: str):
  if category not in CATEGORY_MAP:
    raise HTTPException(status_code=404, detail=f"지원하지 않는 카테고리입니다: {category}")

  import asyncio
  from app.lostark import get_market_items as _get

  configs = CATEGORY_MAP[category]

  # ✅ 최적화: asyncio.gather — 여러 카테고리를 병렬 조회 (재련 재료 2개 동시 호출)
  async def fetch_one(cfg):
    return await _get(cfg["code"], cfg.get("grade"))

  results = await asyncio.gather(*[fetch_one(c) for c in configs])

  # 여러 카테고리 결과 병합
  merged: list = []
  for res in results:
    items = res.get("Items") or []
    for item in items:
      merged.append({
        "id":            item.get("Id"),
        "name":          item.get("Name"),
        "grade":         item.get("Grade"),
        "icon":          item.get("Icon"),
        "current_min_price": item.get("CurrentMinPrice"),
        # 변동량 · 변동률: 전일 평균가 대비 현재 최저가 기준
        "diff":     _calc_diff(item.get("CurrentMinPrice"), item.get("YDayAvgPrice")),
        "diff_pct": _calc_pct(item.get("CurrentMinPrice"), item.get("YDayAvgPrice")),
      })

  return merged


# ── 히스토리 조회 (차트용) ────────────────────────────────────
# GET /api/market/history/{item_id}?grade=유물
@router.get("/history/{item_id}")
async def get_history(item_id: int, grade: str = Query(...)):
  data = await get_market_item_history(item_id, grade)
  if not data:
    raise HTTPException(status_code=404, detail="히스토리 데이터를 찾을 수 없습니다.")

  # ✅ 최적화: 응답 필드 최소화 — 불필요한 필드 제거 후 반환
  return [
    {
      "date":        row.get("Date", "")[:10],  # YYYY-MM-DD 만 사용
      "avg_price":   row.get("AvgPrice"),
      "trade_count": row.get("TradeCount"),
    }
    for row in data
  ]


# ── 내부 유틸 ─────────────────────────────────────────────────
def _calc_diff(current: float | None, yday: float | None) -> float | None:
  if current is None or yday is None or yday == 0:
    return None
  return round(current - yday, 2)

def _calc_pct(current: float | None, yday: float | None) -> float | None:
  if current is None or yday is None or yday == 0:
    return None
  return round((current - yday) / yday * 100, 2)
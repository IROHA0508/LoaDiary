import client from './client'

const WORKER_URL = 'https://loadiary-market.siwonl0508.workers.dev'

const normalize = (data) => ({
  items:      Array.isArray(data) ? data : (data.items ?? []),
  updated_at: Array.isArray(data) ? null  : (data.updated_at ?? null),
})

export const getJewelItems     = () => fetch(`${WORKER_URL}/jewel`).then(r => r.json()).then(normalize)
export const getEngravingItems = () => fetch(`${WORKER_URL}/engraving`).then(r => r.json()).then(normalize)

export const getMarketItems = (category) => {
  if (category === 'engraving') return getEngravingItems()
  return fetch(`${WORKER_URL}/${category}`).then(r => r.json()).then(normalize)
}

// ✅ 재련·생활: 백엔드 API (TradeCount 포함)
// ✅ 각인서: Worker KV (백엔드 미제공)
export const getItemHistory = (category, itemName, itemId) => {
  // ✅ itemId가 있으면 모든 카테고리에서 백엔드 API 사용 (AvgPrice + TradeCount 포함)
  if (itemId) {
    return client.get(`/api/market/history/${itemId}`)
      .then(r => r.data)
      .catch(() => [])
  }
  // itemId 없는 경우(보석 등) Worker KV 폴백
  return fetch(`${WORKER_URL}/history?category=${category}&name=${encodeURIComponent(itemName)}`)
    .then(r => r.json())
    .catch(() => [])
}

// 하위 호환성 유지 (기존 코드에서 사용 중인 경우 대비)
export const getMarketHistory = (itemId, grade, category, itemName) =>
  getItemHistory(category, itemName)
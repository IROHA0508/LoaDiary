import client from './client'

const WORKER_URL = 'https://loadiary-market.siwonl0508.workers.dev'

// Worker 응답: { items: [...], updated_at: "..." }
// 백엔드 응답: 배열 → 동일 형태로 정규화
const normalize = (data) => ({
  items:      Array.isArray(data) ? data : (data.items ?? []),
  updated_at: Array.isArray(data) ? null  : (data.updated_at ?? null),
})

export const getJewelItems     = () => fetch(`${WORKER_URL}/jewel`).then(r => r.json()).then(normalize)
export const getEngravingItems = () => fetch(`${WORKER_URL}/engraving`).then(r => r.json()).then(normalize)

// ✅ 모든 카테고리를 Worker에서 처리
export const getMarketItems = (category) => {
  if (category === 'engraving') return getEngravingItems()
  return fetch(`${WORKER_URL}/${category}`).then(r => r.json()).then(normalize)
}

export const getMarketHistory = (itemId, grade) =>
  client.get(`/api/market/history/${itemId}`, { params: { grade } }).then(r => r.data)
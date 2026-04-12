import client from './client'

// ── 거래소 시세 목록 조회 ─────────────────────────────────────
// category: 'refine' | 'life' | 'engraving'
export const getMarketItems = (category) =>
  client.get(`/api/market/${category}/items`).then((r) => r.data)

// ── 거래소 히스토리 조회 (차트용) ─────────────────────────────
// itemId: number, grade: string (ex. "유물", "고급" ...)
export const getMarketHistory = (itemId, grade) =>
  client.get(`/api/market/history/${itemId}`, { params: { grade } }).then((r) => r.data)

// ── 경매장 보석 전체 조회 ─────────────────────────────────────
export const getJewelItems = () =>
  client.get('/api/jewel/items').then((r) => r.data)
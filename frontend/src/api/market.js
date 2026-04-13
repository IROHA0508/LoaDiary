import client from './client'

const WORKER_URL = 'https://loadiary-market.siwonl0508.workers.dev'

// ── 각인서·보석: Cloudflare Worker KV (즉시 반환) ─────────────
export const getJewelItems = () =>
  fetch(`${WORKER_URL}/jewel`).then(r => r.json())

export const getEngravingItems = () =>
  fetch(`${WORKER_URL}/engraving`).then(r => r.json())

// ── 재련·생활: 기존 백엔드 (히스토리 차트 필요) ───────────────
export const getMarketItems = (category) => {
  if (category === 'engraving') return getEngravingItems()
  return client.get(`/api/market/${category}/items`).then(r => r.data)
}

// ── 히스토리 (차트용) — 기존 백엔드 유지 ─────────────────────
export const getMarketHistory = (itemId, grade) =>
  client.get(`/api/market/history/${itemId}`, { params: { grade } }).then(r => r.data)
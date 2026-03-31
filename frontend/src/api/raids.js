import client from './client'

// 내가 만든 레이드 목록 조회
export const getMyRaids = (fingerprint) => client.get(`/api/raids/my/${fingerprint}`).then( r => r.data)

// 레이드 생성
// payload: { raid_name, difficulty, max_slots, created_by } 객체
export const createRaid = (payload) => client.post('/api/raids/', payload).then(r => r.data)

// 레이드 삭제
// 응답 데이터가 없어서 .then(r => r.data) 필요 없음
export const deleteRaid = (raidId) => client.delete(`/api/raids/${raidId}`) 

// 특정 레이드 슬롯(캐릭처 배치) 목록 조회
export const getSlots = (raidId) => client.get(`/api/raids/${raidId}/slots`).then(r => r.data)

// 슬롯에 캐릭터 배치
// payload: { character_id, slot_order, role }
export const addSlot = (raidId, payload) => client.post(`/api/raids/${raidId}/slots`, payload).then(r => r.data)

// 슬롯에서 캐릭터 제거
export const removeSlot = (slotId) => client.delete(`/api/raids/slots/${slotId}`)

// 내 캐릭터가 슬롯에 배치된 레이드 목록 조회
export const getJoinedRaids = (fingerprint) => client.get(`/api/raids/joined/${fingerprint}`).then(r => r.data)

// 레이드 + 슬롯 통합 조회 (메인페이지 최적화용)
export const getAllRaidsWithSlots = (fingerprint) =>
  client.get(`/api/raids/all-with-slots/${fingerprint}`).then(r => r.data)
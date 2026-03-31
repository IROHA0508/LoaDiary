import client from './client'

// 유저 생성 or 기존 유저 조회 함수
// fingerprint : 브라우저 고유 ID, representative : 대표 캐릭터명
export const createOrGetUser = (fingerprint, representative) => client.post('/api/users/', {fingerprint, representative}).then(r => r.data)

// fingerprint로 유저 조회 함수
export const getUser = (fingerprint) => client.get(`/api/users/${fingerprint}`).then(r => r.data)

// 레이드 순서 조회
export const getRaidOrder = (fingerprint) =>
  client.get(`/api/users/${fingerprint}/raid-order`).then(r => r.data.raid_order)

// 레이드 순서 저장
export const saveRaidOrder = (fingerprint, raidIds) =>
  client.patch(`/api/users/${fingerprint}/raid-order`, { raid_ids: raidIds }).then(r => r.data)
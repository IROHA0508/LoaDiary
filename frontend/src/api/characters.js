import client from './client'
 
// 내 캐릭터 목록 조회
export const getCharacters = (fingerprint) => client.get(`/api/characters/${fingerprint}`).then(r => r.data)
 
// 캐릭터 동기화 (로스트아크 API 호출 후 DB 저장)
// sync는 LoA 외부 API를 거치므로 slowClient 사용
export const syncCharacters = (fingerprint, representative) =>
  slowClient.post(`/api/characters/${fingerprint}/sync`, null, {
    params: { representative }
  }).then(r => r.data)

// 전체 동기화: 내 캐릭터 + 레이드 멤버 전원
// 반환: { synced: [...], failed: [...] }
// sync-all도 동일하게 slowClient 사용
export const syncAll = (fingerprint) =>
  slowClient.post(`/api/characters/${fingerprint}/sync-all`).then(r => r.data)
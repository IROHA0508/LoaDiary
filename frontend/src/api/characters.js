import client from './client'

// 내 캐릭터 목록 조회
export const getCharacters = (fingerprint) => client.get(`/api/characters/${fingerprint}`).then(r => r.data)

// 캐릭터 동기화 (로스트아크 API 호출 후 DB 저장)
// null: body가 없는 POST 요청
export const syncCharacters = (fingerprint, representative) => client.post(`/api/characters/${fingerprint}/sync`, null,{
  // params: URL 뒤에  ?representative=캐릭터명 형태로 붙여서 전달
  params: {representative}
}).then(r => r.data)
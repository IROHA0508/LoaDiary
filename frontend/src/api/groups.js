import client from './client'

// 내 그룹 목록 조회 (멤버 포함)
export const getMyGroups = (fingerprint) =>
  client.get(`/api/groups/${fingerprint}`).then(r => r.data)

// 그룹 생성 (자동 이름: 그룹1, 그룹2, ...)
export const createGroup = (fingerprint) =>
  client.post('/api/groups/', { fingerprint }).then(r => r.data)

// 그룹 이름 수정
export const updateGroupName = (groupId, name) =>
  client.patch(`/api/groups/${groupId}`, { name }).then(r => r.data)

// 그룹 삭제
export const deleteGroup = (groupId) =>
  client.delete(`/api/groups/${groupId}`)

// 멤버 추가 (대표 캐릭터명)
export const addGroupMember = (groupId, representative) =>
  client.post(`/api/groups/${groupId}/members`, { representative }).then(r => r.data)

// 멤버 제거
export const removeGroupMember = (groupId, memberRowId) =>
  client.delete(`/api/groups/${groupId}/members/${memberRowId}`)
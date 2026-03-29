import client from './client'

export const getMyGroups = (fingerprint) =>
  client.get(`/api/groups/${fingerprint}`).then(r => r.data)

// name 없으면 자동 이름 (그룹1, 2…)
export const createGroup = (fingerprint, name = null) =>
  client.post('/api/groups/', { fingerprint, name }).then(r => r.data)

export const updateGroupName = (groupId, name) =>
  client.patch(`/api/groups/${groupId}`, { name }).then(r => r.data)

// 그룹 자체 순서 변경 (group_id 배열 순서대로)
export const reorderGroups = (fingerprint, groupIds) =>
  client.patch('/api/groups/reorder', { fingerprint, group_ids: groupIds }).then(r => r.data)

export const deleteGroup = (groupId) =>
  client.delete(`/api/groups/${groupId}`)

export const addGroupMember = (groupId, representative) =>
  client.post(`/api/groups/${groupId}/members`, { representative }).then(r => r.data)

// 멤버 순서 변경
export const reorderGroupMembers = (groupId, memberIds) =>
  client.patch(`/api/groups/${groupId}/members/reorder`, { member_ids: memberIds }).then(r => r.data)

export const removeGroupMember = (groupId, memberRowId) =>
  client.delete(`/api/groups/${groupId}/members/${memberRowId}`)
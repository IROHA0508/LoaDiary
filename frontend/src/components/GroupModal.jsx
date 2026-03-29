import { useState, useRef, useEffect } from 'react'
import { updateGroupName, addGroupMember, removeGroupMember, deleteGroup } from '../api/groups'

/* ───────────────────────────────────────────────────────────
   GroupModal
   props:
     group        – { id, name, members: [{member_row_id, user_id, representative}] }
     onClose      – 닫기 콜백
     onUpdated    – 서버 응답 최신 group 데이터로 로컬 상태 갱신
     onDeleted    – 그룹 삭제 후 콜백
─────────────────────────────────────────────────────────── */
export default function GroupModal({ group, onClose, onUpdated, onDeleted }) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState(group.name)
  const [nameSaving, setNameSaving]   = useState(false)

  const [addInput, setAddInput]     = useState('')
  const [addError, setAddError]     = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const [removingId, setRemovingId] = useState(null)
  const [deleting, setDeleting]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const nameRef = useRef(null)

  // 이름 편집 시작 시 인풋 포커스
  useEffect(() => {
    if (editingName) nameRef.current?.focus()
  }, [editingName])

  // 이름 저장
  const handleSaveName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === group.name) { setEditingName(false); return }
    setNameSaving(true)
    try {
      await updateGroupName(group.id, trimmed)
      onUpdated({ ...group, name: trimmed })
    } catch { setNameInput(group.name) }
    finally { setNameSaving(false); setEditingName(false) }
  }

  // 멤버 추가
  const handleAddMember = async () => {
    const rep = addInput.trim()
    if (!rep) return
    setAddLoading(true)
    setAddError('')
    try {
      const updated = await addGroupMember(group.id, rep)
      onUpdated(updated)
      setAddInput('')
    } catch (err) {
      const msg = err?.response?.data?.detail || '추가에 실패했습니다.'
      setAddError(msg)
    } finally { setAddLoading(false) }
  }

  // 멤버 제거
  const handleRemoveMember = async (memberRowId) => {
    setRemovingId(memberRowId)
    try {
      await removeGroupMember(group.id, memberRowId)
      onUpdated({
        ...group,
        members: group.members.filter(m => m.member_row_id !== memberRowId)
      })
    } catch {}
    finally { setRemovingId(null) }
  }

  // 그룹 삭제
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteGroup(group.id)
      onDeleted(group.id)
      onClose()
    } catch { setDeleting(false) }
  }

  return (
    // 오버레이
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      {/* 모달 패널 */}
      <div
        className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          {/* 그룹 이름 (편집 가능) */}
          {editingName ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                ref={nameRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameInput(group.name) } }}
                className="flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                maxLength={30}
              />
              <button
                onClick={handleSaveName}
                disabled={nameSaving}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {nameSaving ? '저장 중…' : '저장'}
              </button>
              <button
                onClick={() => { setEditingName(false); setNameInput(group.name) }}
                className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-200 transition-colors"
              >
                취소
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base font-semibold text-white truncate">{group.name}</span>
              <button
                onClick={() => setEditingName(true)}
                className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
                title="이름 편집"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81 3.28 11.28a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.25.25 0 00.108-.064L11.19 6.25z"/>
                </svg>
              </button>
            </div>
          )}

          {/* 닫기 */}
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 text-gray-500 hover:text-gray-200 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        {/* 멤버 목록 */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              원정대 멤버
            </span>
            <span className="text-xs text-gray-500">{group.members.length}개</span>
          </div>

          {/* 멤버 카드들 */}
          <div className="flex flex-col gap-2 mb-4 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {group.members.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">
                아직 멤버가 없어요.<br/>
                <span className="text-xs">아래에서 원정대를 추가해보세요.</span>
              </p>
            ) : (
              group.members.map(m => (
                <div
                  key={m.member_row_id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                      {(m.representative || '?')[0]}
                    </span>
                    <span className="text-sm text-gray-200">{m.representative}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(m.member_row_id)}
                    disabled={removingId === m.member_row_id}
                    className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    {removingId === m.member_row_id ? (
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25"/>
                        <path d="M21 12a9 9 0 00-9-9"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* 멤버 추가 입력 */}
          <div className="flex gap-2">
            <input
              value={addInput}
              onChange={e => { setAddInput(e.target.value); setAddError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAddMember()}
              placeholder="대표 캐릭터명 입력"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleAddMember}
              disabled={addLoading || !addInput.trim()}
              className="text-xs px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors whitespace-nowrap"
            >
              {addLoading ? '추가 중…' : '+ 추가'}
            </button>
          </div>
          {addError && (
            <p className="mt-1.5 text-xs text-red-400">{addError}</p>
          )}
        </div>

        {/* 푸터 – 그룹 삭제 */}
        <div className="px-5 py-3 border-t border-gray-800 flex justify-end">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">정말 삭제할까요?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 text-gray-400 hover:text-gray-200 transition-colors"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors"
            >
              그룹 삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
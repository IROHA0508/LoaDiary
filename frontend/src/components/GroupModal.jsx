import { useState, useRef, useEffect } from 'react'
import { updateGroupName, addGroupMember, removeGroupMember, deleteGroup, reorderGroupMembers } from '../api/groups'

/* ───────────────────────────────────────────────────────────
   GroupModal — 그룹 상세/편집 모달
   props:
     group     – { id, name, members: [{member_row_id, user_id, representative, sort_order}] }
     onClose   – 닫기
     onUpdated – 최신 group으로 로컬 상태 갱신
     onDeleted – 삭제 후 콜백
─────────────────────────────────────────────────────────── */
export default function GroupModal({ group, onClose, onUpdated, onDeleted }) {

  const [pendingName, setPendingName]     = useState(group.name)
  const [savedName, setSavedName]         = useState(group.name)
  const [editingName, setEditingName]     = useState(false)
  const [nameEditInput, setNameEditInput] = useState(group.name)

  const [addInput, setAddInput]           = useState('')
  const [addError, setAddError]           = useState('')

  const [deleting, setDeleting]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [savedMembers, setSavedMembers]     = useState(group.members)
  const [localMembers, setLocalMembers]     = useState(group.members)
  const [pendingAdds, setPendingAdds]       = useState([])
  const [pendingRemoves, setPendingRemoves] = useState(new Set())
  const [isSaving, setIsSaving]             = useState(false)
  const [savedSuccessfully, setSavedSuccessfully] = useState(false)

  const isDirty =
    pendingName.trim() !== savedName ||
    pendingAdds.length > 0 ||
    pendingRemoves.size > 0 ||
    !localMembers.every((m, i) => savedMembers[i]?.member_row_id === m.member_row_id)

  useEffect(() => {
    if (isDirty) setSavedSuccessfully(false)
  }, [isDirty])

  const dragIdx  = useRef(null)
  const dragOver = useRef(null)
  const nameRef  = useRef(null)

  useEffect(() => { if (editingName) nameRef.current?.focus() }, [editingName])
  useEffect(() => {
    setSavedMembers(group.members)
    setLocalMembers(group.members)
  }, [group.members])

  /* ── 이름 편집 확정 ── */
  const handleConfirmName = () => {
    const trimmed = nameEditInput.trim()
    if (trimmed) setPendingName(trimmed)
    else setNameEditInput(pendingName)
    setEditingName(false)
  }

  const handleCancelNameEdit = () => {
    setNameEditInput(pendingName)
    setEditingName(false)
  }

  /* ── 멤버 추가 — 로컬 상태만 업데이트 ── */
  const handleAddMember = () => {
    const rep = addInput.trim()
    if (!rep) return
    if (localMembers.some(m => m.representative === rep)) {
      setAddError('이미 추가된 멤버입니다.')
      return
    }
    const tempMember = {
      member_row_id: `temp-${Date.now()}`,
      representative: rep,
      sort_order: localMembers.length,
      isTemp: true,
    }
    setLocalMembers(prev => [...prev, tempMember])
    setPendingAdds(prev => [...prev, rep])
    setAddInput('')
    setAddError('')
  }

  /* ── 멤버 제거 — 로컬 상태만 업데이트 ── */
  const handleRemoveMember = (memberRowId) => {
    const target = localMembers.find(m => m.member_row_id === memberRowId)
    setLocalMembers(prev => prev.filter(m => m.member_row_id !== memberRowId))
    if (target?.isTemp) {
      setPendingAdds(prev => prev.filter(r => r !== target.representative))
    } else {
      setPendingRemoves(prev => new Set([...prev, memberRowId]))
    }
  }

  /* ── 드래그 순서 변경 — 로컬 상태만 업데이트 ── */
  const handleDragStart = (idx) => { dragIdx.current = idx }
  const handleDragOver  = (e, idx) => { e.preventDefault(); dragOver.current = idx }
  const handleDrop      = () => {
    const from = dragIdx.current
    const to   = dragOver.current
    if (from === null || to === null || from === to) return
    const reordered = [...localMembers]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setLocalMembers(reordered)
    dragIdx.current = null; dragOver.current = null
  }
  const handleDragEnd = () => { dragIdx.current = null; dragOver.current = null }

  /* ── 일괄 저장 ── */
  const handleSave = async () => {
    setIsSaving(true)
    setAddError('')

    const newName = pendingName.trim()
    let finalMembers = savedMembers  // API 성공 후 사용할 최신 멤버

    // ── API 호출만 try-catch로 감싸기 ──────────────────────
    try {
      // 1. 이름 변경
      if (newName !== savedName) {
        await updateGroupName(group.id, newName)
      }

      // 2. 멤버 제거 병렬 처리
      await Promise.all([...pendingRemoves].map(id => removeGroupMember(group.id, id)))

      // 3. 멤버 추가 순차 처리 (addGroupMember는 groups.js에서 slowClient 사용)
      for (const rep of pendingAdds) {
        await addGroupMember(group.id, rep)
      }

      // 4. 순서 변경 후 서버 최신 상태 받기
      //    - isTemp(미저장 추가 후 제거된 것) 제외
      //    - pendingRemoves 제외
      //    - localMembers 현재 순서 기준
      const reorderedIds = localMembers
        .filter(m => !m.isTemp && !pendingRemoves.has(m.member_row_id))
        .map(m => m.member_row_id)

      const freshGroup = await reorderGroupMembers(group.id, reorderedIds)
      // 서버 응답을 직접 사용 — 로컬 계산 없음
      finalMembers = freshGroup?.members ?? []

    } catch (err) {
      // API 실패 시: 에러 표시 + 롤백 후 종료
      console.error('GroupModal 저장 실패:', err)
      setAddError(err?.response?.data?.detail || '저장에 실패했습니다.')
      setPendingName(savedName)
      setNameEditInput(savedName)
      setLocalMembers(savedMembers)
      setPendingAdds([])
      setPendingRemoves(new Set())
      setIsSaving(false)
      return  // ← API 실패 시 여기서 종료 (onUpdated 호출 안 함)
    }

    // ── API 성공 후: try-catch 밖에서 상태 확정 및 콜백 호출 ──
    // onUpdated 등 콜백에서 발생하는 에러가 "저장 실패"로 오인되지 않도록
    setSavedName(newName)
    setSavedMembers(finalMembers)
    setLocalMembers(finalMembers)
    setPendingAdds([])
    setPendingRemoves(new Set())
    setSavedSuccessfully(true)
    setIsSaving(false)
    onUpdated({ ...group, name: newName, members: finalMembers })
  }

  /* ── 되돌리기 ── */
  const handleRevert = () => {
    setPendingName(savedName)
    setNameEditInput(savedName)
    setEditingName(false)
    setLocalMembers(savedMembers)
    setPendingAdds([])
    setPendingRemoves(new Set())
    setAddError('')
  }

  /* ── 그룹 삭제 ── */
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteGroup(group.id)
      onDeleted(group.id)
      onClose()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <>
      <style>{`
        .gm-scroll::-webkit-scrollbar { width: 3px; }
        .gm-scroll::-webkit-scrollbar-track { background: transparent; }
        .gm-scroll::-webkit-scrollbar-thumb { background: rgba(75,85,99,0.45); border-radius: 4px; }
        .gm-scroll::-webkit-scrollbar-thumb:hover { background: rgba(107,114,128,0.65); }
        @keyframes gm-spin { to { transform: rotate(360deg); } }
        .gm-spin { animation: gm-spin 0.8s linear infinite; }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.65)' }}
      >
        <div
          className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* ── 헤더 ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  ref={nameRef}
                  value={nameEditInput}
                  onChange={e => setNameEditInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleConfirmName()
                    if (e.key === 'Escape') handleCancelNameEdit()
                  }}
                  className="flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                  maxLength={30}
                />
                <button
                  onClick={handleConfirmName}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  확인
                </button>
                <button
                  onClick={handleCancelNameEdit}
                  className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-base font-semibold truncate ${pendingName !== savedName ? 'text-amber-300' : 'text-white'}`}>
                  {pendingName}
                </span>
                {pendingName !== savedName && (
                  <span className="flex-shrink-0 text-[10px] text-amber-400/70 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                    미저장
                  </span>
                )}
                <button
                  onClick={() => { setNameEditInput(pendingName); setEditingName(true) }}
                  className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
                  title="이름 편집"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81 3.28 11.28a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.25.25 0 00.108-.064L11.19 6.25z"/>
                  </svg>
                </button>
              </div>
            )}
            <button onClick={onClose} className="flex-shrink-0 ml-3 text-gray-500 hover:text-gray-200 transition-colors">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>

          {/* ── 바디 ── */}
          <div className="px-5 py-4 flex flex-col gap-4">

            {/* 멤버 추가 입력 */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">멤버 추가</label>
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
                  disabled={!addInput.trim()}
                  className="text-xs px-3 py-2 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  + 추가
                </button>
              </div>
              {addError && <p className="mt-1.5 text-xs text-red-400">{addError}</p>}
            </div>

            {/* 그룹 멤버 목록 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">그룹 멤버</span>
                <span className="text-xs text-gray-500">{localMembers.length}개</span>
              </div>

              <div
                className="gm-scroll flex flex-col gap-2 overflow-y-auto pr-0.5"
                style={{ minHeight: '208px', maxHeight: '208px' }}
              >
                {localMembers.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-gray-600">
                    아직 멤버가 없어요.
                  </div>
                ) : (
                  localMembers.map((m, idx) => {
                    const isTemp     = m.isTemp
                    const isRemoving = pendingRemoves.has(m.member_row_id)
                    return (
                      <div
                        key={m.member_row_id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        className="flex items-center justify-between bg-gray-800 rounded-lg px-2 py-2 cursor-default group/card"
                        style={{ opacity: isRemoving ? 0.4 : 1, transition: 'opacity 0.15s' }}
                      >
                        <div className="flex-shrink-0 flex flex-col gap-[3px] px-1 py-1 opacity-30 group-hover/card:opacity-70 transition-opacity cursor-grab active:cursor-grabbing">
                          <span className="block w-[14px] h-[1.5px] bg-gray-400 rounded"/>
                          <span className="block w-[14px] h-[1.5px] bg-gray-400 rounded"/>
                          <span className="block w-[14px] h-[1.5px] bg-gray-400 rounded"/>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0 ml-1">
                          <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                            {(m.representative || '?')[0]}
                          </span>
                          <span className="text-sm text-gray-200 truncate">{m.representative}</span>
                          {isTemp && (
                            <span className="flex-shrink-0 text-xs text-amber-400/70 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded text-[10px]">
                              미저장
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveMember(m.member_row_id)}
                          className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors ml-2"
                        >
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── 푸터 ── */}
          <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">

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
                  className="text-xs px-3 py-1.5 text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
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

            {isDirty ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRevert}
                  disabled={isSaving}
                  className="text-xs px-3 py-1.5 text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors disabled:opacity-40"
                >
                  되돌리기
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <svg className="gm-spin" width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="7 7"/>
                      </svg>
                      저장 중…
                    </>
                  ) : '저장'}
                </button>
              </div>
            ) : savedSuccessfully ? (
              <button
                onClick={onClose}
                className="text-xs px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
              >
                ✓ 완료
              </button>
            ) : null}

          </div>
        </div>
      </div>
    </>
  )
}
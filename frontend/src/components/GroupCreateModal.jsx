import { useState } from 'react'
import { createGroup, addGroupMember } from '../api/groups'

/* ───────────────────────────────────────────────────────────
   GroupCreateModal
   멤버를 미리 선택한 뒤 "완료"를 눌러야 그룹이 생성되는 플로우
   props:
     fingerprint – 현재 유저
     onClose     – 닫기 콜백
     onCreated   – 생성된 group 객체를 전달
─────────────────────────────────────────────────────────── */
export default function GroupCreateModal({ fingerprint, onClose, onCreated }) {
  // 로컬에서 관리하는 "추가할 멤버" 목록 (서버 저장 전)
  const [pendingMembers, setPendingMembers] = useState([]) // [{representative}]
  const [addInput, setAddInput]   = useState('')
  const [addError, setAddError]   = useState('')
  const [creating, setCreating]   = useState(false)

  /* 멤버 임시 추가 (서버 미저장) */
  const handleAddPending = () => {
    const rep = addInput.trim()
    if (!rep) return
    if (pendingMembers.some(m => m.representative === rep)) {
      setAddError('이미 추가된 원정대입니다.')
      return
    }
    setPendingMembers(prev => [...prev, { representative: rep }])
    setAddInput('')
    setAddError('')
  }

  const handleRemovePending = (rep) => {
    setPendingMembers(prev => prev.filter(m => m.representative !== rep))
  }

  /* 완료 → 그룹 생성 + 멤버 일괄 추가 */
  const handleComplete = async () => {
    if (creating) return
    setCreating(true)
    setAddError('')

    try {
      // 1. 그룹 생성 (자동 이름: 그룹N)
      const newGroup = await createGroup(fingerprint)

      // 2. 멤버 일괄 추가 (실패한 멤버는 오류 메시지에 포함)
      const failed = []
      for (const m of pendingMembers) {
        try {
          await addGroupMember(newGroup.id, m.representative)
        } catch (err) {
          const msg = err?.response?.data?.detail || m.representative
          failed.push(msg)
        }
      }

      // 3. 최종 그룹 데이터 구성
      const finalMembers = pendingMembers
        .filter(m => !failed.includes(m.representative))
        .map((m, i) => ({
          member_row_id: `temp-${i}`,
          user_id: '',
          representative: m.representative,
        }))

      // 부모에 알림 (실제 최신 데이터는 상위에서 재조회)
      onCreated({ ...newGroup, members: finalMembers })

      if (failed.length > 0) {
        setAddError(`추가 실패: ${failed.join(', ')}`)
        // 실패 메시지는 보여주되 모달은 닫지 않음 → 유저가 확인 후 닫기
        setTimeout(onClose, 2500)
      } else {
        onClose()
      }
    } catch {
      setAddError('그룹 생성에 실패했습니다. 다시 시도해주세요.')
      setCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <span className="text-base font-semibold text-white">새 그룹 만들기</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        {/* 바디 */}
        <div className="px-5 py-4">
          {/* 안내 문구 */}
          <p className="text-xs text-gray-500 mb-4">
            그룹에 추가할 원정대를 먼저 선택한 뒤 <span className="text-gray-300 font-medium">완료</span>를 눌러주세요.
            <br/>그룹 이름은 생성 후 변경할 수 있어요.
          </p>

          {/* 멤버 목록 레이블 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">원정대 멤버</span>
            <span className="text-xs text-gray-500">{pendingMembers.length}개</span>
          </div>

          {/* 멤버 카드 목록 */}
          <div
            className="raid-scroll flex flex-col gap-2 mb-4 overflow-y-auto pr-0.5"
            style={{ maxHeight: '192px' }}
          >
            {pendingMembers.length === 0 ? (
              <div className="text-sm text-gray-600 text-center py-5">
                아직 추가된 원정대가 없어요.
              </div>
            ) : (
              pendingMembers.map(m => (
                <div
                  key={m.representative}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                      {m.representative[0]}
                    </span>
                    <span className="text-sm text-gray-200">{m.representative}</span>
                  </div>
                  <button
                    onClick={() => handleRemovePending(m.representative)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
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
              onKeyDown={e => e.key === 'Enter' && handleAddPending()}
              placeholder="대표 캐릭터명 입력"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleAddPending}
              disabled={!addInput.trim()}
              className="text-xs px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-lg transition-colors whitespace-nowrap"
            >
              + 추가
            </button>
          </div>
          {addError && (
            <p className="mt-1.5 text-xs text-red-400">{addError}</p>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleComplete}
            disabled={creating}
            className="text-xs px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {creating ? '생성 중…' : '완료'}
          </button>
        </div>
      </div>
    </div>
  )
}
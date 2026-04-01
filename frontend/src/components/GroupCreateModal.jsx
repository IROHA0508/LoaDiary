import { useState } from 'react'
import { createGroup, addGroupMember } from '../api/groups'
import client from '../api/client'

/* ───────────────────────────────────────────────────────────
   GroupCreateModal
   플로우: ① 그룹 이름 → ② 멤버 추가(API 실시간 검증) → ③ 완료
─────────────────────────────────────────────────────────── */
export default function GroupCreateModal({ fingerprint, myRepresentative, onClose, onOptimisticCreate, onCreated, onCreateError }) {
  const [groupName, setGroupName]           = useState('')
  // myRepresentative가 있으면 자신을 첫 멤버로 초기값에 넣기
  const [pendingMembers, setPendingMembers] = useState(
    myRepresentative ? [{ representative: myRepresentative, isSelf: true }] : []
  )
  const [addInput, setAddInput]             = useState('')
  const [addError, setAddError]             = useState('')
  const [addLoading, setAddLoading]         = useState(false)
  const [creating, setCreating]             = useState(false)

  /* ── 멤버 추가: LoA API 기반 원정대 검증 (/api/users/resolve) ──
     - DB exact match가 아닌 LoA API로 실제 캐릭터 존재 여부 확인
     - HALUNAR 입력 시 → DALUNAR(대표 캐릭터)로 자동 해석해서 표시
  */
  const handleAddPending = async () => {
    const rep = addInput.trim()
    if (!rep) return
    setAddLoading(true)
    setAddError('')
    try {
      const res = await client.get(`/api/users/resolve?character_name=${encodeURIComponent(rep)}`)
      const canonical = res.data.representative  // 실제 원정대 대표 캐릭터명
      if (pendingMembers.some(m => m.representative === canonical)) {
        setAddError('이미 추가된 멤버입니다.')
        return
      }
      setPendingMembers(prev => [...prev, { representative: canonical }])
      setAddInput('')
    } catch (err) {
      const msg = err?.response?.data?.detail || '해당 캐릭터를 찾을 수 없어요. 캐릭터명을 다시 확인해주세요.'
      setAddError(msg)
    } finally {
      setAddLoading(false)
    }
  }

  const handleRemovePending = (rep) => {
    setPendingMembers(prev => prev.filter(m => m.representative !== rep))
  }

  /* ── 완료: 그룹 생성 → 검증된 멤버 일괄 추가 ──── */
  // isMounted ref 추가 (컴포넌트 상단)
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  const handleComplete = async () => {
    if (creating) return

    // ── 1. 낙관적 그룹 즉시 생성 ──
    const tempId = `temp_${Date.now()}`
    const optimisticGroup = {
      id: tempId,
      name: groupName.trim() || '새 그룹',
      members: pendingMembers.map((m, i) => ({
        member_row_id: `temp_${i}`,
        representative: m.representative,
        user_id: null,
        sort_order: i,
      })),
      _pending: true,
    }

    // ── 2. 즉시 모달 닫기 + 낙관적 UI 반영 ──
    onOptimisticCreate(optimisticGroup, tempId)
    onClose()

    // ── 3. 백그라운드에서 API 처리 ──
    try {
      let latestGroup = await createGroup(fingerprint, groupName.trim() || null)
      for (const m of pendingMembers) {
        if (m.isSelf) continue
        try {
          const updated = await addGroupMember(latestGroup.id, m.representative)
          if (updated) latestGroup = updated
        } catch {}
      }
      onCreated(latestGroup, tempId)   // tempId → 실제 그룹으로 교체
    } catch {
      onCreateError(tempId)            // 실패 시 낙관적 항목 제거
    }
  }

  return (
    <>
      <style>{`
        .gcm-scroll::-webkit-scrollbar { width: 3px; }
        .gcm-scroll::-webkit-scrollbar-track { background: transparent; }
        .gcm-scroll::-webkit-scrollbar-thumb { background: rgba(75,85,99,0.45); border-radius: 4px; }
        .gcm-scroll::-webkit-scrollbar-thumb:hover { background: rgba(107,114,128,0.65); }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.65)' }}
      >
        {/* GroupModal과 동일한 max-w-md, rounded-2xl */}
        <div
          className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* ── 헤더 (GroupModal과 동일: py-4, text-base) ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <span className="text-base font-semibold text-white">새 그룹 만들기</span>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>

          {/* ── 바디 (GroupModal과 동일: px-5 py-4) ── */}
          <div className="px-5 py-4 flex flex-col gap-4">

            {/* ① 그룹 이름 */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">그룹 이름</label>
              <input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && document.getElementById('gcm-rep-input')?.focus()}
                placeholder="비워두면 자동 지정 (그룹1, 그룹2…)"
                maxLength={30}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* ② 멤버 추가 입력 */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">멤버 추가</label>
              <div className="flex gap-2">
                <input
                  id="gcm-rep-input"
                  value={addInput}
                  onChange={e => { setAddInput(e.target.value); setAddError('') }}
                  onKeyDown={e => e.key === 'Enter' && !addLoading && handleAddPending()}
                  placeholder="대표 캐릭터명 입력"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  onClick={handleAddPending}
                  disabled={addLoading || !addInput.trim()}
                  className="text-xs px-3 py-2 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {addLoading ? (
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25"/>
                      <path d="M21 12a9 9 0 00-9-9"/>
                    </svg>
                  ) : '+ 추가'}
                </button>
              </div>
              {addError && <p className="mt-1.5 text-xs text-red-400">{addError}</p>}
            </div>

            {/* ③ 그룹 멤버 목록 (GroupModal과 동일한 maxHeight) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">그룹 멤버</span>
                <span className="text-xs text-gray-500">{pendingMembers.length}명</span>
              </div>
              <div className="gcm-scroll overflow-y-auto pr-0.5" style={{ minHeight: '208px', maxHeight: '208px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingMembers.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="text-sm text-gray-600">
                    아직 추가된 멤버가 없어요.
                  </div>
                ) : (
                  pendingMembers.map(m => (
                    <div key={m.representative} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                          {m.representative[0]}
                        </span>
                        <span className="text-sm text-gray-200">{m.representative}</span>
                        {m.isSelf && (
                          <span className="text-[10px] text-blue-400 bg-blue-400/10 border border-blue-400/20 px-1.5 py-0.5 rounded">내 원정대</span>
                        )}
                      </div>
                      {!m.isSelf && (
                        <button
                          onClick={() => handleRemovePending(m.representative)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── 푸터 (GroupModal의 삭제 푸터와 동일 높이: py-3) ── */}
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
    </>
  )
}
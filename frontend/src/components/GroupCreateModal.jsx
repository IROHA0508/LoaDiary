import { useState } from 'react'
import { createGroup, addGroupMember } from '../api/groups'

/* ───────────────────────────────────────────────────────────
   GroupCreateModal
   플로우: ① 그룹 이름 입력 → ② 원정대 추가 입력 → ③ 멤버 목록 확인 → 완료
─────────────────────────────────────────────────────────── */
export default function GroupCreateModal({ fingerprint, onClose, onCreated }) {
  const [groupName, setGroupName]           = useState('')
  const [pendingMembers, setPendingMembers] = useState([])
  const [addInput, setAddInput]             = useState('')
  const [addError, setAddError]             = useState('')
  const [creating, setCreating]             = useState(false)

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

  const handleComplete = async () => {
    if (creating) return
    setCreating(true)
    setAddError('')
    try {
      const newGroup = await createGroup(fingerprint, groupName.trim() || null)
      const failed = []
      for (const m of pendingMembers) {
        try { await addGroupMember(newGroup.id, m.representative) }
        catch (err) { failed.push(err?.response?.data?.detail || m.representative) }
      }
      if (failed.length > 0) {
        setAddError(`추가 실패: ${failed.join(', ')}`)
        setTimeout(onClose, 2500)
      }
      onCreated(newGroup)
      if (failed.length === 0) onClose()
    } catch {
      setAddError('그룹 생성에 실패했습니다.')
      setCreating(false)
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
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
        <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">새 그룹 만들기</span>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>

          {/* 바디 */}
          <div className="px-5 py-3 flex flex-col gap-3">

            {/* ① 그룹 이름 */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">그룹 이름</label>
              <input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && document.getElementById('gcm-rep-input')?.focus()}
                placeholder="비워두면 자동 지정 (그룹1, 그룹2…)"
                maxLength={30}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* ② 멤버 추가 입력 (목록보다 위) */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">멤버 추가</label>
              <div className="flex gap-2">
                <input
                  id="gcm-rep-input"
                  value={addInput}
                  onChange={e => { setAddInput(e.target.value); setAddError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleAddPending()}
                  placeholder="대표 캐릭터명 입력"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  onClick={handleAddPending}
                  disabled={!addInput.trim()}
                  className="text-xs px-3 py-1.5 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  + 추가
                </button>
              </div>
              {addError && <p className="mt-1 text-xs text-red-400">{addError}</p>}
            </div>

            {/* ③ 그룹 멤버 목록 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">그룹 멤버</span>
                <span className="text-xs text-gray-500">{pendingMembers.length}개</span>
              </div>
              <div className="gcm-scroll flex flex-col gap-1.5 overflow-y-auto pr-0.5" style={{ minHeight: 160, maxHeight: 228 }}>
                {pendingMembers.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-gray-600" style={{ minHeight: 160 }}>아직 추가된 멤버가 없어요.</div>
                ) : (
                  pendingMembers.map(m => (
                    <div key={m.representative} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">{m.representative[0]}</span>
                        <span className="text-sm text-gray-200">{m.representative}</span>
                      </div>
                      <button onClick={() => handleRemovePending(m.representative)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div className="px-5 py-2.5 border-t border-gray-800 flex items-center justify-between">
            <button onClick={onClose} className="text-xs px-4 py-2 text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors">취소</button>
            <button onClick={handleComplete} disabled={creating} className="text-xs px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors">
              {creating ? '생성 중…' : '완료'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCharacters } from '../api/characters'
import { getMyRaids, getJoinedRaids, deleteRaid, getSlots } from '../api/raids'
import { useUser } from '../hooks/useUser'

/* ─────────────────────────────────────────────
   레이드 섹션 레이아웃 상수
   ───────────────────────────────────────────── */
const RAID_ROW_HEIGHT = 56        // 레이드 1행 높이(px) — py-3.5(14px*2) + 내용
const RAID_SCROLL_THRESHOLD = 5   // 이 개수부터 스크롤 활성화
const RAID_SECTION_HEIGHT = RAID_ROW_HEIGHT * RAID_SCROLL_THRESHOLD  // 280px

/* ─────────────────────────────────────────────
   난이도 배지 스타일
   ───────────────────────────────────────────── */
const DIFF_STYLE = {
  '노말':       'bg-green-900/50 text-green-400',
  '하드':       'bg-red-900/50 text-red-400',
  '나이트메어': 'bg-purple-900/50 text-purple-400',
  '1단계':      'bg-gray-700 text-gray-300',
  '2단계':      'bg-yellow-900/50 text-yellow-400',
  '3단계':      'bg-red-900/50 text-red-400',
}

/* ─────────────────────────────────────────────
   딜러 아이콘 (빨간 칼)
   ───────────────────────────────────────────── */
const DealerIcon = () => (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
    <line x1="2" y1="10" x2="10" y2="2" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
    <line x1="8" y1="1" x2="11" y2="4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="2" y1="9" x2="4" y2="7" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
)

/* ─────────────────────────────────────────────
   서포터 아이콘 (초록 십자가)
   ───────────────────────────────────────────── */
const SupportIcon = () => (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
    <rect x="4.5" y="1" width="3" height="10" rx="1.2" fill="#22c55e"/>
    <rect x="1" y="4.5" width="10" height="3" rx="1.2" fill="#22c55e"/>
  </svg>
)

/* ─────────────────────────────────────────────
   드래그 핸들 아이콘 (세 줄)
   ───────────────────────────────────────────── */
const DragHandle = () => (
  <div className="flex flex-col gap-[3px] cursor-grab active:cursor-grabbing px-1 py-1 flex-shrink-0">
    <span className="block w-[14px] h-[1.5px] bg-gray-600 rounded"/>
    <span className="block w-[14px] h-[1.5px] bg-gray-600 rounded"/>
    <span className="block w-[14px] h-[1.5px] bg-gray-600 rounded"/>
  </div>
)

/* ─────────────────────────────────────────────
   직업 → 시너지 매핑 (아크패시브 깨달음 기준)
   CSV: lostark_class_arkpassive_synergy.csv
   ───────────────────────────────────────────── */
// 시너지 태그 정의: { id, label, color }
const SYNERGY_META = {
  방깎:     { label: '방깎',   bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   text: '#f87171' },
  피증:     { label: '피증',   bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.4)',  text: '#60a5fa' },
  방향성피증: { label: '방향피증', bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.35)', text: '#22d3ee' },
  치적:     { label: '치적',   bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.4)',  text: '#fbbf24' },
  치피증:   { label: '치피증', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)',  text: '#fb923c' },
  공증:     { label: '공증',   bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   text: '#4ade80' },
  마나재생:  { label: '마나재생', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.4)', text: '#a78bfa' },
}

// 표시 우선순위 (중요도 순)
const SYNERGY_ORDER = ['방깎', '피증', '방향성피증', '치적', '치피증', '공증', '마나재생']

// 직업 → 시너지 태그 배열 (CSV 기반)
const CLASS_SYNERGY = {
  '아르카나':     ['치적'],
  '서머너':       ['방깎', '마나재생'],
  '소서리스':     ['피증'],
  '바드':         ['방깎', '마나재생'],
  '디스트로이어': ['방깎'],
  '워로드':       ['피증', '방향성피증', '방깎'],  // 전투태세: 방깎도 포함
  '버서커':       ['피증'],
  '홀리나이트':   ['치피증'],
  '슬레이어':     ['피증'],
  '발키리':       ['치피증'],
  '배틀마스터':   ['치적'],
  '인파이터':     ['피증'],
  '기공사':       ['공증'],
  '창술사':       ['치피증'],
  '스트라이커':   ['치적'],
  '브레이커':     ['피증'],
  '데빌헌터':     ['치적'],
  '블래스터':     ['방깎'],
  '호크아이':     ['피증'],
  '스카우터':     ['공증'],
  '건슬링어':     ['치적'],
  '블레이드':     ['피증', '방향성피증'],
  '데모닉':       ['피증'],
  '리퍼':         ['방깎'],
  '소울이터':     ['피증'],
  '기상술사':     ['치적'],
  '환수사':       ['방깎'],
  '도화가':       ['방깎'],
  '가디언나이트': ['피증'],
}

// 파티 내 배치된 캐릭터들의 시너지 태그 집합을 계산
// is_support === true 인 캐릭터(발키리-빛의기사, 도화가-만개, 바드-절실한구원, 홀리나이트-축복의오라 등)는
// 서포터 빌드로 시너지를 제공하지 않으므로 제외
function calcPartySynergies(partySlots) {
  const synSet = new Set()
  partySlots.forEach(({ char }) => {
    if (!char?.class_name) return
    if (char.is_support === true) return   // 서포터 빌드 → 시너지 없음
    const tags = CLASS_SYNERGY[char.class_name] || []
    tags.forEach(t => synSet.add(t))
  })
  // 우선순위 순으로 정렬해서 반환
  return SYNERGY_ORDER.filter(s => synSet.has(s))
}

/* ─────────────────────────────────────────────
   시너지 뱃지 컴포넌트
   ───────────────────────────────────────────── */
const SynergyBadge = ({ tag, faded }) => {
  const meta = SYNERGY_META[tag]
  if (!meta) return null
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '1px 5px',
        borderRadius: 4,
        border: `1px solid ${faded ? 'rgba(100,116,139,0.2)' : meta.border}`,
        background: faded ? 'transparent' : meta.bg,
        color: faded ? '#4b5563' : meta.text,
        flexShrink: 0,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  )
}

/* ─────────────────────────────────────────────
   메인 페이지
   ───────────────────────────────────────────── */
export default function MainPage() {
  const { fingerprint } = useUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [raidToDelete, setRaidToDelete] = useState(null)
  // 캐릭터 검색 (헤더 검색창 연결용)
  const [charSearch, setCharSearch] = useState('')

  const handleCharSearch = (e) => {
    e.preventDefault()
    const name = charSearch.trim()
    if (name) {
      setCharSearch('')
      navigate(`/characters/${name}`)
    }
  }

  // 드래그 관련 상태
  const [raidOrder, setRaidOrder] = useState([])
  const [orderedRaids, setOrderedRaids] = useState([])
  const dragIndex = useRef(null)
  const dragOverIndex = useRef(null)

  // 레이드별 슬롯 데이터: { [raidId]: [{slot_order, ...}] }
  const [slotsMap, setSlotsMap] = useState({})

  // ── [수정 1·3·4] 완료된 레이드 ID Set ──────────
  const [completedRaids, setCompletedRaids] = useState(new Set())

  /* ── 데이터 조회 ──────────────────────────── */
  const { data: characters = [], isLoading: charLoading } = useQuery({
    queryKey: ['characters', fingerprint],
    queryFn: () => getCharacters(fingerprint),
    enabled: !!fingerprint,
  })

  // 내가 만든 레이드
  const { data: myRaids = [], isLoading: myRaidsLoading } = useQuery({
    queryKey: ['myRaids', fingerprint],
    queryFn: () => getMyRaids(fingerprint),
    enabled: !!fingerprint,
  })

  // 내가 참여한 레이드
  const { data: joinedRaids = [], isLoading: joinedRaidsLoading } = useQuery({
    queryKey: ['joinedRaids', fingerprint],
    queryFn: () => getJoinedRaids(fingerprint),
    enabled: !!fingerprint,
    onSuccess: (data) => {
      const merged = [
        ...myRaids,
        ...data.filter(jr => !myRaids.some(mr => mr.id === jr.id))
      ]
      setOrderedRaids(merged)
      setRaidOrder(merged.map(r => r.id))
    }
  })

  const raidLoading = myRaidsLoading || joinedRaidsLoading

  // 중복 제거 후 합치기
  const rawRaids = [
    ...myRaids,
    ...joinedRaids.filter(jr => !myRaids.some(mr => mr.id === jr.id))
  ]

  // 순서 배열 기반으로 raids 정렬
  const baseRaids = raidOrder.length > 0
    ? raidOrder.map(id => rawRaids.find(r => r.id === id)).filter(Boolean)
    : rawRaids

  // ── [수정 3] 완료된 레이드는 항상 맨 아래로 ──
  const raids = [
    ...baseRaids.filter(r => !completedRaids.has(r.id)),
    ...baseRaids.filter(r => completedRaids.has(r.id)),
  ]

  // ── [수정 1] 완료 개수 ──────────────────────
  const completedCount = completedRaids.size

  // raids가 확정되면 각 레이드의 슬롯 일괄 조회
  // rawRaids가 바뀔 때마다 새 레이드의 슬롯만 추가 조회
  const prevRaidIdsRef = useRef(new Set())
  if (!raidLoading && rawRaids.length > 0) {
    const newIds = rawRaids.filter(r => !prevRaidIdsRef.current.has(r.id))
    if (newIds.length > 0) {
      newIds.forEach(r => prevRaidIdsRef.current.add(r.id))
      Promise.all(newIds.map(r => getSlots(r.id).then(slots => ({ id: r.id, slots }))))
        .then(results => {
          setSlotsMap(prev => {
            const next = { ...prev }
            results.forEach(({ id, slots }) => { next[id] = slots })
            return next
          })
        })
    }
  }

  /* ── 레이드 삭제 ──────────────────────────── */
  const deleteMutation = useMutation({
    mutationFn: (raidId) => deleteRaid(raidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRaids', fingerprint] })
      queryClient.invalidateQueries({ queryKey: ['joinedRaids', fingerprint] })
      setRaidToDelete(null)
    },
  })

  /* ── 드래그 앤 드롭 핸들러 ────────────────── */
  const handleDragStart = (index) => {
    dragIndex.current = index
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    dragOverIndex.current = index
  }

  const handleDrop = () => {
    const from = dragIndex.current
    const to = dragOverIndex.current
    if (from === null || to === null || from === to) return

    const newRaids = [...raids]
    const [moved] = newRaids.splice(from, 1)
    newRaids.splice(to, 0, moved)

    setRaidOrder(newRaids.map(r => r.id))
    dragIndex.current = null
    dragOverIndex.current = null
  }

  const handleDragEnd = () => {
    dragIndex.current = null
    dragOverIndex.current = null
  }

  /* ── 내가 만든 레이드 여부 ────────────────── */
  const isMyRaid = (raidId) => myRaids.some(r => r.id === raidId)

  /* ── [수정 2] 완료 토글 ─────────────────── */
  const toggleCompleted = (e, raidId) => {
    e.stopPropagation()
    setCompletedRaids(prev => {
      const next = new Set(prev)
      if (next.has(raidId)) {
        next.delete(raidId)
      } else {
        next.add(raidId)
      }
      return next
    })
  }

  return (
    <div>
      {/* ── 커스텀 스크롤바 스타일 ── */}
      <style>{`
        .raid-scroll::-webkit-scrollbar { width: 3px; }
        .raid-scroll::-webkit-scrollbar-track { background: transparent; }
        .raid-scroll::-webkit-scrollbar-thumb {
          background: rgba(75, 85, 99, 0.45);
          border-radius: 4px;
        }
        .raid-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.65);
        }
      `}</style>

      {/* ── 바디 레이아웃 — Layout 헤더와 동일한 max-w-[1400px] px-8 flex gap-5 ── */}
      <div className="max-w-[1400px] mx-auto px-8 py-6 flex gap-5">

        {/* ── 메인 영역 ──────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col gap-4">

          {/* 내 레이드 섹션 */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* 섹션 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              {/* ── [수정 1] 헤더 왼쪽: 제목 + 완료 카운터 ── */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-300">내 레이드</span>
                {completedCount > 0 && (
                  <span className="text-xs text-emerald-400/80 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                    완료한 레이드 : {completedCount}개
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/raids/new')}
                className="text-xs text-gray-400 px-3 py-1 border border-gray-700 rounded-md hover:bg-gray-800 hover:text-white transition-colors"
              >
                + 레이드 생성
              </button>
            </div>

            {/* 레이드 목록 */}
            {raidLoading ? (
              <div className="px-4 py-5 text-sm text-gray-500">불러오는 중...</div>
            ) : raids.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center" style={{ height: `${RAID_SECTION_HEIGHT}px` }}>
                <p className="text-sm text-gray-500">참여 중인 레이드가 없어요.</p>
                <button
                  onClick={() => navigate('/raids/new')}
                  className="mt-3 text-sm text-blue-400 hover:text-blue-300"
                >
                  첫 레이드 만들기 →
                </button>
              </div>
            ) : (
              // ── [수정 5] 6개 초과 시 스크롤 ──────────────
              <div
                className="raid-scroll overflow-y-auto"
                style={{
                  minHeight: `${RAID_SECTION_HEIGHT}px`,
                  maxHeight: raids.length >= RAID_SCROLL_THRESHOLD ? `${RAID_SECTION_HEIGHT}px` : 'none',
                }}
              >
                {raids.map((raid, index) => {
                  const isDone = completedRaids.has(raid.id)
                  const raidSlots = (slotsMap[raid.id] || []).slice().sort((a, b) => a.slot_order - b.slot_order)

                  // 파티 구조 생성 (4인 1파티)
                  const PARTY_SIZE = 4
                  const numParties = Math.ceil(raid.max_slots / PARTY_SIZE)
                  const parties = Array.from({ length: numParties }, (_, pi) => {
                    const slotIndices = Array.from(
                      { length: Math.min(PARTY_SIZE, raid.max_slots - pi * PARTY_SIZE) },
                      (_, si) => pi * PARTY_SIZE + si
                    )
                    const slots = slotIndices.map(order => {
                      const slotData = raidSlots.find(s => s.slot_order === order)
                      const myChar = slotData ? characters.find(c => c.id === slotData.character_id) : null
                      return {
                        order,
                        char: slotData ? {
                          name:       slotData.character_name ?? myChar?.name       ?? null,
                          is_support: slotData.is_support     ?? myChar?.is_support ?? null,
                          class_name: slotData.class_name     ?? myChar?.class_name ?? null,
                        } : null
                      }
                    })
                    return { partyIndex: pi, slots }
                  })

                  // 배치된 캐릭터가 하나라도 있는 파티만 표시
                  const filledParties = parties.filter(p => p.slots.some(s => s.char?.name))

                  return (
                    <div
                      key={raid.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/raids/${raid.id}`)}
                      className={`border-b border-gray-800 last:border-b-0 transition-colors group cursor-pointer ${
                        isDone
                          ? 'bg-gray-800/30 hover:bg-gray-800/40 opacity-60'
                          : 'hover:bg-gray-800/50'
                      }`}
                    >
                      {/* ── 메인 정보 행 ── */}
                      <div className="flex items-center gap-3 px-4 py-3">

                        {/* 드래그 핸들 */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-30 group-hover:opacity-70 transition-opacity"
                        >
                          <DragHandle />
                        </div>

                        {/* 완료 체크박스 */}
                        <div
                          onClick={(e) => toggleCompleted(e, raid.id)}
                          className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border transition-all"
                          style={{
                            borderColor: isDone ? '#10b981' : '#4b5563',
                            backgroundColor: isDone ? '#10b981' : 'transparent',
                          }}
                        >
                          {isDone && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>

                        {/* 난이도 배지 */}
                        <span
                          className={`text-[10px] font-medium rounded-full py-0.5 text-center flex-shrink-0 ${
                            isDone
                              ? 'bg-gray-700/50 text-gray-500'
                              : (DIFF_STYLE[raid.difficulty] || 'bg-gray-700 text-gray-300')
                          }`}
                          style={{ width: '64px' }}
                        >
                          {raid.difficulty}
                        </span>

                        {/* 레이드 이름 */}
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium truncate block ${
                            isDone ? 'text-gray-500 line-through decoration-gray-600' : 'text-white'
                          }`}>
                            {raid.raid_name}
                          </span>
                        </div>

                        {/* 내가 만든 / 참여 중 태그 */}
                        {isMyRaid(raid.id) ? (
                          <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                            isDone ? 'text-gray-600 bg-gray-800/50' : 'text-blue-400 bg-blue-400/10'
                          }`}>
                            내가 만든
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded flex-shrink-0">
                            참여 중
                          </span>
                        )}

                        {/* 삭제 / 나가기 버튼 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRaidToDelete(raid)
                          }}
                          className="text-xs text-gray-600 hover:text-red-400 hover:bg-red-400/10 px-2 py-1 rounded transition-colors flex-shrink-0"
                        >
                          {isMyRaid(raid.id) ? '삭제' : '나가기'}
                        </button>
                      </div>

                      {/* ── 파티별 캐릭터 + 시너지 표시 ── */}
                      {filledParties.length > 0 && (
                        <div className="px-4 pb-3 flex flex-wrap gap-2">
                          {filledParties.map(party => {
                            const synergies = calcPartySynergies(party.slots)
                            return (
                              <div
                                key={party.partyIndex}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${
                                  isDone
                                    ? 'border-gray-700/40 bg-gray-800/20'
                                    : 'border-gray-700/60 bg-gray-800/40'
                                }`}
                              >
                                {/* 파티 번호 — 항상 표시 */}
                                <span className={`text-[10px] font-bold flex-shrink-0 ${
                                  isDone ? 'text-gray-600' : 'text-gray-500'
                                }`}>
                                  {party.partyIndex + 1}파티
                                </span>
                                <span className="w-px h-3 bg-gray-700/80 flex-shrink-0" />

                                {/* 캐릭터 목록 */}
                                <div className="flex items-center gap-1.5">
                                  {party.slots.map(({ order, char }, si) => (
                                    <div key={order} className="flex items-center gap-1">
                                      {char?.name ? (
                                        <>
                                          <span className="flex-shrink-0">
                                            {char.is_support ? <SupportIcon /> : <DealerIcon />}
                                          </span>
                                          <span className={`text-[11px] font-medium ${
                                            isDone ? 'text-gray-600' : 'text-gray-200'
                                          }`}>
                                            {char.name}
                                          </span>
                                        </>
                                      ) : (
                                        <span className={`text-[11px] ${isDone ? 'text-gray-700' : 'text-gray-600'}`}>—</span>
                                      )}
                                      {si < party.slots.length - 1 && (
                                        <span className="text-gray-700 text-[10px]">·</span>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* 시너지 뱃지 — class_name 있는 캐릭터가 있을 때만 */}
                                {synergies.length > 0 && (
                                  <>
                                    <span className="w-px h-3 bg-gray-700/80 flex-shrink-0 mx-0.5" />
                                    <div className="flex items-center gap-1">
                                      {synergies.map(tag => (
                                        <SynergyBadge key={tag} tag={tag} faded={isDone} />
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}


              </div>
            )}
          </section>

          {/* 게임 정보 그리드 (추후 API 연동) */}
          <div className="grid grid-cols-2 gap-4">

            {/* 모험 섬 */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <span className="text-sm font-medium text-gray-300">🏝 모험 섬</span>
                <span className="text-xs text-yellow-400 font-medium">준비 중</span>
              </div>
              <div className="px-4 py-3 text-sm text-gray-600">
                추후 업데이트 예정
              </div>
            </section>

            {/* 필드 보스 */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <span className="text-sm font-medium text-gray-300">👹 필드 보스</span>
                <span className="text-xs text-yellow-400 font-medium">준비 중</span>
              </div>
              <div className="px-4 py-3 text-sm text-gray-600">
                추후 업데이트 예정
              </div>
            </section>

            {/* 카오스 게이트 */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <span className="text-sm font-medium text-gray-300">⚡ 카오스 게이트</span>
                <span className="text-xs text-yellow-400 font-medium">준비 중</span>
              </div>
              <div className="px-4 py-3 text-sm text-gray-600">
                추후 업데이트 예정
              </div>
            </section>

            {/* 항해 */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <span className="text-sm font-medium text-gray-300">⚠ 항해</span>
                <span className="text-xs text-yellow-400 font-medium">준비 중</span>
              </div>
              <div className="px-4 py-3 text-sm text-gray-600">
                추후 업데이트 예정
              </div>
            </section>

          </div>
        </main>

        {/* ── 사이드바: 내 원정대 목록 ───────── */}
        <aside className="w-[300px] flex-shrink-0 flex flex-col gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-medium text-gray-300">내 원정대</span>
              {!charLoading && (
                <span className="text-xs text-gray-500">{characters.length}명</span>
              )}
            </div>

            {charLoading ? (
              <div className="px-4 py-5 text-sm text-gray-500">불러오는 중...</div>
            ) : characters.length === 0 ? (
              <div className="px-4 py-5 text-sm text-gray-500">캐릭터가 없어요.</div>
            ) : (
              <div>
                {characters.map((char) => {
                  const isSupport = !!char.is_support
                  return (
                    <div
                      key={char.id}
                      onClick={() => navigate(`/characters/${char.name}`)}
                      className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/60 last:border-b-0 hover:bg-gray-800/40 transition-colors cursor-pointer group"
                    >
                      {/* 역할 아이콘 */}
                      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                        {isSupport ? <SupportIcon /> : <DealerIcon />}
                      </div>

                      {/* 캐릭터 정보 */}
                      <div className="flex-1 min-w-0">
                        {/* 이름 + 클래스 — 같은 줄 */}
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <p className="text-sm font-medium text-white truncate leading-none">
                            {char.name}
                          </p>
                          <span className="text-xs text-gray-500 flex-shrink-0">{char.class_name}</span>
                        </div>
                        {/* 아이템 레벨 + 전투력 — 여유있게 표시 */}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-blue-400 flex-shrink-0">Lv. {char.item_level?.toLocaleString()}</span>
                          {char.combat_power && (
                            <span className="text-xs text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                              <span>⚔</span>
                              <span>{char.combat_power?.toLocaleString()}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

      </div>

      {/* ── 삭제 확인 모달 ────────────────────── */}
      {raidToDelete && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setRaidToDelete(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">
              {isMyRaid(raidToDelete.id) ? '레이드 삭제' : '레이드 나가기'}
            </h3>
            <p className="text-sm text-gray-400">
              <span className="text-white font-medium">{raidToDelete.raid_name}</span>
              {isMyRaid(raidToDelete.id) ? (
                <> 레이드를 삭제할까요?<br />이 작업은 되돌릴 수 없어요.</>
              ) : (
                <> 레이드에서 나갈까요?</>
              )}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setRaidToDelete(null)}
                className="flex-1 px-4 py-2 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => deleteMutation.mutate(raidToDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {deleteMutation.isPending ? '처리 중...' : (isMyRaid(raidToDelete.id) ? '삭제' : '나가기')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
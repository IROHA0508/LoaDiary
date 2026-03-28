import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCharacters } from '../api/characters'
import { getMyRaids, getJoinedRaids, getSlots } from '../api/raids'
import { useUser } from '../hooks/useUser'

/* ─────────────────────────────────────────────
   Armory API 호출
   ───────────────────────────────────────────── */
const fetchArmory = (name) =>
  fetch(`/api/characters/${encodeURIComponent(name)}/armory`).then((r) => {
    if (!r.ok) throw new Error('캐릭터 정보를 불러올 수 없습니다.')
    return r.json()
  })

/* ─────────────────────────────────────────────
   유틸
   ───────────────────────────────────────────── */
const DIFF_STYLE = {
  '노말': 'bg-green-900/50 text-green-400',
  '하드': 'bg-red-900/50 text-red-400',
  '나이트메어': 'bg-purple-900/50 text-purple-400',
  '1단계': 'bg-gray-700 text-gray-300',
  '2단계': 'bg-yellow-900/50 text-yellow-400',
  '3단계': 'bg-red-900/50 text-red-400',
}

const GRADE_COLORS = {
  '고대': '#e8c86a',
  '유물': '#e07b39',
  '전설': '#e8b339',
  '영웅': '#b958d4',
  '희귀': '#3a96d4',
  '고급': '#4ac96e',
  '일반': '#c8c8c8',
}

function gradeColor(grade) {
  return GRADE_COLORS[grade] || '#94a3b8'
}

function levelColor(lv) {
  if (!lv) return '#94a3b8'
  if (lv >= 1750) return '#ef4444'
  if (lv >= 1700) return '#f59e0b'
  if (lv >= 1640) return '#60a5fa'
  return '#94a3b8'
}

function cpColor(cp) {
  if (!cp) return '#94a3b8'
  if (cp >= 4000) return '#ef4444'
  if (cp >= 3000) return '#f59e0b'
  if (cp >= 2000) return '#60a5fa'
  return '#94a3b8'
}

// stat 배열에서 특정 타입 값 추출
function getStat(stats, type) {
  if (!stats) return '—'
  const found = stats.find((s) => s.Type === type)
  return found ? found.Value : '—'
}

// 전투 특성 목록
const COMBAT_STATS = ['치명', '특화', '제압', '신속', '인내', '숙련']

/* ─────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────── */

// ── 로딩 스피너 ──
function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div
        style={{
          width: 36, height: 36,
          border: '3px solid rgba(245,158,11,0.2)',
          borderTop: '3px solid #f59e0b',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p className="text-sm text-gray-500">불러오는 중...</p>
    </div>
  )
}

// ── 섹션 타이틀 ──
function SectionTitle({ children }) {
  return (
    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
      {children}
    </h3>
  )
}

// ── 스탯 카드 ──
function StatCard({ label, value, color }) {
  return (
    <div className="bg-gray-800/60 rounded-xl px-4 py-3.5">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-lg font-bold" style={{ color: color || '#f1f5f9' }}>
        {value}
      </p>
    </div>
  )
}

// ── 탭 버튼 ──
function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
      }`}
    >
      {label}
    </button>
  )
}

/* ─────────────────────────────────────────────
   Tab: 능력치
   ───────────────────────────────────────────── */
function TabStats({ armory }) {
  const profiles = armory?.ArmoryProfile || {}
  const stats = profiles.Stats || []
  const tendencies = profiles.Tendencies || []
  const engravings = armory?.ArmoryEngraving?.Effects || []
  const arkPassive = armory?.ArkPassive

  const atkPower = getStat(stats, '공격력')
  const maxHp = getStat(stats, '최대 생명력')

  return (
    <div className="space-y-6">
      {/* 기본 스탯 */}
      <div>
        <SectionTitle>기본 스탯</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="공격력" value={atkPower} color="#f59e0b" />
          <StatCard label="최대 생명력" value={maxHp} color="#60a5fa" />
        </div>
      </div>

      {/* 전투 특성 */}
      <div>
        <SectionTitle>전투 특성</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {COMBAT_STATS.map((type) => {
            const val = getStat(stats, type)
            return (
              <div key={type} className="bg-gray-800/60 rounded-lg px-3 py-2.5 flex justify-between items-center">
                <span className="text-xs text-gray-400">{type}</span>
                <span className="text-sm font-semibold text-white">{val}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 성향 */}
      {tendencies.length > 0 && (
        <div>
          <SectionTitle>성향</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {tendencies.map((t) => (
              <div key={t.Type} className="bg-gray-800/60 rounded-lg px-3 py-2.5 flex justify-between items-center">
                <span className="text-xs text-gray-400">{t.Type}</span>
                <span className="text-sm font-semibold text-white">{t.Point}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 각인 */}
      {engravings.length > 0 && (
        <div>
          <SectionTitle>각인 효과</SectionTitle>
          <div className="flex flex-col gap-2">
            {engravings.map((e, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-3 py-2.5">
                {e.Icon && (
                  <img src={e.Icon} alt={e.Name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: gradeColor(e.Grade) }}>{e.Name}</p>
                  {e.Description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{e.Description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 아크 패시브 */}
      {arkPassive?.Points?.length > 0 && (
        <div>
          <SectionTitle>아크 패시브 포인트</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {arkPassive.Points.map((p) => (
              <div key={p.Name} className="bg-gray-800/60 rounded-lg px-3 py-2.5 text-center">
                <p className="text-[10px] text-gray-500 mb-1">{p.Name}</p>
                <p className="text-lg font-bold text-amber-400">{p.Value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Tab: 장비
   ───────────────────────────────────────────── */
const EQUIP_SLOT_ORDER = ['머리', '상의', '하의', '장갑', '어깨', '무기']
const EQUIP_ACCESSORY_ORDER = ['목걸이', '귀걸이', '귀걸이', '반지', '반지', '어빌리티 스톤']

function EquipCard({ item }) {
  if (!item) {
    return (
      <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-3 flex items-center gap-3 opacity-40">
        <div className="w-10 h-10 rounded bg-gray-700/50 flex-shrink-0" />
        <span className="text-xs text-gray-600">비어있음</span>
      </div>
    )
  }

  const color = gradeColor(item.Grade)
  // 아이템 레벨 파싱 (Tooltip JSON에 포함되지만 Name에서 추출 시도)
  const lvMatch = item.Name?.match(/(\d[\d,]+)/)
  const itemLv = lvMatch ? lvMatch[1] : null

  return (
    <div
      className="bg-gray-800/50 border rounded-lg p-3 flex items-center gap-3"
      style={{ borderColor: `${color}33` }}
    >
      {item.Icon ? (
        <img
          src={item.Icon} alt={item.Type}
          className="w-10 h-10 rounded object-cover flex-shrink-0"
          style={{ border: `1.5px solid ${color}55` }}
        />
      ) : (
        <div className="w-10 h-10 rounded bg-gray-700 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500">{item.Type}</p>
        <p className="text-xs font-medium truncate" style={{ color }}>{item.Name || '—'}</p>
        {itemLv && <p className="text-[10px] text-gray-500 mt-0.5">Lv. {itemLv}</p>}
      </div>
    </div>
  )
}

function TabEquipment({ armory }) {
  const equipment = armory?.ArmoryEquipment || []

  const getByType = (type) => equipment.find((e) => e.Type === type)

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>방어구</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {EQUIP_SLOT_ORDER.map((type) => (
            <EquipCard key={type} item={getByType(type)} />
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>장신구</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {EQUIP_ACCESSORY_ORDER.map((type, i) => {
            // 귀걸이/반지는 같은 타입이 2개
            const items = equipment.filter((e) => e.Type === type)
            const item = i < equipment.length ? items[Math.floor(i / EQUIP_SLOT_ORDER.length)] || items[0] : null
            return <EquipCard key={`${type}-${i}`} item={equipment.filter(e => e.Type === type)[EQUIP_ACCESSORY_ORDER.slice(0, i).filter(t => t === type).length]} />
          })}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Tab: 보석
   ───────────────────────────────────────────── */
function TabGems({ armory }) {
  const gems = armory?.ArmoryGem?.Gems || []
  const effects = armory?.ArmoryGem?.Effects || []

  if (gems.length === 0) {
    return <p className="text-sm text-gray-600 py-8 text-center">보석 정보가 없습니다.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>장착 보석</SectionTitle>
        <div className="grid grid-cols-5 gap-2">
          {gems.map((gem) => (
            <div key={gem.Slot} className="flex flex-col items-center gap-1.5">
              {gem.Icon ? (
                <img src={gem.Icon} alt={gem.Name} className="w-12 h-12 rounded-lg object-cover border border-gray-700" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-700" />
              )}
              <p className="text-[10px] text-center text-gray-400 leading-tight line-clamp-2">{gem.Name}</p>
            </div>
          ))}
        </div>
      </div>
      {effects.length > 0 && (
        <div>
          <SectionTitle>보석 효과</SectionTitle>
          <div className="flex flex-col gap-2">
            {effects.map((ef, i) => (
              <div key={i} className="bg-gray-800/50 rounded-lg px-3 py-2.5">
                <p className="text-xs font-medium text-amber-400">{ef.Name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{ef.Description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Tab: 카드
   ───────────────────────────────────────────── */
function TabCards({ armory }) {
  const cards = armory?.ArmoryCard?.Cards || []
  const effects = armory?.ArmoryCard?.Effects || []

  if (cards.length === 0) {
    return <p className="text-sm text-gray-600 py-8 text-center">카드 정보가 없습니다.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>장착 카드</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {cards.map((card) => (
            <div key={card.Slot} className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700/50">
              {card.Icon && (
                <img src={card.Icon} alt={card.Name} className="w-full object-cover" style={{ maxHeight: 80 }} />
              )}
              <div className="p-2">
                <p className="text-xs font-medium text-gray-300 truncate">{card.Name || '—'}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  각성 {card.AwakeCount}/{card.AwakeTotal}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {effects.length > 0 && (
        <div>
          <SectionTitle>카드 세트 효과</SectionTitle>
          <div className="flex flex-col gap-2">
            {effects.map((ef, i) => (
              <div key={i} className="bg-gray-800/50 rounded-lg px-3 py-2.5 border-l-2 border-amber-500/40">
                <p className="text-[10px] text-amber-400 font-semibold mb-1">{ef.CardSlots}장 세트</p>
                {ef.Items?.map((item, j) => (
                  <div key={j}>
                    <p className="text-xs font-medium text-gray-300">{item.Name}</p>
                    <p className="text-xs text-gray-500">{item.Description}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Tab: 원정대
   ───────────────────────────────────────────── */
function TabExpedition({ characters, currentName, onSelect }) {
  const SUPPORT_CLASSES = ['바드', '도화가', '홀리나이트']
  const isSupport = (cls) => SUPPORT_CLASSES.some((s) => cls?.includes(s))

  const sorted = [...(characters || [])].sort((a, b) => (b.item_level || 0) - (a.item_level || 0))

  return (
    <div>
      <SectionTitle>원정대 캐릭터 ({characters?.length || 0}명)</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {sorted.map((char) => {
          const isCurrent = char.name === currentName
          const sup = isSupport(char.class_name)
          return (
            <div
              key={char.id}
              onClick={() => !isCurrent && onSelect(char.name)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                isCurrent
                  ? 'border-amber-500/40 bg-amber-500/10 cursor-default'
                  : 'border-gray-700/40 bg-gray-800/40 hover:bg-gray-800 cursor-pointer'
              }`}
            >
              {/* 역할 아이콘 */}
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {sup
                  ? <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><rect x="4.5" y="1" width="3" height="10" rx="1.2" fill="#22c55e"/><rect x="1" y="4.5" width="10" height="3" rx="1.2" fill="#22c55e"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><line x1="2" y1="10" x2="10" y2="2" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/><line x1="8" y1="1" x2="11" y2="4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isCurrent ? 'text-amber-400' : 'text-gray-300'}`}>
                  {char.name}
                  {isCurrent && <span className="ml-2 text-[10px] text-amber-500/80">현재</span>}
                </p>
                <p className="text-xs text-gray-500">{char.class_name}</p>
              </div>
              <p className="text-sm font-semibold flex-shrink-0" style={{ color: levelColor(char.item_level) }}>
                {char.item_level?.toLocaleString() ?? '—'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Page
   ───────────────────────────────────────────── */
const TABS = [
  { id: 'stats', label: '능력치' },
  { id: 'equipment', label: '장비' },
  { id: 'gems', label: '보석' },
  { id: 'cards', label: '카드' },
  { id: 'expedition', label: '원정대' },
]

export default function CharacterDetailPage() {
  const { name } = useParams()
  const navigate = useNavigate()
  const { fingerprint } = useUser()
  const [activeTab, setActiveTab] = useState('stats')

  // Armory 데이터
  const { data: armory, isLoading: armoryLoading, error: armoryError } = useQuery({
    queryKey: ['armory', name],
    queryFn: () => fetchArmory(name),
    enabled: !!name,
    staleTime: 1000 * 60 * 5,
  })

  // 내 원정대 캐릭터 (사이드바용)
  const { data: characters = [] } = useQuery({
    queryKey: ['characters', fingerprint],
    queryFn: () => getCharacters(fingerprint),
    enabled: !!fingerprint,
  })

  // 내 레이드 + 배치 현황
  const { data: myRaids = [] } = useQuery({
    queryKey: ['myRaids', fingerprint],
    queryFn: () => getMyRaids(fingerprint),
    enabled: !!fingerprint,
  })
  const { data: joinedRaids = [] } = useQuery({
    queryKey: ['joinedRaids', fingerprint],
    queryFn: () => getJoinedRaids(fingerprint),
    enabled: !!fingerprint,
  })
  const allRaids = [...myRaids, ...joinedRaids.filter(jr => !myRaids.some(mr => mr.id === jr.id))]

  const [slotsMap, setSlotsMap] = useState({})
  const loadedRaidIds = Object.keys(slotsMap)
  if (allRaids.length > 0) {
    const newRaids = allRaids.filter(r => !loadedRaidIds.includes(r.id))
    if (newRaids.length > 0) {
      Promise.all(newRaids.map(r => getSlots(r.id).then(slots => ({ id: r.id, slots }))))
        .then(results => {
          setSlotsMap(prev => {
            const next = { ...prev }
            results.forEach(({ id, slots }) => { next[id] = slots })
            return next
          })
        })
    }
  }

  // 현재 캐릭터의 DB 정보 (아이템레벨, 전투력)
  const dbChar = characters.find(c => c.name === name)

  // profiles 파싱
  const profiles = armory?.ArmoryProfile || {}
  const stats = profiles.Stats || []
  const isSupport = profiles.CharacterClassName?.includes('바드') ||
    profiles.CharacterClassName?.includes('도화가') ||
    profiles.CharacterClassName?.includes('홀리나이트')

  // 이번 주 배치 레이드
  const placedRaids = allRaids.filter(r =>
    (slotsMap[r.id] || []).some(s => {
      const char = characters.find(c => c.name === name)
      return char && s.character_id === char.id
    })
  )

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .char-detail { animation: fadeIn 0.3s ease-out; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 2px; }
      `}</style>

      <div
        className="min-h-screen text-gray-200"
        style={{ background: 'linear-gradient(165deg, #0a0c14 0%, #111827 40%, #0f172a 100%)' }}
      >
        {/* ── 네비게이션 바 ── */}
        <div className="sticky top-0 z-10 border-b border-gray-800/80" style={{ background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(12px)' }}>
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              뒤로
            </button>
            <span className="text-gray-700">/</span>
            <span className="text-sm text-gray-400">{name}</span>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6 char-detail">

          {/* ── 캐릭터 헤더 ── */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-6 flex-wrap">

              {/* 캐릭터 이미지 */}
              {profiles.CharacterImage ? (
                <div className="w-24 h-32 rounded-xl overflow-hidden border border-gray-700/50 flex-shrink-0 bg-gray-800">
                  <img src={profiles.CharacterImage} alt={name} className="w-full h-full object-cover object-top" />
                </div>
              ) : (
                <div className="w-24 h-32 rounded-xl bg-gray-800 border border-gray-700/50 flex-shrink-0 flex items-center justify-center">
                  <span className="text-3xl opacity-30">👤</span>
                </div>
              )}

              {/* 기본 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSupport ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                    {isSupport ? '서포터' : '딜러'}
                  </span>
                  <span className="text-xs text-gray-500">{profiles.ServerName || dbChar?.server}</span>
                </div>
                <h1 className="text-2xl font-bold text-white mb-0.5">{name}</h1>
                <p className="text-sm text-gray-400 mb-4">
                  {profiles.CharacterClassName || dbChar?.class_name}
                  {profiles.CharacterLevel && <span className="ml-2 text-gray-600">Lv.{profiles.CharacterLevel}</span>}
                  {profiles.CharacterExpeditionLevel && <span className="ml-2 text-gray-600">원정대 Lv.{profiles.CharacterExpeditionLevel}</span>}
                </p>

                {/* 스탯 요약 */}
                <div className="flex gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">아이템 레벨</p>
                    <p className="text-xl font-bold mt-0.5" style={{ color: levelColor(dbChar?.item_level) }}>
                      {dbChar?.item_level?.toLocaleString() ?? profiles.ItemMaxLevel ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">전투력</p>
                    <p className="text-xl font-bold mt-0.5" style={{ color: cpColor(dbChar?.combat_power) }}>
                      {dbChar?.combat_power ? dbChar.combat_power.toLocaleString() : getStat(stats, '공격력') !== '—' ? getStat(stats, '공격력') : '—'}
                    </p>
                  </div>
                  {placedRaids.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">이번 주 배치</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {placedRaids.map(r => (
                          <button
                            key={r.id}
                            onClick={() => navigate(`/raids/${r.id}`)}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded ${DIFF_STYLE[r.difficulty] || 'bg-gray-700 text-gray-300'} hover:opacity-80 transition-opacity`}
                          >
                            {r.raid_name} {r.difficulty}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 외부 링크 + 칭호 */}
              <div className="flex flex-col gap-3 items-end">
                {profiles.CharacterTitle && (
                  <span className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded">
                    {profiles.CharacterTitle}
                  </span>
                )}
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {[
                    { label: 'kloa.gg', url: `https://kloa.gg/characters/${name}` },
                    { label: 'loawa.com', url: `https://loawa.com/char/${name}` },
                    { label: 'iloa.gg', url: `https://iloa.gg/character/${name}` },
                  ].map(({ label, url }) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg transition-colors border border-gray-700/50"
                    >
                      {label} ↗
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── 탭 + 컨텐츠 ── */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden">
            {/* 탭 바 */}
            <div className="flex gap-1.5 px-4 pt-4 pb-0 border-b border-gray-800">
              {TABS.map((tab) => (
                <Tab
                  key={tab.id}
                  label={tab.label}
                  active={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                />
              ))}
            </div>

            {/* 탭 컨텐츠 */}
            <div className="p-6">
              {armoryLoading ? (
                activeTab === 'expedition' ? (
                  <TabExpedition characters={characters} currentName={name} onSelect={(n) => navigate(`/characters/${n}`)} />
                ) : (
                  <Spinner />
                )
              ) : armoryError ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-red-400 mb-2">⚠ 정보를 불러오지 못했습니다.</p>
                  <p className="text-xs text-gray-600">Lostark API 응답을 확인해주세요.</p>
                </div>
              ) : (
                <>
                  {activeTab === 'stats' && <TabStats armory={armory} />}
                  {activeTab === 'equipment' && <TabEquipment armory={armory} />}
                  {activeTab === 'gems' && <TabGems armory={armory} />}
                  {activeTab === 'cards' && <TabCards armory={armory} />}
                  {activeTab === 'expedition' && (
                    <TabExpedition characters={characters} currentName={name} onSelect={(n) => navigate(`/characters/${n}`)} />
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
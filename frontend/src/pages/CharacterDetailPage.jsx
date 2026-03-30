import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCharacters } from '../api/characters'
import { getMyRaids, getJoinedRaids, getSlots } from '../api/raids'
import { useUser } from '../hooks/useUser'

// 백엔드 URL 추가
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL
BACKEND_URL = BACKEND_URL.replace(/\/+$/, ""); // 끝 슬래시 제거

/* ─────────────────────────────────────────────
   API
   ───────────────────────────────────────────── */
const fetchArmory = (name) =>
  fetch(`${BACKEND_URL}/api/characters/${encodeURIComponent(name)}/armory`).then((r) => {
    if (!r.ok) throw new Error('캐릭터 정보를 불러올 수 없습니다.')
    return r.json()
  })

/* ─────────────────────────────────────────────
   상수 / 유틸
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
  '고대': '#e8c86a', '유물': '#e07b39', '전설': '#e8b339',
  '영웅': '#b958d4', '희귀': '#3a96d4', '고급': '#4ac96e', '일반': '#c8c8c8',
}

const ARK_COLORS = { '진화': '#f59e0b', '깨달음': '#60a5fa', '도약': '#22c55e' }

function gradeColor(g) { return GRADE_COLORS[g] || '#94a3b8' }

function levelColor(lv) {
  if (!lv) return '#94a3b8'
  if (lv >= 1750) return '#e8c86a'
  if (lv >= 1700) return '#f59e0b'
  if (lv >= 1640) return '#60a5fa'
  return '#94a3b8'
}

function cpColor(isSupport) { return isSupport ? '#22c55e' : '#ef4444' }

function getStat(stats, type) {
  const f = (stats || []).find(s => s.Type === type)
  return f ? f.Value : '—'
}

const COMBAT_STATS = ['치명', '특화', '제압', '신속', '인내', '숙련']
const TENDENCY_STATS = ['지성', '담력', '매력', '친절']

/* ─────────────────────────────────────────────
   공통 아이콘 컴포넌트
   ───────────────────────────────────────────── */
function SupportIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <rect x="4.5" y="1" width="3" height="10" rx="1.2" fill="#22c55e"/>
      <rect x="1" y="4.5" width="10" height="3" rx="1.2" fill="#22c55e"/>
    </svg>
  )
}
function DealerIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <line x1="2" y1="10" x2="10" y2="2" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="1" x2="11" y2="4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="2" y1="9" x2="4" y2="7" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function RoleIcon({ isSupport, size = 13 }) {
  return isSupport ? <SupportIcon size={size} /> : <DealerIcon size={size} />
}

/* ─────────────────────────────────────────────
   UI 원자 컴포넌트
   ───────────────────────────────────────────── */
function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{children}</h3>
      {right && <span className="text-[10px] text-gray-600">{right}</span>}
    </div>
  )
}

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
        active
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
      }`}
    >
      {label}
    </button>
  )
}

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div style={{
        width: 32, height: 32,
        border: '3px solid rgba(245,158,11,0.15)',
        borderTop: '3px solid #f59e0b',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p className="text-xs text-gray-600">불러오는 중...</p>
    </div>
  )
}

function ComingSoon({ name, links }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-gray-500 mb-1">{name} 정보</p>
      <p className="text-xs text-gray-700 mb-4">준비 중입니다.</p>
      {links && (
        <div className="flex justify-center gap-2">
          {links.map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors">
              {label} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   능력치 탭 — 종합 정보
   ───────────────────────────────────────────── */
// 장비 슬롯 Type 값 (Lostark API 실제 필드)
// 방어구 (왼쪽 컬럼, 6개)
const ARMOR_TYPES = ['투구', '어깨', '상의', '하의', '장갑', '무기']
// 악세서리 — 귀걸이·반지 각 2개 (오른쪽 컬럼 상단, 5줄)
const ACCESSORY_TYPES = ['목걸이', '귀걸이', '귀걸이', '반지', '반지']
// 하단 단독 슬롯
const STONE_TYPE  = '어빌리티 스톤'
const BRACE_TYPE  = '팔찌'
const GRADE_COLORS_EQ  = { '고대': '#e8c86a', '유물': '#e07b39', '전설': '#e8b339', '영웅': '#b958d4', '희귀': '#3a96d4', '고급': '#4ac96e' }
function eqGradeColor(g) { return GRADE_COLORS_EQ[g] || '#64748b' }

function EquipSlot({ item }) {
  if (!item) return (
    <div className="flex items-center gap-2 bg-gray-800/30 border border-gray-700/20 rounded-lg px-2.5 py-2 opacity-40">
      <div className="w-9 h-9 rounded bg-gray-700/50 flex-shrink-0" />
      <span className="text-[10px] text-gray-600">비어있음</span>
    </div>
  )
  const col = eqGradeColor(item.Grade)
  return (
    <div className="flex items-center gap-2.5 bg-gray-800/50 border rounded-lg px-2.5 py-2" style={{ borderColor: col + '44' }}>
      {item.Icon
        ? <img src={item.Icon} alt={item.Type} className="w-9 h-9 rounded flex-shrink-0 object-cover" style={{ border: `1.5px solid ${col}66` }} />
        : <div className="w-9 h-9 rounded bg-gray-700 flex-shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-gray-600 leading-tight">{item.Type}</p>
        <p className="text-[11px] font-medium truncate leading-tight mt-0.5" style={{ color: col }}>{item.Name || '—'}</p>
      </div>
    </div>
  )
}

function TabStats({ armory }) {
  const profile    = armory?.ArmoryProfile   || {}
  const stats      = profile.Stats           || []
  const tendencies = profile.Tendencies      || []
  const engravings = armory?.ArmoryEngraving?.Effects || []
  const equipment  = armory?.ArmoryEquipment          || []
  const gems       = armory?.ArmoryGem?.Gems          || []
  const gemEffects = armory?.ArmoryGem?.Effects       || []
  const cards      = armory?.ArmoryCard?.Cards        || []
  const cardEffects= armory?.ArmoryCard?.Effects      || []
  const ark        = armory?.ArkPassive               || {}
  const arkPoints  = ark.Points  || []
  const arkEffects = ark.Effects || []

  // 타입별 장비 매핑 (귀걸이·반지는 2개씩 존재 → 인덱스로 구분)
  const usedCount = {}
  const getEquip = (type) => {
    const idx = usedCount[type] || 0
    usedCount[type] = idx + 1
    return equipment.filter(e => e.Type === type)[idx] || null
  }

  return (
    <div className="space-y-6">

      {/* ─────────────────────────────────────────────────────
           장비 레이아웃 (사진 기준)
           좌열: 방어구 6개 (투구·어깨·상의·하의·장갑·무기)
           우열: 악세서리 5개 + 어빌리티 스톤 + 팔찌
           하단 전폭: 보주 (ArmoryEquipment의 '나침반'·'부적' 또는 별도 필드)
         ───────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>장비 · 악세서리</SectionTitle>
        <div className="flex gap-2">

          {/* 왼쪽: 투구·어깨·상의·하의·장갑·무기·보주 */}
          <div className="flex flex-col gap-1.5 flex-1">
            {ARMOR_TYPES.map(type => (
              <EquipSlot key={type} item={getEquip(type)} />
            ))}
            {/* 무기 아래: 보주 */}
            <EquipSlot item={equipment.find(e => ['보주'].includes(e.Type)) || null} />
          </div>

          {/* 오른쪽: 목걸이·귀걸이×2·반지×2·어빌리티 스톤·팔찌 */}
          <div className="flex flex-col gap-1.5 flex-1">
            {ACCESSORY_TYPES.map((type, i) => (
              <EquipSlot key={`acc-${type}-${i}`} item={getEquip(type)} />
            ))}
            {/* 어빌리티 스톤 */}
            <EquipSlot item={getEquip(STONE_TYPE)} />
            {/* 스톤 아래: 팔찌 */}
            <EquipSlot item={getEquip(BRACE_TYPE)} />
          </div>

        </div>


      </div>

      {/* 보석 — 장비 바로 아래 전폭 표시 */}
      {gems.length > 0 && (
        <div>
          <SectionTitle>보석</SectionTitle>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {/* 11슬롯 기준 빈 자리도 표시 */}
            {Array.from({ length: Math.max(gems.length, 11) }, (_, i) => {
              const gem = gems[i]
              return gem ? (
                <div key={i} className="flex flex-col items-center gap-1" title={gem.Name}>
                  {gem.Icon
                    ? <img src={gem.Icon} alt={gem.Name} className="w-10 h-10 rounded-lg border border-gray-700 object-cover" />
                    : <div className="w-10 h-10 rounded-lg bg-gray-700" />
                  }
                  <span className="text-[9px] text-gray-500">{gem.Level ?? ''}레벨</span>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-lg bg-gray-800/40 border border-gray-700/30" />
                  <span className="text-[9px] text-gray-700">—</span>
                </div>
              )
            })}
          </div>
          {gemEffects.length > 0 && (
            <div className="space-y-1.5">
              {gemEffects.map((ef, i) => (
                <div key={i} className="bg-gray-800/50 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-amber-400">{ef.Name}</p>
                  {ef.Description && <p className="text-[11px] text-gray-500 mt-0.5">{ef.Description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 기본 + 전투 특성 ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <SectionTitle>기본 특성</SectionTitle>
          <div className="space-y-1.5">
            {[
              { label: '공격력', value: getStat(stats, '공격력') },
              { label: '최대 생명력', value: getStat(stats, '최대 생명력') },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center bg-gray-800/50 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-sm font-semibold text-amber-400">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle>전투 특성</SectionTitle>
          <div className="space-y-1.5">
            {COMBAT_STATS.map(type => (
              <div key={type} className="flex justify-between items-center bg-gray-800/50 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-400">{type}</span>
                <span className="text-sm font-semibold text-white">{getStat(stats, type)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 성향 ── */}
      {tendencies.length > 0 && (
        <div>
          <SectionTitle>성향</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            {tendencies.map(t => (
              <div key={t.Type} className="bg-gray-800/50 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-gray-500 mb-0.5">{t.Type}</p>
                <p className="text-sm font-semibold text-gray-200">{t.Point}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 각인 ── */}
      {engravings.length > 0 && (
        <div>
          <SectionTitle>각인</SectionTitle>
          <div className="grid grid-cols-1 gap-2">
            {engravings.map((e, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-3 py-2.5">
                {e.Icon && <img src={e.Icon} alt={e.Name} className="w-8 h-8 rounded flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: gradeColor(e.Grade) }}>{e.Name}</p>
                  {e.Description && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{e.Description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 아크 패시브 포인트 & 세부 효과 ── */}
      {arkPoints.length > 0 && (
        <div>
          <SectionTitle>아크 패시브</SectionTitle>
          {/* 포인트 요약 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {arkPoints.map(p => (
              <div key={p.Name} className="rounded-lg px-3 py-3 text-center border"
                style={{ background: `${ARK_COLORS[p.Name]}10`, borderColor: `${ARK_COLORS[p.Name]}30` }}>
                <p className="text-[10px] font-bold mb-1" style={{ color: ARK_COLORS[p.Name] }}>{p.Name}</p>
                <p className="text-lg font-bold text-white">{p.Value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">포인트</p>
              </div>
            ))}
          </div>
          {/* 세부 효과 */}
          {arkEffects.length > 0 && (
            <div className="space-y-2">
              {arkEffects.map((ef, i) => (
                <div key={i} className="bg-gray-800/50 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    {ef.Icon && <img src={ef.Icon} alt="" className="w-5 h-5 rounded flex-shrink-0" />}
                    <p className="text-xs font-semibold text-gray-300">{ef.Name}</p>
                    {ef.Level && <span className="text-[10px] text-gray-500">Lv.{ef.Level}</span>}
                  </div>
                  {ef.Description && <p className="text-[11px] text-gray-500">{ef.Description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 보석: 장비 섹션 내에서 표시 */}

      {/* ── 카드 ── */}
      {cards.length > 0 && (
        <div>
          <SectionTitle>카드</SectionTitle>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {cards.map(card => (
              <div key={card.Slot} className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700/40">
                {card.Icon && <img src={card.Icon} alt={card.Name} className="w-full object-cover" style={{ maxHeight: 72 }} />}
                <div className="p-1.5">
                  <p className="text-[10px] text-gray-300 truncate">{card.Name}</p>
                  <p className="text-[9px] text-gray-600 mt-0.5">각성 {card.AwakeCount}/{card.AwakeTotal}</p>
                </div>
              </div>
            ))}
          </div>
          {cardEffects.length > 0 && (
            <div className="space-y-2">
              {cardEffects.map((ef, i) => (
                <div key={i} className="bg-gray-800/50 rounded-lg px-3 py-2.5 border-l-2 border-amber-500/40">
                  <p className="text-[10px] text-amber-400 font-bold mb-1">{ef.CardSlots}장 세트 효과</p>
                  {ef.Items?.map((item, j) => (
                    <div key={j}>
                      <p className="text-xs font-medium text-gray-300">{item.Name}</p>
                      {item.Description && <p className="text-[11px] text-gray-500">{item.Description}</p>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   보유 캐릭터 탭
   ───────────────────────────────────────────── */
function TabCharacters({ characters, currentName, onSelect }) {
  const sorted = [...(characters || [])].sort((a, b) => (b.item_level || 0) - (a.item_level || 0))
  return (
    <div>
      <SectionTitle>원정대 캐릭터 ({characters?.length || 0}명)</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {sorted.map(char => {
          const isCurrent = char.name === currentName
          const isSupport = !!char.is_support
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
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <RoleIcon isSupport={isSupport} size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isCurrent ? 'text-amber-400' : 'text-gray-300'}`}>
                  {char.name}
                  {isCurrent && <span className="ml-2 text-[10px] text-amber-500/70">현재</span>}
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
   탭 목록
   ───────────────────────────────────────────── */
const TABS = [
  { id: 'stats',      label: '능력치' },
  { id: 'avatar',     label: '아바타' },
  { id: 'skill',      label: '스킬' },
  { id: 'interior',   label: '내실' },
  { id: 'characters', label: '보유 캐릭터' },
  { id: 'guild',      label: '길드' },
]

/* ─────────────────────────────────────────────
   메인 컴포넌트
   ───────────────────────────────────────────── */
export default function CharacterDetailPage() {
  const { name } = useParams()
  const navigate  = useNavigate()
  const { fingerprint } = useUser()
  const [activeTab, setActiveTab] = useState('stats')

  /* ── 데이터 조회 ── */
  const { data: armory, isLoading: armoryLoading, error: armoryError } = useQuery({
    queryKey: ['armory', name],
    queryFn: () => fetchArmory(name),
    enabled: !!name,
    staleTime: 1000 * 60 * 5,
  })

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', fingerprint],
    queryFn: () => getCharacters(fingerprint),
    enabled: !!fingerprint,
  })

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

  const loadedIds = Object.keys(slotsMap)
  if (allRaids.length > 0) {
    const newRaids = allRaids.filter(r => !loadedIds.includes(r.id))
    if (newRaids.length > 0) {
      Promise.all(newRaids.map(r => getSlots(r.id).then(slots => ({ id: r.id, slots }))))
        .then(results => setSlotsMap(prev => {
          const next = { ...prev }
          results.forEach(({ id, slots }) => { next[id] = slots })
          return next
        }))
    }
  }

  /* ── 파생 데이터 ── */
  const dbChar   = characters.find(c => c.name === name)
  const profile  = armory?.ArmoryProfile || {}
  const stats    = profile.Stats || []
  const ark      = armory?.ArkPassive || {}

  // 서포터 판정: DB(is_support) 우선, 없으면 아크패시브 Title로 추론
  const SUPPORT_TITLES = ['축복의 오라', '해방자', '절실한 구원', '만개']
  const isSupport = dbChar
    ? !!dbChar.is_support
    : SUPPORT_TITLES.includes(ark.Title || '')

  // 아이템레벨: DB 우선, 없으면 profile
  const itemLevel = dbChar?.item_level ?? (parseFloat(profile.ItemMaxLevel?.replace(',', '') || '0') || null)
  const combatPower = dbChar?.combat_power ?? (parseFloat(profile.CombatPower?.replace(',', '') || '0') || null)

  // 이번 주 배치된 레이드
  const placedRaids = allRaids.filter(r =>
    dbChar && (slotsMap[r.id] || []).some(s => s.character_id === dbChar.id)
  )

  // 아크패시브 직업 타이틀 (e.g. "만개", "전문의")
  const arkTitle = ark.Title || ''

  // 길드명
  const guildName = profile.GuildName || ''

  /* ── 탭 컨텐츠 렌더 ── */
  const externalLinks = (charName) => [
    { label: 'kloa.gg',    url: `https://kloa.gg/characters/${charName}` },
    { label: 'loawa.com',  url: `https://loawa.com/char/${charName}` },
    { label: 'iloa.gg',   url: `https://iloa.gg/character/${charName}` },
  ]

  function renderTab() {
    if (activeTab === 'characters') {
      return <TabCharacters characters={characters} currentName={name} onSelect={n => navigate(`/characters/${n}`)} />
    }
    if (!armoryLoading && armoryError) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm text-red-400 mb-1">⚠ 정보를 불러오지 못했습니다.</p>
          <p className="text-xs text-gray-600">Lostark API 응답을 확인해주세요.</p>
        </div>
      )
    }
    if (armoryLoading) return <Spinner />

    switch (activeTab) {
      case 'stats':    return <TabStats armory={armory} />
      case 'avatar':   return <ComingSoon name="아바타" links={externalLinks(name)} />
      case 'skill':    return <ComingSoon name="스킬" links={externalLinks(name)} />
      case 'interior': return <ComingSoon name="내실" links={externalLinks(name)} />
      case 'guild':    return <ComingSoon name="길드" links={externalLinks(name)} />
      default: return null
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .page-fade { animation: fadeUp 0.3s ease-out; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.25); border-radius: 2px; }
      `}</style>

      <div className="min-h-screen text-gray-200"
        style={{ background: 'linear-gradient(165deg, #0a0c14 0%, #0f172a 60%, #111827 100%)' }}>

        {/* ── 네비게이션 ── */}
        <div className="sticky top-0 z-20 border-b border-gray-800/60"
          style={{ background: 'rgba(10,12,20,0.92)', backdropFilter: 'blur(12px)' }}>
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              뒤로
            </button>
            <span className="text-gray-700 text-sm">/</span>
            <span className="text-sm text-gray-400 truncate">{name}</span>
          </div>
        </div>

        {/* ── 메인 레이아웃 — 좌: 프로필 고정, 우: 탭 ── */}
        <div className="max-w-6xl mx-auto px-6 py-6 page-fade">
          <div className="flex gap-5 items-start">

            {/* ════════════════════════════════════
                좌측 프로필 패널 (sticky)
                ════════════════════════════════════ */}
            <div className="flex-shrink-0 w-52 sticky top-[60px]">
              <div className="bg-gray-900/70 border border-gray-800/60 rounded-2xl overflow-hidden">

                {/* 캐릭터 이미지 — 전신 크게 */}
                <div className="relative" style={{ height: 260 }}>
                  {profile.CharacterImage ? (
                    <img src={profile.CharacterImage} alt={name}
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover', objectPosition: 'center 15%',
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <span className="text-5xl opacity-10">👤</span>
                    </div>
                  )}
                  {/* 역할 배지 오버레이 */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2"
                    style={{ background: 'linear-gradient(to top, rgba(10,12,20,0.95) 60%, transparent)' }}>
                    <div className="flex items-center gap-1.5">
                      <RoleIcon isSupport={isSupport} size={12} />
                      <span className="text-xs font-semibold" style={{ color: isSupport ? '#22c55e' : '#ef4444' }}>
                        {isSupport ? '서포터' : '딜러'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 프로필 정보 */}
                <div className="px-4 py-4 space-y-3">
                  {/* 이름 */}
                  <div>
                    <h1 className="text-base font-bold text-white leading-tight">{name}</h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {profile.CharacterClassName || dbChar?.class_name || '—'}
                      {arkTitle && (
                        <span className="text-gray-600"> · {arkTitle}</span>
                      )}
                    </p>
                  </div>

                  {/* 길드 */}
                  {guildName && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-600 w-10 flex-shrink-0">길드</span>
                      <span className="text-xs text-gray-300 truncate">{guildName}</span>
                    </div>
                  )}

                  {/* 서버 */}
                  {(profile.ServerName || dbChar?.server) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-600 w-10 flex-shrink-0">서버</span>
                      <span className="text-xs text-gray-400">{profile.ServerName || dbChar?.server}</span>
                    </div>
                  )}

                  {/* 레벨 */}
                  {profile.CharacterLevel && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-600 w-10 flex-shrink-0">전투</span>
                      <span className="text-xs text-gray-400">Lv.{profile.CharacterLevel}</span>
                    </div>
                  )}
                  {profile.CharacterExpeditionLevel && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-600 w-10 flex-shrink-0">원정대</span>
                      <span className="text-xs text-gray-400">Lv.{profile.CharacterExpeditionLevel}</span>
                    </div>
                  )}

                  <div className="border-t border-gray-800 pt-3 space-y-2">
                    {/* 아이템 레벨 */}
                    <div>
                      <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5">아이템 레벨</p>
                      <p className="text-lg font-bold" style={{ color: levelColor(itemLevel) }}>
                        {itemLevel ? itemLevel.toLocaleString() : '—'}
                      </p>
                    </div>
                    {/* 전투력 */}
                    <div>
                      <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5">전투력</p>
                      <div className="flex items-center gap-1.5">
                        <RoleIcon isSupport={isSupport} size={13} />
                        <p className="text-lg font-bold" style={{ color: cpColor(isSupport) }}>
                          {combatPower ? combatPower.toLocaleString() : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 칭호 */}
                  {profile.CharacterTitle && (
                    <div className="text-[10px] text-amber-400/70 bg-amber-400/8 border border-amber-400/15 rounded px-2 py-1 text-center">
                      {profile.CharacterTitle}
                    </div>
                  )}

                  {/* 이번 주 배치된 레이드 */}
                  {placedRaids.length > 0 && (
                    <div>
                      <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1.5">이번 주 배치된 레이드</p>
                      <div className="flex flex-col gap-1">
                        {placedRaids.map(r => (
                          <button key={r.id} onClick={() => navigate(`/raids/${r.id}`)}
                            className={`text-[10px] font-medium px-2 py-1 rounded text-left ${DIFF_STYLE[r.difficulty] || 'bg-gray-700 text-gray-300'} hover:opacity-80 transition-opacity`}>
                            {r.raid_name} · {r.difficulty}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 외부 링크 */}
                  <div className="border-t border-gray-800 pt-3">
                    <p className="text-[9px] text-gray-700 uppercase tracking-wider mb-2">외부 사이트</p>
                    <div className="flex flex-col gap-1">
                      {externalLinks(name).map(({ label, url }) => (
                        <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-gray-600 hover:text-gray-300 transition-colors flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-gray-700">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════
                우측 — 탭 + 컨텐츠
                ════════════════════════════════════ */}
            <div className="flex-1 min-w-0">
              <div className="bg-gray-900/70 border border-gray-800/60 rounded-2xl overflow-hidden">
                {/* 탭 바 */}
                <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-gray-800/60 overflow-x-auto">
                  {TABS.map(tab => (
                    <Tab key={tab.id} label={tab.label} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
                  ))}
                </div>
                {/* 컨텐츠 */}
                <div className="p-5">
                  {renderTab()}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
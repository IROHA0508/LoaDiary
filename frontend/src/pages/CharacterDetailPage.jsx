import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCharacters } from '../api/characters'
import { getMyRaids, getJoinedRaids, getSlots } from '../api/raids'
import { useUser } from '../hooks/useUser'
import client from '../api/client'

/* ─────────────────────────────────────────────
   API
   ───────────────────────────────────────────── */
const fetchArmory = (name) =>
  client.get(`/api/characters/${encodeURIComponent(name)}/armory`)
    .then((r) => r.data)
    .catch(() => { throw new Error('캐릭터 정보를 불러올 수 없습니다.') })

// 원정대 siblings — 탭 진입 시에만 호출 (lazy)
const fetchSiblings = (name) =>
  client.get(`/api/characters/${encodeURIComponent(name)}/siblings`)
    .then((r) => r.data)
    .catch(() => [])

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

/* ── 직업명 → CDN 이미지 슬러그 매핑 ── */
/* 기본 주소: https://pica.korlark.com/2018/obt/assets/images/common/thumb/{slug}.png */
const CLASS_IMAGE_MAP = {
  // 전사
  '워로드':       'warlord',
  '배럭':         'berserker',
  '디스트로이어': 'destroyer',
  '슬레이어':     'slayer',
  '홀리나이트':   'holyknight',
  '발키리':       'valkyrie',
  // 무도가
  '배틀마스터':   'battlemaster',
  '인파이터':     'infighter',
  '기공사':       'soulmaster',
  '창술사':       'lancemaster',
  '스트라이커':   'striker',
  '브레이커':     'breaker',
  // 사냥꾼
  '데빌헌터':     'devilhunter',
  '블래스터':     'blaster',
  '호크아이':     'hawkeye',
  '스카우터':     'scouter',
  '건슬링어':     'gunslinger',
  // 마법사
  '아르카나':     'arcana',
  '소서리스':     'sorceress',
  '서머너':       'summoner',
  '바드':         'bard',
  // 암살자
  '블레이드':     'blade',
  '데모닉':       'demonic',
  '리퍼':         'reaper',
  '소울이터':     'souleater',
  // 스페셜리스트
  '도화가':       'artist',
  '기상술사':     'aeromancer',
  '환수사' :      'alchemist',
  '가디언나이트': 'dragon_knight'
}
const CDN_BASE = '/images/classes'

/* HTML 태그 제거 */
function stripHtml(str) {
  if (!str) return ''
  return str.replace(/<[^>]*>/g, '').trim()
}

/**
 * 아크패시브 Description 파싱
 * API 원문 예시: "<FONT color='#F1D594'>진화</FONT> 1티어 특화 Lv.10"
 * stripHtml 후: "진화 1티어 특화 Lv.10"
 * → { tier: 1, skillName: "특화", lv: 10 }
 *
 * Level / Point 필드가 있으면 그것을 우선 사용하고,
 * 없으면 Description 문자열에서 정규식으로 추출
 */
function parseArkNode(ef) {
  const desc = stripHtml(ef.Description || '')
  // 우선 Level/Point 필드 확인 (API가 숫자형으로 반환하는 경우)
  if (typeof ef.Level === 'number' && typeof ef.Point === 'number') {
    // skillName: Description에서 카테고리·티어·Lv 부분 제거
    const nameOnly = desc
      .replace(/^(?:진화|깨달음|도약)\s*/, '')   // 앞 카테고리 제거
      .replace(/^\d+티어\s*/, '')                 // 앞 티어 제거
      .replace(/\s*Lv\.\d+$/, '')                // 뒤 Lv 제거
      .trim()
    return { tier: ef.Level, skillName: nameOnly || desc, lv: ef.Point }
  }
  // 필드 없는 경우: Description 정규식 파싱
  // 패턴: "{카테고리} {N}티어 {스킬명} Lv.{M}"
  const m = desc.match(/^(?:진화|깨달음|도약)\s+(\d+)티어\s+(.+?)\s+Lv\.(\d+)$/)
  if (m) return { tier: Number(m[1]), skillName: m[2], lv: Number(m[3]) }
  // 파싱 실패 시 원문 그대로
  return { tier: null, skillName: desc, lv: null }
}

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
/* ── 스켈레톤 로더 (체감 로딩 시간 단축) ── */
function SkeletonLoader() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 장비 섹션 스켈레톤 */}
      <div>
        <div className="h-3 w-24 bg-gray-800 rounded mb-3" />
        <div className="flex gap-2">
          <div className="flex flex-col gap-1.5 flex-1">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-[52px] bg-gray-800/60 rounded-lg" />
            ))}
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-[52px] bg-gray-800/60 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
      {/* 보석 스켈레톤 */}
      <div>
        <div className="h-3 w-16 bg-gray-800 rounded mb-3" />
        <div className="grid grid-cols-11 gap-1.5">
          {Array.from({ length: 11 }, (_, i) => (
            <div key={i} className="aspect-square bg-gray-800/60 rounded-lg" />
          ))}
        </div>
      </div>
      {/* 특성 스켈레톤 */}
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-20 bg-gray-800 rounded mb-2" />
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="h-9 bg-gray-800/60 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
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

// ── 계승 장비 판별 ─────────────────────────────────────
// 계승 전: "운명의 결단~"(유물), "운명의 업화~"(고대)
// 계승 후: "운명의 전율~"(고대) ← 이 prefix 만 체크하면 됨
const INHERITED_PREFIX     = '운명의 전율'
const INHERITED_BORDER_SRC = '/images/inherited-border.png'
/** @param {string|undefined} name */
function isInherited(name) {
  return typeof name === 'string' && name.includes(INHERITED_PREFIX)
}

function EquipSlot({ item }) {
  if (!item) return (
    <div className="flex items-center gap-2 bg-gray-800/30 border border-gray-700/20 rounded-lg px-2.5 py-2 opacity-40">
      <div className="w-9 h-9 rounded bg-gray-700/50 flex-shrink-0" />
      <span className="text-[10px] text-gray-600">비어있음</span>
    </div>
  )

  const col       = eqGradeColor(item.Grade)
  const inherited = isInherited(item.Name)

  return (
    <div
      className="flex items-center gap-2.5 bg-gray-800/50 border rounded-lg px-2.5 py-2"
      style={{ borderColor: col + '44' }}
    >
      {/* ── 아이콘 래퍼 — relative는 반드시 contain 없는 컨텍스트에 있어야 함 ── */}
      <div className="relative w-9 h-9 flex-shrink-0">
        {item.Icon
          ? <img
              src={item.Icon}
              alt={item.Type}
              loading="lazy"
              decoding="async"
              className="w-full h-full rounded object-cover"
              style={{ border: `1.5px solid ${col}66` }}
            />
          : <div className="w-full h-full rounded bg-gray-700" />
        }
        {inherited && (
          <img
            src={INHERITED_BORDER_SRC}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            className="absolute inset-0 w-full h-full object-fill rounded pointer-events-none select-none"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-gray-600 leading-tight">{item.Type}</p>
        <p className="text-[11px] font-medium truncate leading-tight mt-0.5" style={{ color: col }}>
          {item.Name || '—'}
        </p>
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

      {/* 보석 — 장비 섹션 너비에 맞춘 11컬럼 그리드 */}
      {gems.length > 0 && (
        <div>
          <SectionTitle>보석</SectionTitle>
          <div className="grid gap-1.5 mb-3" style={{ gridTemplateColumns: 'repeat(11, 1fr)' }}>
            {Array.from({ length: 11 }, (_, i) => {
              const gem = gems[i]
              return gem ? (
                <div key={i} className="flex flex-col items-center gap-1" title={gem.Name}>
                  {gem.Icon ? (
                    <img
                      src={gem.Icon}
                      alt={gem.Name}
                      loading="lazy"
                      decoding="async"
                      className="w-full aspect-square rounded-lg border border-gray-700 object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-gray-700" />
                  )}
                  <span className="text-[12px] text-white-500 leading-none">{gem.Level ?? ''}레벨</span>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-full aspect-square rounded-lg bg-gray-800/40 border border-gray-700/30" />
                  <span className="text-[9px] text-gray-700 leading-none">—</span>
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

      {/* ── 아크 패시브 — 사진4 스타일 ── */}
      {arkPoints.length > 0 && (
        <div>
          <SectionTitle>아크 패시브</SectionTitle>

          {/* 포인트 헤더 + 랭크/레벨 — 3열 */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {arkPoints.map(p => {
              const catName = stripHtml(p.Name)
              const col = ARK_COLORS[catName] || '#94a3b8'

              return (
                <div key={catName} className="rounded-xl px-4 py-5 border flex flex-col items-center text-center"
                  style={{ background: `${col}12`, borderColor: `${col}40` }}>
                  {/* 카테고리 뱃지 */}
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md mb-3"
                    style={{ background: `${col}30`, color: col }}>
                    {catName}
                  </span>
                  {/* 포인트 수치 */}
                  <p className="text-4xl font-bold text-white leading-none">{p.Value}</p>
                  <p className="text-xs text-gray-400 mt-1">포인트</p>
                  {/* 랭크·레벨 */}
                  {p.Description && (
                    <p className="text-sm font-semibold mt-3 w-full border-t pt-3 text-center"
                      style={{ color: col, borderColor: `${col}30` }}>
                      {p.Description}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {arkEffects.length > 0 && (() => {
            // ★ 최적화: grouped 빌드를 reduce로 한 번에 처리
            const grouped = arkEffects.reduce((acc, ef) => {
              if (acc[ef.Name]) acc[ef.Name].push(ef)
              return acc
            }, { '진화': [], '깨달음': [], '도약': [] })

            // ★ 최적화: 파싱 결과를 미리 캐싱 (같은 arkEffects로 중복 파싱 방지)
            const parsed = arkEffects.map(ef => {
              const plain = stripHtml(ef.Description || '')
              const m = plain.match(/^(?:진화|깨달음|도약)\s+(\d+)티어\s+(.+?)\s+Lv\.(\d+)$/)
              return {
                ef,
                tier:      m ? Number(m[1]) : null,
                skillName: m ? m[2] : plain,
                lv:        m ? Number(m[3]) : null,
              }
            })
            // 카테고리별로 parsed 결과 재그룹
            const parsedGrouped = { '진화': [], '깨달음': [], '도약': [] }
            parsed.forEach(item => {
              if (parsedGrouped[item.ef.Name]) parsedGrouped[item.ef.Name].push(item)
            })

            const cats = ['진화', '깨달음', '도약']
            return (
              <div className="grid grid-cols-3 gap-x-4 gap-y-0">
                {cats.map(cat => {
                  const col = ARK_COLORS[cat]
                  return (
                    <div key={cat}>
                      {/* 컬럼 헤더 */}
                      <p className="text-sm font-bold mb-3 pb-2 border-b"
                        style={{ color: col, borderColor: `${col}40` }}>
                        {cat}
                      </p>
                      <div className="space-y-1.5">
                        {parsedGrouped[cat].length === 0
                          ? <p className="text-xs text-gray-600">—</p>
                          : parsedGrouped[cat].map(({ ef, tier, skillName, lv }, i) => (
                            <div key={i}
                              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-gray-800/60 transition-colors"
                              style={{ background: 'rgba(255,255,255,0.03)' }}>
                              {ef.Icon ? (
                                <img src={ef.Icon} alt="" loading="lazy" decoding="async"
                                  className="w-8 h-8 rounded-md flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-md bg-gray-700/50 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0 flex items-baseline gap-1.5 flex-wrap">
                                {/* 티어 — 회색, 크기 업 */}
                                {tier !== null && (
                                  <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap">
                                    {tier}티어
                                  </span>
                                )}
                                {/* 스킬명 — 흰색, 크기 업 */}
                                <span className="text-xs font-medium truncate flex-1 min-w-0" style={{ color: col }}>
                                  {skillName}
                                </span>
                                {/* Lv.N — 카테고리 컬러, 크기 업 */}
                                {lv !== null && (
                                  <span className="text-xs font-bold flex-shrink-0 whitespace-nowrap"
                                    style={{ color: col }}>
                                    Lv.{lv}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* 보석: 장비 섹션 내에서 표시 */}

      {/* ── 카드 — 사진4 스타일 ── */}
      {cards.length > 0 && (
        <div>
          {/* 헤더: "카드" 제목 + 세트명 우측 */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">카드</h3>
            {cardEffects.length > 0 && (
              <span className="text-[10px] text-amber-400/70">
                {cardEffects[cardEffects.length - 1]?.Items?.[0]?.Name || ''}{' '}
                {cards.length}각
              </span>
            )}
          </div>

          {/* 카드 가로 스크롤 */}
          <div
            className="flex gap-2 mb-4 pb-1 overflow-x-auto"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.2) transparent' }}
          >
            {cards.map(card => (
              <div key={card.Slot}
                className="flex-shrink-0 w-[110px] bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700/40">
                {/* 카드 이미지 비율 1:1.45 고정 */}
                <div style={{ aspectRatio: '1 / 1.45', overflow: 'hidden' }}>
                  {card.Icon ? (
                    <img
                      src={card.Icon}
                      alt={card.Name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700/40" />
                  )}
                </div>
                <div className="px-1.5 pb-1.5 pt-1">
                  <p className="text-[9px] text-gray-300 truncate leading-tight">{card.Name}</p>
                  {/* 각성 점 표시 */}
                  <div className="flex gap-0.5 mt-1 flex-wrap">
                    {Array.from({ length: card.AwakeTotal || 0 }, (_, k) => (
                      <div key={k}
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: k < (card.AwakeCount || 0) ? '#f59e0b' : 'rgba(100,116,139,0.3)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 세트 효과 */}
          {cardEffects.length > 0 && (
            <div className="space-y-2">
              {cardEffects.map((ef, i) => (
                <div key={i} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-amber-400 mb-1.5">{ef.CardSlots}장 세트 효과</p>
                  <div className="space-y-1">
                    {ef.Items?.map((item, j) => (
                      <div key={j}>
                        <p className="text-[11px] font-semibold text-gray-300">{item.Name}</p>
                        {item.Description && (
                          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{item.Description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 직업 아바타 — CDN 이미지 + 이니셜 fallback ── */
function ClassAvatar({ className, color }) {
  const [imgError, setImgError] = useState(false)
  const slug = CLASS_IMAGE_MAP[className]
  const showImg = !!slug && !imgError

  return (
    <div
      className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold select-none"
      style={{
        border:     `1.5px solid ${color}55`,
        background: showImg ? 'transparent' : `${color}1a`,
        color,
      }}
    >
      {showImg ? (
        <img
          src={`${CDN_BASE}/${slug}.png`}
          alt={className}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-top"
        />
      ) : (
        className?.[0] ?? '?'
      )}
    </div>
  )
}

/* ── 아이템 레벨 아이콘 (투구 실루엣) ── */
function ArmorIcon({ size = 11, color = '#94a3b8' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M6 1C4 1 2 2.5 2 4.5V5.5L1 7H11L10 5.5V4.5C10 2.5 8 1 6 1Z"
        stroke={color} strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
      <rect x="2" y="7" width="8" height="4" rx="1" stroke={color} strokeWidth="1.2" fill="none"/>
    </svg>
  )
}

/* ── 보유 캐릭터 탭 ── */
function TabCharacters({ siblings, currentName, guildName, onSelect, isLoading }) {
  /* 스켈레톤 */
  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        {[0, 1].map(i => (
          <div key={i}>
            <div className="h-3 w-20 bg-gray-800 rounded mb-3" />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map(j => (
                <div key={j} className="h-[86px] bg-gray-800/60 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!siblings.length) {
    return (
      <p className="text-sm text-gray-500 py-10 text-center">
        원정대 정보를 불러올 수 없습니다.
      </p>
    )
  }

  /* ── 서버별 그룹핑 ───────────────────────────────────── */
  const serverMap = siblings.reduce((acc, char) => {
    const sv = char.server || '알 수 없음'
    if (!acc[sv]) acc[sv] = []
    acc[sv].push(char)
    return acc
  }, {})

  /* 현재 캐릭터 서버를 맨 앞으로 */
  const currentServer = siblings.find(c => c.name === currentName)?.server
  const servers = Object.keys(serverMap).sort((a, b) => {
    if (a === currentServer) return -1
    if (b === currentServer) return 1
    return 0
  })

  return (
    <div className="space-y-6">
      {servers.map(server => {
        /* 아이템레벨 내림차순 */
        const chars = [...serverMap[server]].sort(
          (a, b) => (b.item_level || 0) - (a.item_level || 0)
        )

        return (
          <div key={server}>
            {/* ── 서버 헤더 ── */}
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-bold text-white">{server}</h3>
              <span className="text-[11px] text-gray-500">
                보유 캐릭터 {chars.length}
              </span>
            </div>

            {/* ── 2열 그리드 ── */}
            <div className="grid grid-cols-2 gap-2">
              {chars.map(char => {
                const isCurrent  = char.name === currentName
                const isSupport  = !!char.is_support
                const lColor     = levelColor(char.item_level)
                const cColor     = cpColor(isSupport)
                const accentColor = isCurrent ? '#f59e0b' : lColor

                return (
                  <div
                    key={char.name}
                    onClick={() => !isCurrent && onSelect(char.name)}
                    style={{
                      borderTop:    '1px solid rgba(75,85,99,0.25)',
                      borderRight:  '1px solid rgba(75,85,99,0.25)',
                      borderBottom: '1px solid rgba(75,85,99,0.25)',
                      borderLeft:   `3px solid ${accentColor}`,
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors ${
                      isCurrent
                        ? 'bg-amber-500/8 cursor-default'
                        : 'bg-gray-800/40 hover:bg-gray-800/70 cursor-pointer'
                    }`}
                  >
                    {/* 초상화 — 직업 CDN 이미지 (실패 시 이니셜 fallback) */}
                    <ClassAvatar className={char.class_name} color={lColor} />

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      {/* 전투레벨 + 직업 */}
                      <p className="text-[10px] text-gray-500 leading-tight">
                        Lv.{char.level ?? '—'}&nbsp;{char.class_name}
                      </p>

                      {/* 캐릭터명 */}
                      <p className={`text-sm font-bold truncate leading-snug mt-0.5 ${
                        isCurrent ? 'text-amber-400' : 'text-gray-100'
                      }`}>
                        {char.name}
                        {isCurrent && (
                          <span className="ml-1.5 text-[10px] text-amber-500/70">현재</span>
                        )}
                      </p>

                      {/* 아이템레벨 + 전투력 + 길드 */}
                      <div className="flex items-center justify-between mt-1 gap-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* 아이템레벨 */}
                          <div className="flex items-center gap-0.5">
                            <ArmorIcon size={10} color={lColor} />
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: lColor }}
                            >
                              {char.item_level?.toLocaleString() ?? '—'}
                            </span>
                          </div>
                          {/* 전투력 */}
                          {char.combat_power != null && (
                            <div className="flex items-center gap-0.5">
                              <RoleIcon isSupport={isSupport} size={10} />
                              <span
                                className="text-[11px] font-semibold"
                                style={{ color: cColor }}
                              >
                                {char.combat_power.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        {/* 길드 */}
                        {guildName && (
                          <span className="text-[10px] text-gray-500 flex-shrink-0 truncate max-w-[60px]">
                            {guildName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
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

  /* ── 검색 캐릭터의 원정대 (보유 캐릭터 탭 진입 시에만 fetch) ── */
  const { data: siblings = [], isLoading: siblingsLoading } = useQuery({
    queryKey: ['siblings', name],
    queryFn:  () => fetchSiblings(name),
    enabled:  !!name && activeTab === 'characters',  // 탭 진입 전까지 호출 안 함
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
      return (
        <TabCharacters
          siblings={siblings}
          currentName={name}
          guildName={guildName}
          onSelect={n => navigate(`/characters/${n}`)}
          isLoading={siblingsLoading}
        />
      )
    }
    if (!armoryLoading && armoryError) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm text-red-400 mb-1">⚠ 정보를 불러오지 못했습니다.</p>
          <p className="text-xs text-gray-600">Lostark API 응답을 확인해주세요.</p>
        </div>
      )
    }
    if (armoryLoading) return <SkeletonLoader />

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
            <div className="flex-shrink-0 w-85 sticky top-[60px]">
              <div className="bg-gray-900/70 border border-gray-800/60 rounded-2xl overflow-hidden">

                {/* 캐릭터 이미지 — 상반신(얼굴) 위주 */}
                <div className="relative" style={{ height: 320, overflow: 'hidden' }}>
                  {profile.CharacterImage ? (
                    <img
                      src={profile.CharacterImage}
                      alt={name}
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center 5%',
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
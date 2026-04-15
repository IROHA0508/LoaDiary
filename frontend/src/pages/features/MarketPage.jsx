import { useState, useMemo, memo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { getMarketItems, getItemHistory, getJewelItems } from '../../api/market'

/* ─────────────────────────────────────────────
   아이콘 상수
   ───────────────────────────────────────────── */
const ENGRAVING_ICON = 'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_9_25.png'

// 보석(경매장) 아이콘 — 아크그리드 gem과 구분하여 JEWEL_ICON 사용
const JEWEL_ICON = {
  '10레벨 겁화의 보석': 'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_105.png',
  '9레벨 겁화의 보석':  'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_104.png',
  '8레벨 겁화의 보석':  'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_103.png',
  '7레벨 겁화의 보석':  'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_102.png',
  '6레벨 겁화의 보석':  'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_101.png',
  '10레벨 작열의 보석': 'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_115.png',
  '9레벨 작열의 보석':  'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_114.png',
  '8레벨 작열의 보석':  'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_113.png',
  '7레벨 작열의 보석':  'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_112.png',
  '6레벨 작열의 보석':  'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_111.png',
  '10레벨 멸화의 보석': 'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_9_55.png',
  '10레벨 홍염의 보석': 'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_9_65.png',
}

/* ─────────────────────────────────────────────
   카테고리 메타
   ───────────────────────────────────────────── */
const CATEGORY_META = {
  refine:    { label: '재련 재료', hasChart: true  },
  life:      { label: '생활 재료', hasChart: true  },
  engraving: { label: '각인서',    hasChart: true  },
  jewel:     { label: '보석',      hasChart: false },
}

/* ─────────────────────────────────────────────
   정적 아이템 목록
   - 이름·아이콘은 즉시 표시 (API 대기 없음)
   - 가격은 API 응답 후 채워짐
   - jewel    : 순서 고정 (2열 그리드)
   - engraving: 가격 로드 후 내림차순 재정렬
   ───────────────────────────────────────────── */
const STATIC_ITEMS = {

  /* ── 재련 재료 ───────────────────────────────── */
  refine: [
      { name: '운명의 파괴석 결정' },
      { name: '운명의 파괴석' },
      { name: '운명의 수호석 결정' },
      { name: '운명의 수호석' },
      { name: '운명의 파편 주머니(소)' },
      { name: '운명의 파편 주머니(중)' },
      { name: '운명의 파편 주머니(대)' },
      { name: '운명의 돌파석' },
      { name: '위대한 운명의 돌파석' },
      { name: '상급 아비도스 융화 재료' },
      { name: '아비도스 융화 재료' },
      { name: '정제된 파괴강석' },
      { name: '정제된 수호강석' },
      { name: '찬란한 명예의 돌파석' },
      { name: '명예의 파편 주머니(소)' },
      { name: '명예의 파편 주머니(중)' },
      { name: '명예의 파편 주머니(대)' },
      { name: '최상급 오레하 융화 재료' },
      { name: '강화 야금술 : 업화 [19-20]' },
      { name: '강화 재봉술 : 업화 [19-20]' },
      { name: '야금술 : 업화 [19-20]' },
      { name: '재봉술 : 업화 [19-20]' },
      { name: '야금술 : 업화 [15-18]' },
      { name: '재봉술 : 업화 [15-18]' },
      { name: '야금술 : 업화 [11-14]' },
      { name: '재봉술 : 업화 [11-14]' },
      { name: '장인의 야금술 : 4단계' },
      { name: '장인의 재봉술 : 4단계' },
      { name: '장인의 야금술 : 3단계' },
      { name: '장인의 재봉술 : 3단계' },
      { name: '장인의 야금술 : 2단계' },
      { name: '장인의 재봉술 : 2단계' },
      { name: '장인의 야금술 : 1단계' },
      { name: '장인의 재봉술 : 1단계' },
      { name: '용암의 숨결' },
      { name: '빙하의 숨결' },
    ],
  /* ── 생활 재료 ───────────────────────────────── */
  life: [
    { name: '들꽃' },
    { name: '수줍은 들꽃' },
    { name: '화사한 들꽃' },
    { name: '아비도스 들꽃' },
    { name: '목재' },
    { name: '부드러운 목재' },
    { name: '튼튼한 목재' },
    { name: '아비도스 목재' },
    { name: '철광석' },
    { name: '묵직한 철광석' },
    { name: '단단한 철광석' },
    { name: '아비도스 철광석' },
    { name: '진귀한 가죽' },
    { name: '두툼한 생고기' },
    { name: '다듬은 생고기' },
    { name: '오레하 두툼한 생고기' },
    { name: '아비도스 두툼한 생고기' },
    { name: '생선' },
    { name: '붉은 살 생선' },
    { name: '오레하 태양 잉어' },
    { name: '아비도스 태양 잉어' },
    { name: '고대 유물' },
    { name: '희귀한 유물' },
    { name: '오레하 유물' },
    { name: '아비도스 유물' },
  ],

  /* ── 각인서 (유물 전투) ──────────────────────── */
  engraving: [
    { name: '원한 각인서',          icon: ENGRAVING_ICON },
    { name: '아드레날린 각인서',     icon: ENGRAVING_ICON },
    { name: '돌격대장 각인서',       icon: ENGRAVING_ICON },
    { name: '질량 증가 각인서',      icon: ENGRAVING_ICON },
    { name: '저주받은 인형 각인서',  icon: ENGRAVING_ICON },
    { name: '예리한 둔기 각인서',    icon: ENGRAVING_ICON },
    { name: '기습의 대가 각인서',    icon: ENGRAVING_ICON },
    { name: '타격의 대가 각인서',    icon: ENGRAVING_ICON },
    { name: '각성 각인서',           icon: ENGRAVING_ICON },
    { name: '결투의 대가 각인서',    icon: ENGRAVING_ICON },
    { name: '전문의 각인서',         icon: ENGRAVING_ICON },
    { name: '슈퍼 차지 각인서',      icon: ENGRAVING_ICON },
    { name: '구슬동자 각인서',       icon: ENGRAVING_ICON },
    { name: '마나의 흐름 각인서',    icon: ENGRAVING_ICON },
    { name: '속전속결 각인서',       icon: ENGRAVING_ICON },
    { name: '바리케이드 각인서',     icon: ENGRAVING_ICON },
    { name: '중갑 착용 각인서',      icon: ENGRAVING_ICON },
    { name: '안정된 상태 각인서',    icon: ENGRAVING_ICON },
    { name: '급소 타격 각인서',      icon: ENGRAVING_ICON },
    { name: '마나 효율 증가 각인서', icon: ENGRAVING_ICON },
    { name: '정기 흡수 각인서',      icon: ENGRAVING_ICON },
    { name: '정밀 단도 각인서',      icon: ENGRAVING_ICON },
    { name: '승부사 각인서',         icon: ENGRAVING_ICON },
    { name: '선수필승 각인서',       icon: ENGRAVING_ICON },
    { name: '분쇄의 주먹 각인서',    icon: ENGRAVING_ICON },
    { name: '폭발물 전문가 각인서',  icon: ENGRAVING_ICON },
    { name: '추진력 각인서',         icon: ENGRAVING_ICON },
    { name: '긴급구조 각인서',       icon: ENGRAVING_ICON },
    { name: '위기 모면 각인서',      icon: ENGRAVING_ICON },
    { name: '달인의 저력 각인서',    icon: ENGRAVING_ICON },
    { name: '번개의 분노 각인서',    icon: ENGRAVING_ICON },
    { name: '시선 집중 각인서',      icon: ENGRAVING_ICON },
    { name: '최대 마나 증가 각인서', icon: ENGRAVING_ICON },
    { name: '약자 무시 각인서',      icon: ENGRAVING_ICON },
    { name: '부러진 뼈 각인서',      icon: ENGRAVING_ICON },
    { name: '강령술 각인서',         icon: ENGRAVING_ICON },
    { name: '불굴 각인서',           icon: ENGRAVING_ICON },
    { name: '실드관통 각인서',       icon: ENGRAVING_ICON },
    { name: '강화 방패 각인서',      icon: ENGRAVING_ICON },
    { name: '에테르 포식자 각인서',  icon: ENGRAVING_ICON },
    { name: '굳은 의지 각인서',      icon: ENGRAVING_ICON },
    { name: '여신의 가호 각인서',    icon: ENGRAVING_ICON },
    { name: '탈출의 명수 각인서',    icon: ENGRAVING_ICON },
  ],

  /* ── 보석(경매장) — 2열 그리드용 고정 순서 ────── */
  // [0~4] 겁화 10→6 / [5~9] 작열 10→6 / [10] 멸화 / [11] 홍염
  jewel: [
    { name: '10레벨 겁화의 보석', icon: JEWEL_ICON['10레벨 겁화의 보석'] },
    { name: '9레벨 겁화의 보석',  icon: JEWEL_ICON['9레벨 겁화의 보석']  },
    { name: '8레벨 겁화의 보석',  icon: JEWEL_ICON['8레벨 겁화의 보석']  },
    { name: '7레벨 겁화의 보석',  icon: JEWEL_ICON['7레벨 겁화의 보석']  },
    { name: '6레벨 겁화의 보석',  icon: JEWEL_ICON['6레벨 겁화의 보석']  },
    { name: '10레벨 작열의 보석', icon: JEWEL_ICON['10레벨 작열의 보석'] },
    { name: '9레벨 작열의 보석',  icon: JEWEL_ICON['9레벨 작열의 보석']  },
    { name: '8레벨 작열의 보석',  icon: JEWEL_ICON['8레벨 작열의 보석']  },
    { name: '7레벨 작열의 보석',  icon: JEWEL_ICON['7레벨 작열의 보석']  },
    { name: '6레벨 작열의 보석',  icon: JEWEL_ICON['6레벨 작열의 보석']  },
    { name: '10레벨 멸화의 보석', icon: JEWEL_ICON['10레벨 멸화의 보석'] },
    { name: '10레벨 홍염의 보석', icon: JEWEL_ICON['10레벨 홍염의 보석'] },
  ],
}

/* ─────────────────────────────────────────────
   숫자 포맷 유틸
   ───────────────────────────────────────────── */
// ✅ 최적화: Intl.NumberFormat 인스턴스 재사용
const numFmt = new Intl.NumberFormat('ko-KR')
const formatGold = (v) => (v == null ? '-' : numFmt.format(v))

/* ─────────────────────────────────────────────
   변동량 뱃지
   ───────────────────────────────────────────── */
function DiffBadge({ diff, diffPct }) {
  if (diff == null) return <span className="text-gray-600 text-xs">-</span>
  // ✅ diff=0이면 회색으로 표시
  if (diff === 0) {
    const pct = diffPct != null ? ` (${Math.abs(diffPct).toFixed(1)}%)` : ''
    return (
      <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
        - {formatGold(0)}{pct}
      </span>
    )
  }
  const up  = diff > 0
  const pct = diffPct != null ? ` (${Math.abs(diffPct).toFixed(1)}%)` : ''
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-400' : 'text-red-400'} whitespace-nowrap`}>
      {up ? '▲' : '▼'} {formatGold(Math.abs(diff))}{pct}
    </span>
  )
}

/* ─────────────────────────────────────────────
   사이드바 아이템 행 (재련·생활·각인서용)
   ───────────────────────────────────────────── */
// ✅ 최적화: React.memo — 선택 상태·가격이 바뀐 항목만 리렌더
const ItemRow = memo(function ItemRow({ item, selected, onClick }) {
  const price = item.current_min_price ?? item.buy_price
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left
        transition-colors cursor-pointer
        ${selected
          ? 'bg-amber-500/15 border border-amber-500/30'
          : 'hover:bg-gray-800/60 border border-transparent'
        }`}
    >
      {item.icon
        ? <img src={item.icon} alt={item.name} loading="lazy" decoding="async"
            className="w-9 h-9 rounded-lg flex-shrink-0 object-cover border border-gray-700" />
        : <div className="w-9 h-9 rounded-lg flex-shrink-0 bg-gray-800/80 border border-gray-700" />
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate leading-tight">{item.name}</p>
        {/* ✅ 가격 옆에 변동 뱃지 인라인 배치 */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <p className={`text-sm font-bold ${price != null ? 'text-amber-300' : 'text-gray-600'}`}>
            {formatGold(price)}
          </p>
          <DiffBadge diff={item.diff} diffPct={item.diff_pct} />
        </div>
      </div>
    </button>
  )
})

/* ─────────────────────────────────────────────
   보석 카드 (JewelGrid 내부 셀)
   ───────────────────────────────────────────── */
function JewelCard({ item }) {
  if (!item) return <div />
  const price = item.current_min_price ?? item.buy_price
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 flex items-center gap-3
      hover:border-gray-700 transition-colors">
      {item.icon
        ? <img src={item.icon} alt={item.name} loading="lazy" decoding="async"
            className="w-11 h-11 rounded-lg border border-gray-700 flex-shrink-0 object-cover" />
        : <div className="w-11 h-11 rounded-lg flex-shrink-0 bg-gray-800 border border-gray-700" />
      }
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 truncate">{item.name}</p>
        {/* ✅ 가격 옆에 변동 뱃지 인라인 배치 */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <p className={`text-sm font-bold ${price != null ? 'text-amber-300' : 'text-gray-600 animate-pulse'}`}>
            {formatGold(price)}
          </p>
          <DiffBadge diff={item.diff} diffPct={item.diff_pct} />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   보석 2열 그리드 레이아웃
   ───────────────────────────────────────────── */
// items 배열 구조:
//   [0~4]  겁화 10→6레벨   (왼쪽 열)
//   [5~9]  작열 10→6레벨   (오른쪽 열)
//   [10]   멸화 10레벨      (마지막 행 왼쪽)
//   [11]   홍염 10레벨      (마지막 행 오른쪽)
function JewelGrid({ items }) {
  // ✅ 최적화: useMemo — items 변경 시에만 rows 재계산
  const rows = useMemo(() => [
    [items[0],  items[5]],   // 10겁화 | 10작열
    [items[1],  items[6]],   //  9겁화 |  9작열
    [items[2],  items[7]],   //  8겁화 |  8작열
    [items[3],  items[8]],   //  7겁화 |  7작열
    [items[4],  items[9]],   //  6겁화 |  6작열
    [items[10], items[11]],  // 10멸화 | 10홍염
  ], [items])

  return (
    <div className="market-scroll flex-1 overflow-y-auto p-6 flex flex-col items-center">
      {/* 열 헤더 */}
      <div className="grid grid-cols-2 gap-3 mb-2 w-full max-w-2xl">
        <p className="text-xs font-semibold text-gray-500 px-1">겁화</p>
        <p className="text-xs font-semibold text-gray-500 px-1">작열</p>
      </div>
      {/* 아이템 행 */}
      <div className="space-y-2 w-full max-w-2xl">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-2 gap-3">
            <JewelCard item={row[0]} />
            <JewelCard item={row[1]} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   커스텀 Tooltip (차트용)
   ───────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.name === '최저가' ? formatGold(p.value) : numFmt.format(p.value)}
        </p>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────
   차트 패널 (재련·생활·각인서용)
   ───────────────────────────────────────────── */
function ChartPanel({ item, category }) {
  // ✅ 모든 훅을 최상단에 선언 — 조기 return 이전에 위치해야 함 (React error #310 방지)
  const { data: rawHistory, isLoading } = useQuery({
    queryKey: ['item-history', category, item.name],
    queryFn:  () => getItemHistory(category, item.name),
    staleTime: 1000 * 60 * 60,
    enabled:   !!item.name,
  })

  // ✅ Worker 응답이 배열이 아닌 경우(에러 객체 등) 방어
  const history = Array.isArray(rawHistory) ? rawHistory : []

  // ✅ useMemo는 반드시 조기 return 전에 선언
  const chartData = useMemo(() =>
    [...history]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        date:   row.date.slice(5),
        최저가: row.avg_price,
        판매량: row.trade_count,
      })),
  [history])

  // ✅ 조기 return은 훅 선언 이후에만
  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-gray-500 text-sm animate-pulse">히스토리 불러오는 중...</p>
    </div>
  )
  if (!history.length) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-gray-500 text-sm">히스토리 수집 중입니다 · 내일부터 확인 가능합니다</p>
    </div>
  )

  return (
    <div className="flex-1 min-h-0 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#374151' }} />
          <YAxis yAxisId="gold" orientation="left" tick={{ fill: '#f59e0b', fontSize: 11 }}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} tickLine={false} axisLine={false} />
          <YAxis yAxisId="trade" orientation="right" tick={{ fill: '#60a5fa', fontSize: 11 }}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
          <Bar yAxisId="trade" dataKey="판매량" fill="#3b82f6" fillOpacity={0.35} radius={[2, 2, 0, 0]} maxBarSize={20} />
          <Line yAxisId="gold" type="monotone" dataKey="최저가" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#f59e0b' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─────────────────────────────────────────────
   메인 MarketPage
   ───────────────────────────────────────────── */
export default function MarketPage({ category }) {
  const [selectedItem, setSelectedItem] = useState(null)
  const meta    = CATEGORY_META[category] ?? { label: category, hasChart: true }
  const isJewel = category === 'jewel'

  // ✅ 드롭다운으로 카테고리 변경 시 선택 아이템 초기화
  // category prop이 바뀔 때마다 실행 — 이전 카테고리의 차트가 남아있지 않도록
  useEffect(() => { setSelectedItem(null) }, [category])

  // ── 가격 데이터 fetch (Layout에서 prefetch → 캐시 히트 시 즉시 반환) ──
  const { data: apiData = { items: [], updated_at: null }, isLoading: priceLoading, isError: priceError } = useQuery({
    queryKey: ['market-items', category],
    queryFn:  isJewel ? getJewelItems : () => getMarketItems(category),
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
  })

  const apiItems  = apiData.items ?? []
  const updatedAt = apiData.updated_at ?? null

  // ✅ 최적화: O(1) 이름 기반 가격 조회용 맵
  const priceMap = useMemo(() =>
    Object.fromEntries(apiItems.map(item => [item.name, item])),
  [apiItems])

  // ── 정적 목록 + API 가격 병합 + 정렬 ─────────
  const displayItems = useMemo(() => {
    const staticList = STATIC_ITEMS[category] ?? []
    const merged = staticList.map(staticItem => {
      const api = priceMap[staticItem.name] ?? {}
      return {
        name:              staticItem.name,
        icon:              staticItem.icon ?? api.icon ?? null,
        id:                api.id    ?? null,
        grade:             api.grade ?? null,
        current_min_price: api.current_min_price ?? api.buy_price ?? null,
        diff:              api.diff     ?? null,
        diff_pct:          api.diff_pct ?? null,
      }
    })
    // 각인서: 가격 내림차순 (가격 없는 항목은 맨 아래)
    if (category === 'engraving') {
      return merged.sort((a, b) =>
        (b.current_min_price ?? -1) - (a.current_min_price ?? -1)
      )
    }
    return merged
  }, [category, priceMap])

  return (
    <div className="h-[calc(100vh-48px)] overflow-hidden bg-gray-950 text-white flex flex-col">

      {/* MainPage와 동일한 스크롤바 스타일 */}
      <style>{`
        .market-scroll::-webkit-scrollbar { width: 3px; }
        .market-scroll::-webkit-scrollbar-track { background: transparent; }
        .market-scroll::-webkit-scrollbar-thumb {
          background: rgba(75, 85, 99, 0.45);
          border-radius: 4px;
        }
        .market-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.65);
        }
      `}</style>

      {/* 타이틀 — Layout 헤더와 동일한 max-w-[1400px] mx-auto px-8 */}
      <div className="max-w-[1400px] mx-auto w-full px-8 pt-5 pb-3 border-b border-gray-800
        flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">{meta.label} 시세</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {isJewel
              ? '경매장 기준 최저가 · 1분 갱신 · 변동량은 직전 1분 대비'
              : '거래소 기준 최저가 · 30일 히스토리 차트 · 변동량은 직전 1분 대비'}
          </p>
        </div>
        <div className="text-right text-xs">
          {priceLoading && (
            <span className="text-gray-500 animate-pulse">가격 불러오는 중...</span>
          )}
          {priceError && !priceLoading && (
            <span className="text-red-400">가격 조회 실패 · 잠시 후 재시도</span>
          )}
          {/* ✅ 마지막 갱신 시각 — Worker 응답에 updated_at 있을 때만 표시 */}
          {updatedAt && !priceLoading && (
            <span className="text-gray-600 block mt-0.5">
              Last update: {new Date(updatedAt).toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>

      {/* 본문 컨테이너 */}
      <div className="max-w-[1400px] mx-auto w-full flex flex-1 min-h-0 overflow-hidden">

        {isJewel ? (
          /* ── 보석: 2열 그리드 (사이드바·차트 없음) ── */
          <JewelGrid items={displayItems} />

        ) : (
          /* ── 재련·생활·각인서: 사이드바 + 차트 ─────── */
          <>
            <aside className="w-72 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
              <div className="market-scroll flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                {displayItems.map((item) => (
                  <ItemRow
                    key={item.name}
                    item={item}
                    selected={selectedItem?.name === item.name}
                    onClick={() =>
                      setSelectedItem(prev => prev?.name === item.name ? null : item)
                    }
                  />
                ))}
              </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0">
              {!selectedItem ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <p className="text-gray-400 text-sm">왼쪽 목록에서 아이템을 선택하세요</p>
                  <p className="text-gray-600 text-xs">선택 시 30일 가격 · 판매량 차트를 확인할 수 있습니다</p>
                </div>
              ) : (
                <>
                  {/* 선택 아이템 헤더 */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
                    {selectedItem.icon && (
                      <img src={selectedItem.icon} alt={selectedItem.name}
                        className="w-10 h-10 rounded-lg border border-gray-700 object-cover" />
                    )}
                    <div>
                      <p className="text-base font-bold text-white">{selectedItem.name}</p>
                      {/* ✅ 가격 옆에 변동 뱃지 인라인 */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-amber-300 font-medium">
                          {formatGold(selectedItem.current_min_price)} G
                        </p>
                        <DiffBadge diff={selectedItem.diff} diffPct={selectedItem.diff_pct} />
                      </div>
                    </div>
                  </div>
                  <ChartPanel item={selectedItem} category={category} />
                </>
              )}
            </main>
          </>
        )}
      </div>
    </div>
  )
}
import { useState, useMemo, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { getMarketItems, getMarketHistory, getJewelItems } from '../../api/market'

/* ─────────────────────────────────────────────
   아이콘 상수
   ───────────────────────────────────────────── */
// 각인서: 드롭다운과 동일한 고정 아이콘
const ENGRAVING_ICON = 'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_9_25.png'

// 보석: 레벨·종류별 지정 아이콘
const GEM_ICON = {
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
  gem:       { label: '보석',      hasChart: false },
}

/* ─────────────────────────────────────────────
   정적 아이템 목록
   - 이름·아이콘은 즉시 표시 (API 대기 없음)
   - 가격은 API 응답 후 채워짐
   - gem : 순서 고정
   - engraving : 가격 로드 후 내림차순 재정렬
   ───────────────────────────────────────────── */
const STATIC_ITEMS = {

  /* ── 재련 재료 ───────────────────────────────── */
  refine: [
    // T4 파괴·수호석
    { name: '운명의 파괴석 결정' },
    { name: '운명의 파괴석' },
    { name: '운명의 수호석 결정' },
    { name: '운명의 수호석' },
    // T4 파편
    { name: '운명의 파편 주머니(소)' },
    { name: '운명의 파편 주머니(중)' },
    { name: '운명의 파편 주머니(대)' },
    // T4 돌파석
    { name: '운명의 돌파석' },
    { name: '위대한 운명의 돌파석' },
    // T4 융화재료
    { name: '상급 아비도스 융화 재료' },
    { name: '아비도스 융화 재료' },
    // T3 파괴·수호석
    { name: '정제된 파괴강석' },
    { name: '파괴강석' },
    { name: '파괴석 결정' },
    { name: '정제된 수호강석' },
    { name: '수호강석' },
    { name: '수호석 결정' },
    // T3 돌파석
    { name: '찬란한 명예의 돌파석' },
    { name: '경이로운 명예의 돌파석' },
    { name: '명예의 돌파석' },
    { name: '위대한 명예의 돌파석' },
    // T3 파편
    { name: '명예의 파편 주머니(소)' },
    { name: '명예의 파편 주머니(중)' },
    { name: '명예의 파편 주머니(대)' },
    // T3 융화재료
    { name: '최상급 오레하 융화 재료' },
    { name: '상급 오레하 융화 재료' },
    { name: '오레하 융화 재료' },
    // 강화 추가 재료
    { name: '강화 야금술 : 업화 [19-20]' },
    { name: '강화 재봉술 : 업화 [19-20]' },
    { name: '야금술 : 업화 [19-20]' },
    { name: '재봉술 : 업화 [19-20]' },
    { name: '장인의 야금술 : 4단계' },
    { name: '장인의 재봉술 : 4단계' },
    { name: '장인의 야금술 : 3단계' },
    { name: '장인의 재봉술 : 3단계' },
    { name: '장인의 야금술 : 1단계' },
    { name: '장인의 재봉술 : 1단계' },
    { name: '용암의 숨결' },
    { name: '빙하의 숨결' },
  ],

  /* ── 생활 재료 ───────────────────────────────── */
  life: [
    // 식물채집
    { name: '들꽃' },
    { name: '투박한 버섯' },
    { name: '야생초' },
    { name: '목화솜' },
    // 벌목
    { name: '목재' },
    { name: '두꺼운 나무' },
    { name: '특수목재' },
    // 채광
    { name: '철광석' },
    { name: '단단한 철광석' },
    { name: '표준 강석' },
    // 수렵
    { name: '두툼한 생고기' },
    { name: '철제 가죽' },
    // 낚시
    { name: '생선 살' },
    { name: '두툼한 생선 살' },
    // 고고학
    { name: '고대 유물' },
    { name: '희귀한 고대 유물' },
  ],

  /* ── 각인서 (유물 전투) ──────────────────────── */
  // 가격 로드 후 내림차순 재정렬 — 초기 순서는 의미 없음
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
  ],

  /* ── 보석 (고정 순서) ────────────────────────── */
  // 10~6 겁화 → 10~6 작열 → 10 멸화 → 10 홍염
  gem: [
    { name: '10레벨 겁화의 보석', icon: GEM_ICON['10레벨 겁화의 보석'] },
    { name: '9레벨 겁화의 보석',  icon: GEM_ICON['9레벨 겁화의 보석']  },
    { name: '8레벨 겁화의 보석',  icon: GEM_ICON['8레벨 겁화의 보석']  },
    { name: '7레벨 겁화의 보석',  icon: GEM_ICON['7레벨 겁화의 보석']  },
    { name: '6레벨 겁화의 보석',  icon: GEM_ICON['6레벨 겁화의 보석']  },
    { name: '10레벨 작열의 보석', icon: GEM_ICON['10레벨 작열의 보석'] },
    { name: '9레벨 작열의 보석',  icon: GEM_ICON['9레벨 작열의 보석']  },
    { name: '8레벨 작열의 보석',  icon: GEM_ICON['8레벨 작열의 보석']  },
    { name: '7레벨 작열의 보석',  icon: GEM_ICON['7레벨 작열의 보석']  },
    { name: '6레벨 작열의 보석',  icon: GEM_ICON['6레벨 작열의 보석']  },
    { name: '10레벨 멸화의 보석', icon: GEM_ICON['10레벨 멸화의 보석'] },
    { name: '10레벨 홍염의 보석', icon: GEM_ICON['10레벨 홍염의 보석'] },
  ],
}

/* ─────────────────────────────────────────────
   숫자 포맷 유틸
   ───────────────────────────────────────────── */
// ✅ 최적화: Intl.NumberFormat 인스턴스 재사용 — 매 호출마다 생성하지 않음
const numFmt = new Intl.NumberFormat('ko-KR')
const formatGold = (v) => (v == null ? '-' : numFmt.format(v))

/* ─────────────────────────────────────────────
   변동량 뱃지
   ───────────────────────────────────────────── */
function DiffBadge({ diff, diffPct }) {
  if (diff == null) return <span className="text-gray-600 text-xs">-</span>
  const up    = diff > 0
  const zero  = diff === 0
  const color = zero ? 'text-gray-400' : up ? 'text-emerald-400' : 'text-red-400'
  const arrow = zero ? '-' : up ? '▲' : '▼'
  const pct   = diffPct != null ? ` (${Math.abs(diffPct).toFixed(1)}%)` : ''
  return (
    <span className={`text-xs font-medium ${color} whitespace-nowrap`}>
      {arrow} {formatGold(Math.abs(diff))}{pct}
    </span>
  )
}

/* ─────────────────────────────────────────────
   사이드바 아이템 행
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
      {/* 아이콘: 정적 정의 아이콘은 즉시 표시, 없으면 placeholder */}
      {item.icon
        ? <img
            src={item.icon}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="w-9 h-9 rounded-lg flex-shrink-0 object-cover border border-gray-700"
          />
        : <div className="w-9 h-9 rounded-lg flex-shrink-0 bg-gray-800/80 border border-gray-700" />
      }

      {/* 이름 + 가격 + 변동 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate leading-tight">{item.name}</p>
        <p className={`text-sm font-bold mt-0.5 ${price != null ? 'text-amber-300' : 'text-gray-600'}`}>
          {formatGold(price)}
        </p>
        <DiffBadge diff={item.diff} diffPct={item.diff_pct} />
      </div>
    </button>
  )
})

/* ─────────────────────────────────────────────
   커스텀 Tooltip
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
   차트 패널
   ───────────────────────────────────────────── */
function ChartPanel({ item }) {
  const { data: history = [], isLoading } = useQuery({
    // ✅ 최적화: id+grade 조합 캐시 키 — 동일 아이템 재선택 시 재요청 없음
    queryKey: ['market-history', item.id, item.grade],
    queryFn:  () => getMarketHistory(item.id, item.grade),
    staleTime: 1000 * 60 * 5,
    enabled:   !!item.id,  // 가격 미로드(id=null)이면 요청 안 함
  })

  if (!item.id) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-gray-500 text-sm animate-pulse">가격 데이터 로딩 중...</p>
    </div>
  )
  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-gray-500 text-sm animate-pulse">히스토리 불러오는 중...</p>
    </div>
  )
  if (!history.length) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-gray-500 text-sm">히스토리 데이터가 없습니다.</p>
    </div>
  )

  // ✅ 최적화: useMemo — history 변경 시에만 재계산
  const chartData = useMemo(() =>
    [...history]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        date:   row.date.slice(5),  // MM-DD
        최저가: row.avg_price,
        판매량: row.trade_count,
      })),
  [history])

  return (
    <div className="flex-1 min-h-0 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
          />
          {/* 왼쪽 y축: 최저가 */}
          <YAxis
            yAxisId="gold"
            orientation="left"
            tick={{ fill: '#f59e0b', fontSize: 11 }}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
            tickLine={false}
            axisLine={false}
          />
          {/* 오른쪽 y축: 판매량 */}
          <YAxis
            yAxisId="trade"
            orientation="right"
            tick={{ fill: '#60a5fa', fontSize: 11 }}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
          {/* 막대: 판매량 */}
          <Bar yAxisId="trade" dataKey="판매량"
            fill="#3b82f6" fillOpacity={0.35}
            radius={[2, 2, 0, 0]} maxBarSize={20}
          />
          {/* 꺾은선: 최저가 */}
          <Line yAxisId="gold" type="monotone" dataKey="최저가"
            stroke="#f59e0b" strokeWidth={2}
            dot={false} activeDot={{ r: 4, fill: '#f59e0b' }}
          />
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
  const meta  = CATEGORY_META[category] ?? { label: category, hasChart: true }
  const isGem = category === 'gem'

  // ── 가격 데이터만 API에서 fetch ──────────────
  const { data: apiItems = [], isLoading: priceLoading, isError: priceError } = useQuery({
    queryKey: ['market-items', category],
    queryFn:  isGem ? getJewelItems : () => getMarketItems(category),
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,  // ✅ 최적화: 1분 백그라운드 갱신
  })

  // ✅ 최적화: O(1) 이름 기반 가격 조회용 맵 (배열 탐색 O(n) 대신)
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
    // refine·life·gem: 정적 목록 순서 유지
    return merged
  }, [category, priceMap])

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* 페이지 타이틀 */}
      <div className="px-6 pt-5 pb-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">{meta.label} 시세</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {isGem
              ? '경매장 기준 최저가 · 차트 미제공'
              : '거래소 기준 최저가 · 30일 히스토리 차트'}
          </p>
        </div>
        {/* 가격 로딩·오류 상태 — 목록은 항상 표시되므로 우측 상단 뱃지로만 표시 */}
        {priceLoading && (
          <span className="text-xs text-gray-500 animate-pulse">가격 불러오는 중...</span>
        )}
        {priceError && !priceLoading && (
          <span className="text-xs text-red-400">가격 조회 실패 · 잠시 후 재시도</span>
        )}
      </div>

      {/* 본문: 사이드바 + 메인 패널 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── 사이드바 ─────────────────────────── */}
        <aside className="w-72 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
          {/* ✅ 목록은 API와 무관하게 즉시 표시 */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5
            scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700">
            {displayItems.map((item) => (
              <ItemRow
                key={item.name}
                item={item}
                selected={selectedItem?.name === item.name}
                onClick={() =>
                  setSelectedItem(prev =>
                    prev?.name === item.name ? null : item
                  )
                }
              />
            ))}
          </div>
        </aside>

        {/* ── 메인 패널 ─────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0">
          {!selectedItem ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <p className="text-gray-400 text-sm">왼쪽 목록에서 아이템을 선택하세요</p>
              {!isGem && (
                <p className="text-gray-600 text-xs">
                  선택 시 30일 가격 · 판매량 차트를 확인할 수 있습니다
                </p>
              )}
            </div>
          ) : (
            <>
              {/* 선택 아이템 헤더 */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
                {selectedItem.icon && (
                  <img
                    src={selectedItem.icon}
                    alt={selectedItem.name}
                    className="w-10 h-10 rounded-lg border border-gray-700 object-cover"
                  />
                )}
                <div>
                  <p className="text-base font-bold text-white">{selectedItem.name}</p>
                  <p className="text-sm text-amber-300 font-medium mt-0.5">
                    {formatGold(selectedItem.current_min_price)} G
                  </p>
                </div>
                <div className="ml-auto">
                  <DiffBadge diff={selectedItem.diff} diffPct={selectedItem.diff_pct} />
                </div>
              </div>

              {/* 차트 or 미제공 안내 */}
              {meta.hasChart
                ? <ChartPanel item={selectedItem} />
                : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <p className="text-gray-400 text-sm">보석은 경매장 거래 특성상</p>
                    <p className="text-gray-400 text-sm">가격 히스토리 차트를 제공하지 않습니다</p>
                  </div>
                )
              }
            </>
          )}
        </main>
      </div>
    </div>
  )
}
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { getMarketItems, getMarketHistory, getJewelItems } from '../../api/market'

/* ─────────────────────────────────────────────
   상수
   ───────────────────────────────────────────── */
const CATEGORY_META = {
  refine:    { label: '재련 재료',  hasChart: true  },
  life:      { label: '생활 재료',  hasChart: true  },
  engraving: { label: '각인서',     hasChart: true  },
  jewel:       { label: '보석',       hasChart: false },
}

// ✅ 각인서: 드롭다운과 동일한 고정 아이콘 (API 개별 아이콘 대신 사용)
const ENGRAVING_ICON = 'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_9_25.png'

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
  if (diff == null) return <span className="text-gray-500 text-xs">-</span>
  const up   = diff > 0
  const zero = diff === 0
  const color = zero ? 'text-gray-400' : up ? 'text-emerald-400' : 'text-red-400'
  const arrow = zero ? '-' : up ? '▲' : '▼'
  const abs   = Math.abs(diff)
  const pct   = diffPct != null ? `(${Math.abs(diffPct).toFixed(1)}%)` : ''
  return (
    <span className={`text-xs font-medium ${color} whitespace-nowrap`}>
      {arrow} {formatGold(abs)} {pct}
    </span>
  )
}

/* ─────────────────────────────────────────────
   사이드바 아이템 행
   ───────────────────────────────────────────── */
// ✅ 최적화: React.memo — 선택 상태가 바뀐 항목만 리렌더
import { memo } from 'react'
const ItemRow = memo(function ItemRow({ item, selected, onClick }) {
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
      {/* 아이콘 */}
      {item.icon
        ? <img
            src={item.icon}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="w-9 h-9 rounded-lg flex-shrink-0 object-cover border border-gray-700"
          />
        : <div className="w-9 h-9 rounded-lg flex-shrink-0 bg-gray-800" />
      }

      {/* 이름 + 가격 + 변동 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate leading-tight">{item.name}</p>
        <p className="text-sm font-bold text-amber-300 mt-0.5">{formatGold(item.current_min_price ?? item.buy_price)}</p>
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
    // ✅ 최적화: item.id + item.grade 조합으로 캐시 키 설정 → 동일 아이템 재선택 시 캐시 재사용
    queryKey: ['market-history', item.id, item.grade],
    queryFn: () => getMarketHistory(item.id, item.grade),
    staleTime: 1000 * 60 * 5,  // 5분 캐시
    enabled: !!item.id,
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm animate-pulse">히스토리 불러오는 중...</p>
      </div>
    )
  }
  if (!history.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">히스토리 데이터가 없습니다.</p>
      </div>
    )
  }

  // ✅ 최적화: 날짜 역순 정렬은 useMemo로 메모이제이션
  const chartData = useMemo(() =>
    [...history].sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({
      date:   row.date.slice(5),       // MM-DD 만 표시
      최저가: row.avg_price,
      판매량: row.trade_count,
    })),
  [history])

  return (
    <div className="flex-1 min-h-0 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

          {/* x축: 날짜 */}
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
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
            tickLine={false}
            axisLine={false}
          />

          {/* 오른쪽 y축: 판매량 */}
          <YAxis
            yAxisId="trade"
            orientation="right"
            tick={{ fill: '#60a5fa', fontSize: 11 }}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#9ca3af' }}
          />

          {/* 막대: 판매량 */}
          <Bar
            yAxisId="trade"
            dataKey="판매량"
            fill="#3b82f6"
            fillOpacity={0.35}
            radius={[2, 2, 0, 0]}
            maxBarSize={20}
          />

          {/* 꺾은선: 최저가 */}
          <Line
            yAxisId="gold"
            type="monotone"
            dataKey="최저가"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#f59e0b' }}
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
  const meta = CATEGORY_META[category] ?? { label: category, hasChart: true }

  // ✅ 최적화: category 변경 시 선택 아이템 초기화 (useCallback 불필요 — category prop 변경 감지)
  const handleCategoryChange = useCallback(() => setSelectedItem(null), [])

  // ── 데이터 fetch ──
  // jewel 카테고리는 별도 API 사용
  const isJewel = category === 'jewel'

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['market-items', category],
    queryFn: isJewel ? getJewelItems : () => getMarketItems(category),
    staleTime: 1000 * 60,   // 1분 캐시
    refetchInterval: 1000 * 60,  // ✅ 최적화: 1분 자동 갱신 (백그라운드 폴링)
  })

  // ── 렌더 ──
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* 페이지 타이틀 */}
      <div className="px-6 pt-5 pb-3 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">{meta.label} 시세</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {isJewel
            ? '경매장 기준 최저가 · 차트 미제공'
            : '거래소 기준 최저가 · 30일 히스토리 차트'}
        </p>
      </div>

      {/* 본문: 사이드바 + 메인 패널 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── 사이드바 ─────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">

          {/* 로딩 */}
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500 text-sm animate-pulse">불러오는 중...</p>
            </div>
          )}

          {/* 에러 */}
          {isError && (
            <div className="flex-1 flex items-center justify-center px-4">
              <p className="text-red-400 text-sm text-center">
                시세 정보를 불러오지 못했습니다.<br />잠시 후 다시 시도해주세요.
              </p>
            </div>
          )}

          {/* 목록 */}
          {!isLoading && !isError && (
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5
              scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700">
              {items.map((item) => {
                const key = item.id ?? item.name
                // ✅ 각인서는 고정 아이콘으로 오버라이드
                const resolved = category === 'engraving'
                  ? { ...item, icon: ENGRAVING_ICON }
                  : item
                return (
                  <ItemRow
                    key={key}
                    item={resolved}
                    selected={selectedItem?.name === item.name}
                    onClick={() => {
                      setSelectedItem((prev) =>
                        prev?.name === item.name ? null : resolved
                      )
                    }}
                  />
                )
              })}
            </div>
          )}
        </aside>

        {/* ── 메인 패널 ─────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0">

          {/* 아이템 미선택 */}
          {!selectedItem && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <p className="text-gray-400 text-sm">왼쪽 목록에서 아이템을 선택하세요</p>
              {!isJewel && (
                <p className="text-gray-600 text-xs">선택 시 30일 가격 · 판매량 차트를 확인할 수 있습니다</p>
              )}
            </div>
          )}

          {/* 아이템 선택됨 */}
          {selectedItem && (
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
                    {formatGold(selectedItem.current_min_price ?? selectedItem.buy_price)} G
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
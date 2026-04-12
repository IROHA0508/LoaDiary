import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useState, useCallback, useRef } from 'react'

// 일반 네비게이션 아이템 (시세 제외)
const NAV_ITEMS = [
  { label: '랭킹', path: '/ranking' },
]

// 시세 드롭다운 설정
const MARKET_DROPDOWN = {
  label: '시세',
  basePath: '/market',
  items: [
    {
      label: '재련 재료',
      path: '/market/refine',
      icon: 'https://static.lo4.app/icons/breath.png',
    },
    {
      label: '생활 재료',
      path: '/market/life',
      icon: 'https://cdn-lostark.game.onstove.com/efui_iconatlas/lifelevel/lifelevel_02_48.png',
    },
    {
      label: '각인서',
      path: '/market/engraving',
      icon: 'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_9_25.png',
    },
    {
      label: '보석',
      path: '/market/gem',
      icon: 'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_13_55.png',
    },
  ],
}

const CALC_DROPDOWN = {
  label: '계산기',
  basePath: '/calc',
  items: [
    {
      label: '일반 재련',
      path: '/calc/refine-normal',
      // ✅ public/ 폴더 정적 서빙 → 번들 포함 없이 브라우저 캐시 최적화
      icon: '/images/icon-refine-normal.png',
    },
    {
      label: '상급 재련',
      path: '/calc/refine-advanced',
      icon: '/images/icon-refine-advanced.png',
    },
    {
      label: '경매 계산기',
      path: '/calc/auction',
      icon: '/images/icon-auction.png',
    },
    {
      label: '더보기 계산기',
      path: '/calc/more',
      icon: '/images/icon-more-calc.svg',
    },
    {
      label: '제작 계산기',
      path: '/calc/craft',
      icon: 'https://cdn-lostark.game.onstove.com/EFUI_IconAtlas/LifeLevel/LifeLevel_01_123.png',
    },
    {
      label: '카드 계산기',
      path: '/calc/card',
      icon: 'https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_10_234.png',
    },
  ],
}
// ── 공통 드롭다운 버튼 컴포넌트 ───────────────────────────────
// ✅ 최적화: 컴포넌트 분리 → 각 드롭다운이 독립적으로 리렌더됨
//            부모(Layout) 상태 변경 시 다른 드롭다운에 영향 없음
function DropdownNav({ config, currentPath, onNavigate }) {
  const [open, setOpen] = useState(false)
  // ✅ 최적화: useRef로 타이머 참조 보관 → 빠른 마우스 이동 시 깜빡임 방지
  const leaveTimer = useRef(null)

  const isActive = currentPath.startsWith(config.basePath)

  const handleEnter = useCallback(() => {
    clearTimeout(leaveTimer.current)
    setOpen(true)
  }, [])

  // ✅ 최적화: 50ms 딜레이 → 드롭다운과 버튼 사이 작은 갭을 통과할 때 닫히지 않음
  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setOpen(false), 50)
  }, [])

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* 트리거 버튼 */}
      <button
        className={`px-4 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1
          ${isActive
            ? 'text-white bg-gray-800'
            : 'text-gray-300 hover:text-white hover:bg-gray-800'
          }`}
      >
        {config.label}
        {/* ✅ 최적화: CSS transform → GPU 합성 레이어 처리, 리페인트 없음 */}
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        >
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {/* 드롭다운 패널
          ✅ 최적화: visibility + opacity + translateY 조합
          - display:none → 레이아웃 리플로우 발생
          - visibility:hidden + opacity:0 → GPU 합성에서만 처리, 리플로우 없음
          - pointerEvents:none → 숨김 상태에서 클릭 이벤트 차단                */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          minWidth: 168,
          background: '#111827',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '6px 0',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0)' : 'translateY(-6px)',
          visibility: open ? 'visible' : 'hidden',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.18s ease, transform 0.18s ease, visibility 0.18s',
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        {config.items.map((item) => {
          const isItemActive = currentPath === item.path
          return (
            <button
              key={item.path}
              onClick={() => { onNavigate(item.path); setOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 16px',
                background: isItemActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isItemActive ? '#fff' : '#d1d5db',
                fontSize: 14,
                textAlign: 'left',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
              onMouseLeave={e => { e.currentTarget.style.background = isItemActive ? 'rgba(255,255,255,0.07)' : 'transparent' }}
            >
              {/* 아이콘: customIcon(SVG컴포넌트) 우선, 없으면 img */}
              {item.CustomIcon
                // ✅ 렌더 시점에 새 엘리먼트 생성 → React reconciliation 정상 동작
                ? <item.CustomIcon />
                : (
                  <img
                    src={item.icon}
                    alt={item.label}
                    loading="lazy"
                    width={24}
                    height={24}
                    style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
                  />
                )
              }
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Layout 본체 ───────────────────────────────────────────────
export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 h-12 flex items-center relative sticky top-0 z-50 bg-gray-950">

        <h1
          className="absolute left-8 text-base font-bold cursor-pointer shrink-0 whitespace-nowrap z-10"
          onClick={() => navigate('/')}
        >
          ⚔️ 로아 일기 ⚔️
        </h1>

        <div className="max-w-[1400px] mx-auto px-8 w-full flex items-center gap-5">

          <nav className="flex-1 flex items-center gap-1">

            {/* 랭킹 — 드롭다운 없음 */}
            <button
              onClick={() => navigate('/ranking')}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors
                ${location.pathname === '/ranking'
                  ? 'text-white bg-gray-800'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
            >
              랭킹
            </button>

            {/* 시세 드롭다운 */}
            <DropdownNav
              config={MARKET_DROPDOWN}
              currentPath={location.pathname}
              onNavigate={navigate}
            />

            {/* 계산기 드롭다운 */}
            <DropdownNav
              config={CALC_DROPDOWN}
              currentPath={location.pathname}
              onNavigate={navigate}
            />

          </nav>

          {/* 검색 — 변경 없음 */}
          <div className="w-[300px] flex items-center bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <input
              type="text"
              placeholder="캐릭터 검색"
              className="bg-transparent px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none flex-1 min-w-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  navigate(`/characters/${encodeURIComponent(e.target.value.trim())}`)
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = e.currentTarget.previousSibling
                if (input.value.trim()) {
                  navigate(`/characters/${encodeURIComponent(input.value.trim())}`)
                }
              }}
              className="px-2.5 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              🔍
            </button>
          </div>

        </div>
      </header>

      <Outlet />
    </div>
  )
}
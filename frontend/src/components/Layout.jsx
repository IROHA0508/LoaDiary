import { useNavigate, useLocation, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { label: '랭킹', path: '/ranking' },
  { label: '시세', path: '/market' },
  { label: '계산기', path: '/calc' },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── 공통 헤더 ─────────────────────────────────────────────────
           구조: 로고(absolute left-8) + max-w-[1400px] 컨테이너(nav + 검색)
           nav(flex-1) / 검색(w-[300px]) → 바디 main/aside 너비와 동일
         ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 h-12 flex items-center relative sticky top-0 z-50 bg-gray-950">

        {/* 로고 - 페이지 맨 왼쪽 고정 */}
        <h1
          className="absolute left-8 text-base font-bold cursor-pointer shrink-0 whitespace-nowrap z-10"
          onClick={() => navigate('/')}
        >
          ⚔️ 로아 일기 ⚔️
        </h1>

        {/* 헤더 내부 — 바디와 동일한 max-w-[1400px] px-8 flex gap-5 */}
        <div className="max-w-[1400px] mx-auto px-8 w-full flex items-center gap-5">

          {/* nav: flex-1 → 메인 영역과 너비 일치 */}
          <nav className="flex-1 flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors
                  ${location.pathname === item.path
                    ? 'text-white bg-gray-800'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* 검색: w-[300px] → 사이드바 너비와 일치 */}
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

      {/* 페이지 콘텐츠 */}
      <Outlet />

    </div>
  )
}
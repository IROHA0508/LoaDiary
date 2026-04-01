// 최적화를 위한 lazy import
import { lazy, Suspense } from 'react'

import { useEffect } from 'react'
// BrowserRouter : 전체 앱을 감싸는 라우터 컨테이너, URL 변경을 감지해서 맞는 페이지를 보여줌
// Routes : Route들을 감싸는 컨테이너
// Route : URL 경로와 컴포넌트를 연결
// Navigate : 특정 경로로 강제 이동시키는 컴포넌트
// useNavigate : 코드에서 페이지 이동할 때 쓰는 훅
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'

// QueryClient : TanStack Query의 캐시와 설정을 관리하는 객체
// QueryClientProvider : 앱 전체에서 useQuery를 쓸 수 있게 감싸주는 컴포넌트. Python의 전역 설정 객체와 비슷한 개념
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUser } from './hooks/useUser'
import { getUser } from './api/users'

// export default로 내보낸 컴포넌트는 중괄호 없이 import 가능
import Layout from './components/Layout'

// useLocation 추가 import
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'

// AppRoutes 컴포넌트 내부
const location = useLocation()

// 모든 페이지를 lazy import로 전환
const OnboardingPage     = lazy(() => import('./pages/OnboardingPage'))
const MainPage           = lazy(() => import('./pages/MainPage'))
const RaidNewPage        = lazy(() => import('./pages/raids/RaidNewPage'))
const RaidDetailPage     = lazy(() => import('./pages/raids/RaidDetailPage'))
const RankingPage        = lazy(() => import('./pages/features/RankingPage'))
const MarketPage         = lazy(() => import('./pages/features/MarketPage'))
const MerchantPage       = lazy(() => import('./pages/features/MerchantPage'))
const CharacterDetailPage = lazy(() => import('./pages/CharacterDetailPage'))

// QueryClient 인스턴스 생성 + 최적화
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,        // 30초 내 재요청 없음 (탭 전환 방지)
      gcTime: 1000 * 60 * 5,       // 5분간 캐시 유지
      retry: 1,                     // 실패 시 1회만 재시도 (기본 3회)
      refetchOnWindowFocus: false,  // 탭 복귀 시 자동 재요청 끄기
    },
  },
})

// 라우트 가드 역할 컴포넌트
function AppRoutes(){
  const {fingerprint, loading} = useUser()
  const navigate = useNavigate()


  useEffect(() => {
    if (loading || !fingerprint) return
    // 이미 온보딩 페이지에 있으면 체크 불필요
    if (location.pathname === '/onboarding') return

    const checkUser = async () => {
      try {
        await getUser(fingerprint)
      } catch(e) {
        if (e?.response?.status === 404) {
          navigate('/onboarding')
        }
      }
    }
    checkUser()
  }, [fingerprint, loading, navigate, location.pathname])

  // fingerprint 준비중일 때 로딩 화면 표시
  if (loading){
    return(
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  return (
    // 최적화를 위한 Suspense로 감싸기
    <Suspense fallback = {
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500">로딩 중...</p>
    </div>
    }>
      <Routes>
        {/* path="/onboarding" : /onboarding URL일 때 OnboardingPage 표시 */}
        <Route path="/onboarding" element={<OnboardingPage />} />
        
        {/* 나머지 모든 페이지는 Layout(공통 헤더) 안에서 렌더링 */}
        <Route path="/" element={<Layout />}>
          {/* path="/" : 메인 URL일 때 MainPage 컴포넌트 표시 */}
          <Route index element={<MainPage />} />

          <Route path="raids/new" element={<RaidNewPage />} />

          {/* path="/raids/:id" : 레이드 상세 및 파티 배치 페이지 */}
          <Route path="raids/:id" element={<RaidDetailPage />} />

          {/* 헤더에 있는 랭킹, 거래소, 떠돌이 상인 페이지 */}
          <Route path="ranking" element={<RankingPage />} />
          <Route path="market" element={<MarketPage />} />
          <Route path="merchants" element={<MerchantPage />} />

          {/* 캐릭터 상세 페이지  */}
          <Route path="characters/:name" element={<CharacterDetailPage />} />
        </Route>

        {/* path="*" : 위에서 매칭되지 않은 모든 URL (ex. /asdfgh) */}
        {/* Navigate to="/" : 메인 페이지로 리다이렉트 */}
        {/* replace : 뒤로가기 시 잘못된 URL로 돌아가지 않도록 히스토리 교체 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  // 앱 전체를 QueryClientProvider로 감싸야 useQuery 사용 가능
  return (
    <QueryClientProvider client={queryClient}>

      {/* 앱 전체를 BrowserRouter로 감싸야 useNavigate, Route 사용 가능 */}
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
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
import OnboardingPage from './pages/OnboardingPage'
import MainPage from './pages/MainPage'
import RaidNewPage from './pages/raids/RaidNewPage'
import RaidDetailPage from './pages/raids/RaidDetailPage'
import RankingPage from './pages/features/RankingPage'
import MarketPage from './pages/features/MarketPage'
import MerchantPage from './pages/features/MerchantPage'

// QueryClient 인스턴스 생성
const queryClient = new QueryClient()

// 라우트 가드 역할 컴포넌트
function AppRoutes(){
  const {fingerprint, loading} = useUser()
  const navigate = useNavigate()


  // fingerprint, loading 값이 바뀔 때 마다 실행
  useEffect(() => {
    // fingerprint가 없으면 아무것도 안함
    if (loading || !fingerprint) return

    const checkUser = async () => {
      // 유저가 있으면 현재 페이지 유지
      try{
        await getUser(fingerprint)
      } 
      // 유저가 없으면 온보딩 페이지로 이동 (404 에러 발생)      
      catch{
        navigate('/onboarding')
      }
    }

    checkUser()
  }, [fingerprint, loading])

  // fingerprint 준비중일 때 로딩 화면 표시
  if (loading){
    return(
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  return (
    <Routes>
      {/* path="/onboarding" : /onboarding URL일 때 OnboardingPage 표시 */}
      <Route path="/onboarding" element={<OnboardingPage />} />
      
      {/* 나머지 모든 페이지는 Layout(공통 헤더) 안에서 렌더링 */}
      <Route element={<Layout />}>
        {/* path="/" : 메인 URL일 때 MainPage 컴포넌트 표시 */}
        <Route path="/" element={<MainPage />} />

        <Route path="/raids/new" element={<RaidNewPage />} />

        {/* path="/raids/:id" : 레이드 상세 및 파티 배치 페이지 */}
        <Route path="/raids/:id" element={<RaidDetailPage />} />

        {/* 헤더에 있는 랭킹, 거래소, 떠돌이 상인 페이지 */}
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/merchants" element={<MerchantPage />} />
      </Route>

      {/* path="*" : 위에서 매칭되지 않은 모든 URL (ex. /asdfgh) */}
      {/* Navigate to="/" : 메인 페이지로 리다이렉트 */}
      {/* replace : 뒤로가기 시 잘못된 URL로 돌아가지 않도록 히스토리 교체 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
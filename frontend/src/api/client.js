import axios from 'axios'

// axios 인스턴스 생성
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 500000,  // 500초 타임아웃 (무한 대기 방지)
  headers: {
    'Content-Type': 'application/json',
  },
})

// LoA 외부 API를 거치는 느린 요청 전용 인스턴스
// sync, sync-all, armory 등 외부 API 의존 엔드포인트에 사용
export const slowClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 800000, // 800초 (캐릭터 20개 기준 여유 있게)
  headers: { 'Content-Type': 'application/json' },
})


// 응답 인터셉터: 에러를 일관되게 처리
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ECONNABORTED') {
      console.warn('API 타임아웃:', err.config?.url)
    }
    return Promise.reject(err)
  }
)

export default client
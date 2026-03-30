import axios from 'axios'

// axios 인스턴스 생성
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 10000,  // 10초 타임아웃 (무한 대기 방지)
  headers: {
    'Content-Type': 'application/json',
  },
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
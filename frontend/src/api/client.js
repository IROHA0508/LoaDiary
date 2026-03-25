import axios from 'axios'

// axios 인스턴스 생성
const client = axios.create({
  baseURL : import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
})

export default client
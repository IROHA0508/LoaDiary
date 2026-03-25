import {useState, useEffect} from 'react'
import FingerprintJS from '@fingerprintjs/fingerprintjs'

// localStorage에 저장할 때 쓸 키 이름
const STORAGE_KEY = 'loadiary_fingerprint'

export const useUser = () => {
  // fingerprint : 현재 값
  // setFingerprint : 값을 바꾸는 함수
  // useState(null) : fingerprint 의 초기값
  const [fingerprint, setFingerprint] = useState(null)

  // fingerprint를 아직 불러오는 중인지 나타내는 상태
  // 초기값 true
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved){
        setFingerprint(saved)
        setLoading(false)
        return
      }

      // localStorage에 없으면 FingerprintJS로 새로 생성
      // fingerprintJS 라이브러리 초기화
      const fp = await FingerprintJS.load()

      // 브라우저 정보를 분석해서 고유 ID 생성
      const result = await fp.get()

      // 생성된 ID를 localStorage에 저장
      localStorage.setItem(STORAGE_KEY, result.visitorId)

      setFingerprint(result.visitorId)
      setLoading(false)
    }

    init()
  },[])

  // 훅을 사용하는 컴포넌트에서 fingerprint와 loading을 쓸 수 있게 반환
  return {fingerprint, loading}
}
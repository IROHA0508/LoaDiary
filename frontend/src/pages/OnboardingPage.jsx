import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {createOrGetUser} from '../api/users'
import { syncCharacters } from '../api/characters'
import {useUser} from '../hooks/useUser'

export default function OnboardingPage(){
  // useUser 훅에서 fingerprint만 사용
  const {fingerprint} = useUser()
  const navigate = useNavigate()
  
  // 입력창에 입력한 캐릭터명을 저장하는 상태 : 초기값 '' 빈 문자열
  const [representative, setRepresentative] = useState('')

  // API 호출 중인지 나타내는 상태
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  // 에러 메시지를 저장하는 상태
  const [error, setError] = useState(null)

  // 폼 제출시 실행되는 함수
  // e : 이벤트 객체
  const handleSubmit = async(e) => {
    // 브라우저 페이지 새로고침 막음
    e.preventDefault()

    // fingerprint가 없거나 입력값이 공백이면 실행 중단
    if (!fingerprint || !representative.trim()) return

    // API 호출 전 로딩 상태로 변경, 기존 에러 초기화
    setLoading(true)
    setError(null)
    
    try{
      // 유저 생성 및 기존 유저 조회
      setLoadingMsg('유저 정보 확인 중...')
      await createOrGetUser(fingerprint, representative.trim())
    } catch (err) {
      setError('서비스 오류가 발생했어요. 잠시 후 다시 시도해주세요.')
      setLoading(false)
      return
    }

    try{
      // 로스트아크 API 호출 이후 캐릭터 동기화
      setLoadingMsg('캐릭터 목록 불러오는 중...')  // ← 가장 오래 걸리는 구간
      await syncCharacters(fingerprint, representative.trim())
    } catch (err){
      setError('캐릭터를 찾을 수 없어요. 캐릭터명을 다시 확인해주세요.')
      console.warn('캐릭터 동기화 실패 (메인에서 재시도 가능):', err.message)
    } 
    finally {
      setLoading(false)
      setLoadingMsg('')
      navigate('/')
    }
  }

  return (
    // 화면에 그릴 JSX
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      {/* Tailwind 클래스들 : min-h-screen(최소높이 100vh), bg-gray-950(배경색), flex(플렉스박스) */}

      {/* max-w-md : 최대 너비 제한 (가운데 정렬된 카드 형태) */}
      <div className="w-full max-w-md">

        {/* 로고 영역 */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">⚔️ 로아 일기 ⚔️</h1>
          <p className="text-gray-400">로스트아크 레이드 관리 서비스</p>
        </div>

        {/* 입력 카드 */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-1">시작하기</h2>
          <p className="text-gray-400 text-sm mb-6">
            대표 캐릭터명을 입력하면 보유 캐릭터를 자동으로 불러와요.
          </p>

          {/* onSubmit : 폼 제출 시 handleSubmit 함수 실행 */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm text-gray-400 mb-1">대표 캐릭터명</label>
              <input
                type="text"
                // value : 입력창의 현재 값을 representative 상태와 연결
                value={representative}
                // onChange : 타이핑할 때마다 실행
                // e.target.value : 입력창에 타이핑한 값
                onChange={(e) => setRepresentative(e.target.value)}
                placeholder="대표 캐릭터명 입력"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-600"
              />
            </div>

            {/* {error && (...)} : error가 null이 아닐 때만 이 요소를 화면에 표시 */}
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              // disabled : 로딩 중이거나 입력값이 없으면 버튼 비활성화
              disabled={loading || !representative.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {/* 삼항연산자 : loading이 true면 '처리 중...', false면 '시작하기' */}
              {loading ? loadingMsg || '처리 중...' : '시작하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCharacters } from '../api/characters'
import { getMyRaids } from '../api/raids'
import { useUser } from '../hooks/useUser'

export default function MainPage() {
  const { fingerprint } = useUser()
  const navigate = useNavigate()

  // useQuery 결과 호출
  // data를 characters 라는 이름으로 가져오고 없으면 기본값으로 []으로 지정
  // isLoading을 charLoading 이라는 이름으로 꺼냄
  const { data: characters = [], isLoading: charLoading } = useQuery({

    // queryKey : 이 쿼리의 고유 식별자 (캐시 키)
    // fingerprint가 바뀌면 자동으로 API를 다시 호출함
    queryKey: ['characters', fingerprint],

    // queryFn : 실제로 실행할 API 호출 함수
    queryFn: () => getCharacters(fingerprint),

    // enabled : false면 API 호출 안 함
    // !!fingerprint : fingerprint가 null이면 false, 값이 있으면 true
    // fingerprint가 준비되기 전엔 API 호출하지 않기 위해 사용
    enabled: !!fingerprint,
  })

  const { data: raids = [], isLoading: raidLoading } = useQuery({
    queryKey: ['raids', fingerprint],
    queryFn: () => getMyRaids(fingerprint),
    enabled: !!fingerprint,
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* 헤더 */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">⚔️ 로아 일기 ⚔️</h1>
        <button
          onClick={() => navigate('/raids/new')}
          // onClick : 버튼 클릭 시 실행
          className="bg-blue-600 hover:bg-blue-500 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + 레이드 생성
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* 내 캐릭터 섹션 */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-200">내 캐릭터</h2>

          {charLoading ? (
            <p className="text-gray-500">불러오는 중...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* grid : CSS 그리드 레이아웃 */}
              {/* grid-cols-2 : 기본 2열, md(중간화면) 3열, lg(큰화면) 4열 */}

              {characters.map((char) => (
                // .map() : 배열을 순회하며 JSX로 변환
                
                <div key={char.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors">
                {/* key : React가 각 항목을 구분하기 위한 고유값, 반드시 필요 */}

                  {/* truncate : 글자가 넘치면 ... 으로 자름 */}
                  <p className="font-semibold text-white truncate">{char.name}</p>
                  <p className="text-sm text-gray-400 mt-1">{char.class_name}</p>
                  {/* ?. : 옵셔널 체이닝 - item_level이 null이면 오류 대신 undefined 반환 */}
                  {/* .toLocaleString() : 숫자에 쉼표 추가 ex) 1620 → 1,620 */}
                  <p className="text-sm text-blue-400 mt-2">Lv. {char.item_level?.toLocaleString()}</p>
                  {char.combat_power && (
                    <p className="text-xs text-gray-500 mt-1">전투력 {char.combat_power?.toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 내 레이드 섹션 */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-200">내 레이드</h2>

          {raidLoading ? (
            <p className="text-gray-500">불러오는 중...</p>
          ) : raids.length === 0 ? (
            // 삼항연산자 중첩 : 로딩중? → 레이드 없음? → 레이드 목록 표시

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-500">아직 생성한 레이드가 없어요.</p>
              <button
                onClick={() => navigate('/raids/new')}
                className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
              >
                첫 레이드 만들기 →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {raids.map((raid) => (
                <div key={raid.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-gray-600 transition-colors cursor-pointer">
                  <div>
                    <p className="font-semibold">{raid.raid_name}</p>
                    <p className="text-sm text-gray-400 mt-1">{raid.difficulty} · 최대 {raid.max_slots}명</p>
                  </div>
                  <span className="text-gray-500 text-sm">
                    {new Date(raid.created_at).toLocaleDateString('ko-KR')}
                    {/* new Date() : 날짜 문자열을 날짜 객체로 변환 */}
                    {/* .toLocaleDateString('ko-KR') : 한국 형식으로 변환 ex) 2026. 3. 25. */}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
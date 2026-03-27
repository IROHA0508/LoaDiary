import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCharacters } from '../api/characters'
import { getMyRaids, getJoinedRaids, deleteRaid } from '../api/raids'
import { useUser } from '../hooks/useUser'

export default function MainPage() {
  const { fingerprint } = useUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // 삭제 확인 모달용 상태 - 어떤 레이드를 삭제할지 저장
  // null이면 모달 닫힘, raid 객체가 들어오면 모달 열림
  const [raidToDelete, setRaidToDelete] = useState(null)

  const { data: characters = [], isLoading: charLoading } = useQuery({
    queryKey: ['characters', fingerprint],
    queryFn: () => getCharacters(fingerprint),
    enabled: !!fingerprint,
  })

  // 내가 만든 레이드
  const { data: myRaids = [], isLoading: myRaidsLoading } = useQuery({
    queryKey : ['myRaids', fingerprint],
    queryFn : () => getMyRaids(fingerprint),
    enabled : !!fingerprint, 
  })

  // 내가 참여한 레이드
  const { data: joinedRaids = [], isLoading: joinedRaidsLoading } = useQuery({
    queryKey : ['joinedRaids', fingerprint],
    queryFn : () => getJoinedRaids(fingerprint),
    enabled : !!fingerprint, 
  })

  // 둘 중 하다라도 로딩 중이면 로딩 표시
  const raidLoading = myRaidsLoading || joinedRaidsLoading
  
  // 중복 제거 후 합치기
  const raids = [
    ...myRaids,
    ...joinedRaids.filter(jr => !myRaids.some(mr => mr.id === jr.id))
  ]

  // useMutation : 데이터를 변경하는 API 호출 (삭제, 생성, 수정 등)
  // useQuery는 데이터를 읽기만 하지만, useMutation은 서버 상태를 바꿀 때 사용
  const deleteMutation = useMutation({
    mutationFn: (raidId) => deleteRaid(raidId),

    // onSuccess : API 호출이 성공했을 때 실행
    onSuccess: () => {
      // invalidateQueries : 해당 쿼리의 캐시를 무효화해서 목록을 다시 불러옴
      queryClient.invalidateQueries({ queryKey: ['myRaids', fingerprint] })
      queryClient.invalidateQueries({ queryKey: ['joinedRaids', fingerprint] })
      setRaidToDelete(null)
    },
  })

  // 헤더 네비게이션 메뉴 목록
  // label : 화면에 표시할 텍스트, path : navigate할 경로
  const navItems = [
    { label: '랭킹', path: '/ranking' },
    { label: '거래소', path: '/market' },
    { label: '떠돌이 상인', path: '/merchants' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 헤더 */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-8">
        {/* 로고 */}
        <h1
          className="absolute left-6 text-xl font-bold cursor-pointer shrink-0"
          onClick={() => navigate('/')}
          // shrink-0 : flex 컨테이너 안에서 이 요소는 줄어들지 않도록 고정
          >
          ⚔️ 로아 일기 ⚔️
        </h1>

        <div className = "max-w-5xl mx-auto w-full px-6 flex items-center">
          {/* 네비게이션 메뉴 - 랭킹, 거래소, 떠돌이 상인 */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="px-4 py-2 text-base font-semibold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* 캐릭터 검색 - ml-auto로 오른쪽으로 밀어냄 */}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              {/* overflow-hidden : 자식 요소가 둥근 모서리 밖으로 삐져나오지 않도록 */}
              <input
                type="text"
                placeholder="캐릭터 검색"
                className="bg-transparent px-4 py-2 text-sm text-white placeholder-gray-500 outline-none w-44"
                // outline-none : 클릭해도 파란 테두리가 생기지 않도록
                onKeyDown={(e) => {
                  // Enter 키를 누르면 검색 페이지로 이동
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`)
                    // encodeURIComponent : URL에 사용할 수 없는 특수문자를 인코딩
                    // ex) "달루나르" → "%EB%8B%AC%EB%A3%A8%EB%82%98%EB%A5%B4"
                  }
                }}
              />
              <button
                onClick={(e) => {
                  // 인풋 값을 가져오기 위해 부모 요소를 통해 input을 찾음
                  const input = e.currentTarget.previousSibling
                  if (input.value.trim()) {
                    navigate(`/search?q=${encodeURIComponent(input.value.trim())}`)
                  }
                }}
                className="px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                >
                🔍
              </button>
            </div>

            {/* 레이드 생성 버튼 */}
            {/* <button
              onClick={() => navigate('/raids/new')}
              className="bg-blue-600 hover:bg-blue-500 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
              >
              + 레이드 생성
            </button> */}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* 내 캐릭터 섹션 */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-200">내 캐릭터</h2>

          {charLoading ? (
            <p className="text-gray-500">불러오는 중...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {characters.map((char) => (
                <div key={char.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors">
                  <p className="font-semibold text-white truncate">{char.name}</p>
                  <p className="text-sm text-gray-400 mt-1">{char.class_name}</p>
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
          {/* 제목 + 버튼을 한 줄에 */}
          <div className = "flex items-center gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-200 m-0 leading-none">내 레이드</h2>
              <button
                onClick={() => navigate('/raids/new')}
                className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors
               bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white
               border border-gray-700"
              >
                + 레이드 생성
              </button>
          </div>
          {/* ↓ min-h-[200px] 추가 — 비어있을 때도 높이 고정 */}
          <div className="min-h-[200px]">
            {raidLoading ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-gray-500">불러오는 중...</p>
              </div>
            ) : raids.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                <p className="text-gray-500 text-sm ">참여 중인 레이드가 없어요.</p>
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
                <div
                  key={raid.id}
                  onClick={() => navigate(`/raids/${raid.id}`)}
                  className="border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-gray-600 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-semibold">{raid.raid_name}</p>
                    <p className="text-sm text-gray-4 00 mt-1">
                      {raid.difficulty} · 최대 {raid.max_slots}명
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setRaidToDelete(raid)
                    }}
                    className="text-gray-500 hover:text-red-400 text-sm px-2 py-1 rounded hover:bg-red-400/10"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
            )}
          </div>
        </section>
      </main>

      {/* 삭제 확인 모달 */}
      {/* raidToDelete가 null이 아닐 때만 렌더링 */}
      {raidToDelete && (
        // 배경 오버레이 - 클릭하면 모달 닫힘
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          // fixed inset-0 : 화면 전체를 덮는 고정 레이어
          // z-50 : 다른 요소 위에 표시
          onClick={() => setRaidToDelete(null)}
        >
          {/* 모달 본체 - 클릭 이벤트가 오버레이로 전파되지 않도록 막음 */}
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">레이드 삭제</h3>
            <p className="text-sm text-gray-400">
              <span className="text-white font-medium">{raidToDelete.raid_name}</span> 레이드를
              삭제할까요?<br />이 작업은 되돌릴 수 없어요.
            </p>

            <div className="flex gap-2 pt-1">
              {/* 취소 버튼 */}
              <button
                onClick={() => setRaidToDelete(null)}
                className="flex-1 px-4 py-2 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                취소
              </button>

              {/* 삭제 확인 버튼 */}
              {/* deleteMutation.isPending : API 호출 중이면 true */}
              <button
                onClick={() => deleteMutation.mutate(raidToDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# 환경변수 로드 및 클라이언트 생성
load_dotenv()

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY", "")

if not SUPABASE_KEY or not SUPABASE_URL:
  raise RuntimeError("SUSUPABASE_URL 또는 SUPABASE_KEY 환경변수가 설정되지 않았습니다.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 연결 확인 함수
async def check_connection() -> None:
  try:
    supabase.table("users").select("id").limit(1).execute()
    print("✅ Supabase 연결 성공")
    return True
  except Exception as e:
    print(f"❌ Supabase 연결 실패: {e}")
    raise False
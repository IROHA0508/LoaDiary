from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api import users, characters, raids
from app.db.supabase_client import check_connection
from app.api import groups

# 서버 시작시 DB연결 확인 추가
@asynccontextmanager
async def lifespan(app: FastAPI):
  await check_connection()
  yield

app = FastAPI(
  title = "LoaDiary API",
  version = "1.0.0",
  description = "로스트아크 유틸리티 서비스 LoaDiary 백엔드 API",
  lifespan = lifespan
)

# CORS 설정 추가
app.add_middleware(
  CORSMiddleware,
  allow_origins=[
    # 개발 중 사용할 프론트엔드 주소
    "http://localhost:5173",

    # 배포 이후 사용할 프론트엔드 주소
    "https://loakit.vercel.app",

    # 백엔드 koyeb 주소
    "https://legitimate-dreddy-lunarproject-10a2d90e.koyeb.app/"
  ],
  allow_credentials = True,
  allow_methods = ["*"],
  allow_headers = ["*"],
)

# 라우터 등록
app.include_router(users.router, prefix="/api/users", tags = ["users"])
app.include_router(characters.router, prefix="/api/characters", tags = ["characters"])
app.include_router(raids.router, prefix="/api/raids", tags = ["raids"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])

@app.get("/")
def root():
  return {"message" : "LoaDiary API 작동 중"}

# 상태확인 엔드포인트 추가
@app.get("/health")
def health_check():
  return {"status" : "healthy"}
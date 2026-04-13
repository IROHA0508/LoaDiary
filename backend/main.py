from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api import users, characters, raids, groups
from app.db.supabase_client import check_connection
from app.api import market, jewel
from fastapi.responses import JSONResponse

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
    "http://localhost:4173",

    # 배포 이후 사용할 프론트엔드 주소
    "https://loakit.vercel.app",
    "https://loa-diary.vercel.app",

    # 백엔드 koyeb 주소
    # "https://legitimate-dreddy-lunarproject-10a2d90e.koyeb.app/"
  ],
  allow_credentials = True,
  allow_methods = ["*"],
  allow_headers = ["*"],
)

# 라우터 등록
app.include_router(users.router, prefix="/api/users", tags = ["users"])
app.include_router(characters.router, prefix="/api/characters", tags = ["characters"])
app.include_router(raids.router, prefix="/api/raids", tags = ["raids"])
app.include_router(market.router, prefix="/api/market", tags=["market"])   # ← 추가
app.include_router(jewel.router, prefix="/api/jewel", tags=["jewel"])  

@app.get("/")
def root():
  return {"message" : "LoaDiary API 작동 중"}

# favicon.ico 요청 무시 (브라우저 자동 요청으로 인한 404 로그 제거)
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(status_code=204)

# 상태확인 엔드포인트 추가
@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    db_ok = await check_connection()
    status_code = 200 if db_ok else 503
    return JSONResponse(
       content = {"status" : "healthy" if db_ok else "degraded", "db" : db_ok},
       status_code = status_code,
    )
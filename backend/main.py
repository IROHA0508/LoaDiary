from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
  return {"message" : "LoaDiary API 작동 중"}
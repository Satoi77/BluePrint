from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import CORS_ORIGINS
from app.services.logging_db import init_db, log


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    log("info", "main", "服务启动")
    yield
    log("info", "main", "服务停止")


app = FastAPI(title="BluePrint API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log("error", "main", "未处理异常", {"path": str(request.url)}, exc=exc)
    return JSONResponse(
        status_code=500, content={"detail": f"服务器内部错误: {exc}"}
    )


app.include_router(router)

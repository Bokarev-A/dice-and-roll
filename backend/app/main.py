import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.users import router as users_router
from app.api.rooms import router as rooms_router
from app.api.products import router as products_router
from app.api.orders import router as orders_router
from app.api.credits import router as credits_router
from app.api.campaigns import router as campaigns_router
from app.api.sessions import router as sessions_router
from app.api.signups import router as signups_router
from app.api.attendance import router as attendance_router
from app.api.calendar import router as calendar_router
from app.api.webhook import router as webhook_router
from app.services.scheduler_service import start_scheduler, stop_scheduler
from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Path to built frontend
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info("Starting Dice&Roll API...")
    start_scheduler()
    if settings.WEBHOOK_URL:
        from app.bot.notifications import register_webhook
        try:
            await register_webhook()
        except Exception as exc:
            logger.warning("Could not register Telegram webhook (will retry later): %s", exc)
    yield
    logger.info("Shutting down Dice&Roll API...")
    stop_scheduler()


app = FastAPI(
    title="Dice&Roll API",
    description="Telegram Mini App backend for Dice&Roll tabletop RPG club",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(users_router, prefix="/api")
app.include_router(rooms_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(credits_router, prefix="/api")
app.include_router(campaigns_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(signups_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(calendar_router, prefix="/api")
app.include_router(webhook_router, prefix="/bot")


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "dice-and-roll"}


# Serve frontend static files
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA for all non-API routes."""
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")
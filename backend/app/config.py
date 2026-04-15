from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./dice_and_roll.db"
    BOT_TOKEN: str = ""
    INITIAL_ADMIN_TELEGRAM_ID: int = 0
    CLUB_TIMEZONE: str = "Europe/Moscow"

    QR_SBP_IMAGE_URL: str = ""
    QR_SBP_LINK: str = ""
    QR_SBP_RECIPIENT_NAME: str = ""
    QR_SBP_BANK_NAME: str = ""

    OFFERED_TIMEOUT_HOURS: int = 24
    OFFERED_REMINDER_HOURS: int = 12
    ORDER_EXPIRY_HOURS: int = 24
    ATTENDANCE_WINDOW_HOURS: int = 48

    WEBHOOK_URL: str = ""
    WEBHOOK_SECRET: str = ""
    MINI_APP_URL: str = ""

    # Local Telegram Bot API server (leave default to use api.telegram.org)
    TELEGRAM_BOT_API_URL: str = "https://api.telegram.org"

    SKIP_TG_VALIDATION: bool = False
    TELEGRAM_PROXY: str = ""  # e.g. http://user:pass@host:port or socks5://host:port

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
import hashlib
import hmac
import json
import logging
import urllib.parse
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


def validate_init_data(init_data: str) -> Optional[dict]:
    """
    Validate Telegram WebApp initData and return parsed user data.
    Returns None if validation fails.
    """
    logger.info(f"validate_init_data called, data length: {len(init_data)}")
    logger.info(f"SKIP_TG_VALIDATION: {settings.SKIP_TG_VALIDATION}")

    # Skip validation in dev mode
    if settings.SKIP_TG_VALIDATION:
        logger.info("Skipping TG validation (dev mode)")
        try:
            parsed = urllib.parse.parse_qs(init_data, keep_blank_values=True)
            user_str = parsed.get("user", [None])[0]
            if user_str:
                return json.loads(user_str)
        except Exception:
            pass
        # Return fake user for dev
        return {"id": 123456789, "first_name": "Dev", "username": "dev"}

    try:
        parsed = urllib.parse.parse_qs(init_data, keep_blank_values=True)

        hash_value = parsed.get("hash", [None])[0]
        if not hash_value:
            logger.warning("No hash in initData")
            return None

        # Build data-check-string
        data_pairs = []
        for key, values in sorted(parsed.items()):
            if key == "hash":
                continue
            data_pairs.append(f"{key}={values[0]}")
        data_check_string = "\n".join(data_pairs)

        # Compute HMAC
        secret_key = hmac.new(
            b"WebAppData",
            settings.BOT_TOKEN.encode(),
            hashlib.sha256,
        ).digest()

        computed_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(computed_hash, hash_value):
            logger.warning("Hash mismatch!")
            logger.info(f"Expected: {computed_hash}")
            logger.info(f"Got: {hash_value}")
            return None

        # Parse user
        user_str = parsed.get("user", [None])[0]
        if not user_str:
            logger.warning("No user in initData")
            return None

        user_data = json.loads(user_str)
        logger.info(f"Validated user: {user_data.get('id')} {user_data.get('first_name')}")
        return user_data

    except Exception as e:
        logger.exception(f"validate_init_data error: {e}")
        return None
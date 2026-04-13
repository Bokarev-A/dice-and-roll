#!/bin/bash
# deploy.sh — накат новой версии на сервер
# Запускать от root или через sudo: bash deploy.sh
set -euo pipefail

APP_DIR="/opt/dice-and-roll"
APP_USER="diceroll"
VENV="$APP_DIR/backend/venv/bin"

echo "=== [1/5] Получение изменений из репозитория ==="
cd "$APP_DIR"
sudo -u "$APP_USER" git pull --ff-only

echo "=== [2/5] Обновление Python-зависимостей ==="
sudo -u "$APP_USER" "$VENV/pip" install -q --upgrade pip
sudo -u "$APP_USER" "$VENV/pip" install -q -r "$APP_DIR/backend/requirements.txt"

echo "=== [3/5] Применение миграций БД ==="
sudo -u "$APP_USER" "$VENV/alembic" -c "$APP_DIR/backend/alembic.ini" upgrade head

echo "=== [4/5] Сборка фронтенда ==="
cd "$APP_DIR/frontend"
sudo -u "$APP_USER" npm ci --silent

# Скачиваем Telegram WebApp SDK локально (если отсутствует или устарел)
mkdir -p "$APP_DIR/frontend/public"
curl -sf https://telegram.org/js/telegram-web-app.js -o "$APP_DIR/frontend/public/telegram-web-app.js" \
    && echo "  ✓ Telegram SDK обновлён" \
    || echo "  ⚠ Не удалось скачать Telegram SDK (используется предыдущая версия)"

sudo -u "$APP_USER" npm run build

echo "=== [5/5] Перезапуск сервиса ==="
systemctl restart dice-and-roll

# Ждём запуска и проверяем health
sleep 3
if curl -sf http://127.0.0.1:8000/api/health > /dev/null; then
    echo ""
    echo "✓ Деплой успешен. Сервис работает."
else
    echo ""
    echo "✗ Health check не прошёл! Проверьте логи:"
    echo "  journalctl -u dice-and-roll -n 50"
    exit 1
fi

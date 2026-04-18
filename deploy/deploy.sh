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
cd "$APP_DIR/backend"
sudo -u "$APP_USER" "$VENV/alembic" upgrade head

echo "=== [4/5] Сборка фронтенда ==="
cd "$APP_DIR/frontend"
npm ci

# Скачиваем Telegram WebApp SDK локально (если отсутствует или устарел)
mkdir -p "$APP_DIR/frontend/public"
curl -sf https://telegram.org/js/telegram-web-app.js -o "$APP_DIR/frontend/public/telegram-web-app.js" \
    && echo "  ✓ Telegram SDK обновлён" \
    || echo "  ⚠ Не удалось скачать Telegram SDK (используется предыдущая версия)"

npm run build

echo "=== [5/5] Перезапуск сервиса ==="
systemctl restart dice-and-roll

# Ждём запуска и проверяем health (до 30 секунд, с шагом 2с)
echo "Ожидание запуска сервиса..."
for i in $(seq 1 15); do
    if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
        echo ""
        echo "✓ Деплой успешен. Сервис работает."
        exit 0
    fi
    sleep 2
done

echo ""
echo "✗ Health check не прошёл! Проверьте логи:"
echo "  journalctl -u dice-and-roll -n 50"
exit 1

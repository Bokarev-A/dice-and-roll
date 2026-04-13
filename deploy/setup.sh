#!/bin/bash
# setup.sh — первоначальная настройка сервера
# Запускать от root: bash setup.sh
set -euo pipefail

APP_DIR="/opt/dice-and-roll"
APP_USER="diceroll"

echo "=== [1/7] Обновление системы ==="
apt update && apt upgrade -y

echo "=== [2/7] Установка зависимостей ==="
apt install -y \
    python3 python3-pip python3-venv \
    nginx \
    docker.io docker-compose \
    git curl

systemctl enable --now docker

echo "=== [3/7] Создание системного пользователя ==="
id -u "$APP_USER" &>/dev/null || useradd --system --shell /bin/bash --create-home "$APP_USER"
usermod -aG docker "$APP_USER"

echo "=== [4/7] Клонирование репозитория ==="
if [ ! -d "$APP_DIR" ]; then
    git clone https://github.com/YOUR_USERNAME/dice-and-roll.git "$APP_DIR"
else
    echo "Директория $APP_DIR уже существует, пропускаем клонирование"
fi
# Всегда выставляем владельца — на случай если директория уже была с другим owner
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "=== [5/7] Python venv и зависимости ==="
sudo -u "$APP_USER" python3 -m venv "$APP_DIR/backend/venv"
sudo -u "$APP_USER" "$APP_DIR/backend/venv/bin/pip" install --upgrade pip
sudo -u "$APP_USER" "$APP_DIR/backend/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

echo "=== [6/7] Настройка nginx ==="
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/dice-and-roll
ln -sf /etc/nginx/sites-available/dice-and-roll /etc/nginx/sites-enabled/dice-and-roll
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx

echo "=== [7/7] Установка systemd-сервиса ==="
cp "$APP_DIR/deploy/dice-and-roll.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable dice-and-roll

echo ""
echo "✓ Базовая настройка завершена."
echo ""
echo "Следующие шаги:"
echo "  1. Скопируйте и заполните .env:"
echo "     cp $APP_DIR/deploy/env.example $APP_DIR/backend/.env"
echo "     nano $APP_DIR/backend/.env"
echo ""
echo "  2. Запустите PostgreSQL:"
echo "     cd $APP_DIR/backend && docker-compose up -d db"
echo ""
echo "  3. Примените миграции:"
echo "     sudo -u $APP_USER $APP_DIR/backend/venv/bin/alembic -c $APP_DIR/backend/alembic.ini upgrade head"
echo ""
echo "  4. Соберите фронтенд (локально и залейте dist/, или установите Node.js на сервере):"
echo "     # На сервере: apt install -y nodejs npm && cd $APP_DIR/frontend && npm ci && npm run build"
echo ""
echo "  5. Запустите приложение:"
echo "     systemctl start dice-and-roll"
echo "     systemctl status dice-and-roll"

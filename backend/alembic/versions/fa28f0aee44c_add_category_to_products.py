"""add category to products

Revision ID: fa28f0aee44c
Revises: seed_0001
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'fa28f0aee44c'
down_revision: Union[str, None] = 'seed_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Добавляем колонку с дефолтом "player"
    op.add_column('products', sa.Column('category', sa.String(50), nullable=False, server_default='player'))
    # 2) Убираем server_default (оставляем только в модели)
    op.alter_column('products', 'category', server_default=None)


def downgrade() -> None:
    op.drop_column('products', 'category')

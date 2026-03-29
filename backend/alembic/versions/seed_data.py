"""seed rooms and products

Revision ID: seed_0001
Revises: ceb6d4868bb9
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "seed_0001"
down_revision: Union[str, None] = "ceb6d4868bb9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rooms
    op.execute(
        """
        INSERT INTO rooms (name, is_active) VALUES
        ('308', true),
        ('312', true),
        ('615', true)
        """
    )

    # Products
    op.execute(
        """
        INSERT INTO products (name, price, credits, duration_months, is_active) VALUES
        ('Разовая игра', 700.00, 1, NULL, true),
        ('Абонемент на 4 игры', 2395.00, 4, 2, true),
        ('Абонемент на 8 игр', 4715.00, 8, 3, true),
        ('Абонемент на 12 игр', 6915.00, 12, 4, true),
        ('Абонемент на 16 игр', 8850.00, 16, 5, true),
        ('Абонемент на 20 игр', 9955.00, 20, 7, true)
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM products")
    op.execute("DELETE FROM rooms")
"""Add private_gm to userrole enum

Revision ID: a1b2c3d4e5f6
Revises: d7b3e9f12a04
Create Date: 2026-04-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd7b3e9f12a04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'private_gm'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values
    pass

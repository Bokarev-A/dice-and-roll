"""Add pending to signupstatus enum

Revision ID: d7b3e9f12a04
Revises: c2e4a1f83b91
Create Date: 2026-04-10 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd7b3e9f12a04'
down_revision: Union[str, None] = 'c2e4a1f83b91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE signupstatus ADD VALUE IF NOT EXISTS 'pending'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values
    pass

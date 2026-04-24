"""add_deleted_to_orderstatus

Revision ID: 587e8ffc1bd7
Revises: d1e2f3a4b5c6
Create Date: 2026-04-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = '587e8ffc1bd7'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'deleted'")


def downgrade() -> None:
    pass

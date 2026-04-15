"""add_capacity_to_campaigns

Revision ID: c1d2e3f4a5b6
Revises: b3e7f9a21c08
Create Date: 2026-04-15 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b3e7f9a21c08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'campaigns',
        sa.Column('capacity', sa.Integer(), nullable=False, server_default='5'),
    )


def downgrade() -> None:
    op.drop_column('campaigns', 'capacity')

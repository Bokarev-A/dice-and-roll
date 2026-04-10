"""Add status to campaign_members

Revision ID: c2e4a1f83b91
Revises: 35d96c47bf00
Create Date: 2026-04-10 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2e4a1f83b91'
down_revision: Union[str, None] = '35d96c47bf00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE campaignmemberstatus AS ENUM ('pending', 'active')")
    op.add_column(
        'campaign_members',
        sa.Column(
            'status',
            sa.Enum('pending', 'active', name='campaignmemberstatus', create_type=False),
            nullable=False,
            server_default='active',
        ),
    )


def downgrade() -> None:
    op.drop_column('campaign_members', 'status')
    op.execute("DROP TYPE IF EXISTS campaignmemberstatus")

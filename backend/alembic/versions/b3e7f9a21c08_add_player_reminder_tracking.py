"""add_player_reminder_tracking

Revision ID: b3e7f9a21c08
Revises: 90f6bc87253e
Create Date: 2026-04-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3e7f9a21c08'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('game_sessions', sa.Column('players_48h_reminded_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('game_sessions', sa.Column('players_6h_reminded_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('game_sessions', sa.Column('gm_6h_notified_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('game_sessions', 'gm_6h_notified_at')
    op.drop_column('game_sessions', 'players_6h_reminded_at')
    op.drop_column('game_sessions', 'players_48h_reminded_at')

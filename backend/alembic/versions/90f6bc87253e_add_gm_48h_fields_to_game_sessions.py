"""add_gm_48h_fields_to_game_sessions

Revision ID: 90f6bc87253e
Revises: f378c8ff8a92
Create Date: 2026-04-07 19:37:06.803834

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '90f6bc87253e'
down_revision: Union[str, None] = 'f378c8ff8a92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('game_sessions', sa.Column('gm_48h_notified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('game_sessions', sa.Column('players_confirmed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('game_sessions', 'players_confirmed_at')
    op.drop_column('game_sessions', 'gm_48h_notified_at')
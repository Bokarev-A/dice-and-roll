"""add_funding_gm_reward

Revision ID: f378c8ff8a92
Revises: a9f56866ec22
Create Date: 2026-03-30 16:24:35.924385

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f378c8ff8a92'
down_revision: Union[str, None] = 'a9f56866ec22'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add 'gm_reward' to creditbatchtype enum
    op.execute("ALTER TYPE creditbatchtype ADD VALUE IF NOT EXISTS 'gm_reward'")

    # 2. Add 'gm_reward' to ledgertype enum
    op.execute("ALTER TYPE ledgertype ADD VALUE IF NOT EXISTS 'gm_reward'")

    # 3. Drop unique constraint on order_id (multiple NULLs needed for gm_reward batches)
    # campaignfunding enum, funding column, session_id column, FK, order_id nullable
    # — всё это уже сделано в предыдущей миграции a9f56866ec22
    op.drop_constraint('credit_batches_order_id_key', 'credit_batches', type_='unique')


def downgrade() -> None:
    op.create_unique_constraint('credit_batches_order_id_key', 'credit_batches', ['order_id'])
    op.alter_column('credit_batches', 'order_id',
                    existing_type=sa.INTEGER(),
                    nullable=False)
    op.drop_constraint('fk_credit_batches_session_id', 'credit_batches', type_='foreignkey')
    op.drop_column('credit_batches', 'session_id')
    op.drop_column('campaigns', 'funding')
    sa.Enum('club', 'private', name='campaignfunding').drop(op.get_bind(), checkfirst=True)
    # Note: cannot remove values from PostgreSQL enums in downgrade

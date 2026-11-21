"""add ticker_outlook

Revision ID: 7c1e2a9d4b10
Revises: 355e93861898
Create Date: 2026-11-21 12:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7c1e2a9d4b10"
down_revision: Union[str, Sequence[str], None] = "355e93861898"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ticker_outlook",
        sa.Column("ticker", sa.String(length=32), nullable=False),
        sa.Column("as_of_day", sa.String(length=10), nullable=False),
        sa.Column("available", sa.Integer(), nullable=False),
        sa.Column("coverage_note", sa.Text(), nullable=True),
        sa.Column("payload", sa.Text(), nullable=True),
        sa.Column("model_version", sa.String(length=32), nullable=True),
        sa.Column("generated_at", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("ticker", "as_of_day"),
    )
    with op.batch_alter_table("ticker_outlook", schema=None) as batch_op:
        batch_op.create_index("idx_outlook_ticker_day", ["ticker", "as_of_day"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("ticker_outlook", schema=None) as batch_op:
        batch_op.drop_index("idx_outlook_ticker_day")
    op.drop_table("ticker_outlook")

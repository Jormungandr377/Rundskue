"""Phase 6: Financial health snapshots

Revision ID: 013
Revises: 012
Create Date: 2026-02-08

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "financial_health_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("overall_score", sa.Integer(), nullable=False),
        sa.Column("savings_rate_score", sa.Integer(), server_default="0"),
        sa.Column("debt_ratio_score", sa.Integer(), server_default="0"),
        sa.Column("emergency_fund_score", sa.Integer(), server_default="0"),
        sa.Column("budget_adherence_score", sa.Integer(), server_default="0"),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_financial_health_snapshots_id", "financial_health_snapshots", ["id"])
    op.create_index("ix_financial_health_user_date", "financial_health_snapshots", ["user_id", "date"])


def downgrade() -> None:
    op.drop_table("financial_health_snapshots")

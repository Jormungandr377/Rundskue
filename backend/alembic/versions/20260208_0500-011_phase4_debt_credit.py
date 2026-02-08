"""Phase 4: Debt management and credit score tracking

Revision ID: 011
Revises: 010
Create Date: 2026-02-08

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Debts table
    op.create_table(
        "debts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("balance", sa.Numeric(14, 2), nullable=False),
        sa.Column("interest_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("minimum_payment", sa.Numeric(14, 2), nullable=False),
        sa.Column("loan_type", sa.String(30), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("original_balance", sa.Numeric(14, 2), nullable=True),
        sa.Column("extra_info", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_debts_profile", "debts", ["profile_id"])
    op.create_index("ix_debts_id", "debts", ["id"])

    # Credit scores table
    op.create_table(
        "credit_scores",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(50), server_default="manual"),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_credit_scores_id", "credit_scores", ["id"])
    op.create_index("ix_credit_scores_user_date", "credit_scores", ["user_id", "date"])


def downgrade() -> None:
    op.drop_table("credit_scores")
    op.drop_table("debts")

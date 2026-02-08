"""Phase 7: Shared budgets and bill splitting

Revision ID: 014
Revises: 013
Create Date: 2026-02-08

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Shared budgets table
    op.create_table(
        "shared_budgets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("budget_id", sa.Integer(), sa.ForeignKey("budgets.id"), nullable=False),
        sa.Column("shared_with_profile_id", sa.Integer(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("permission", sa.String(10), server_default="view"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_shared_budgets_id", "shared_budgets", ["id"])
    op.create_index("ix_shared_budgets_budget_id", "shared_budgets", ["budget_id"])

    # Split expenses table
    op.create_table(
        "split_expenses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("transaction_id", sa.Integer(), sa.ForeignKey("transactions.id"), nullable=True),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_split_expenses_id", "split_expenses", ["id"])
    op.create_index("ix_split_expenses_profile", "split_expenses", ["profile_id"])

    # Split participants table
    op.create_table(
        "split_participants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("split_expense_id", sa.Integer(), sa.ForeignKey("split_expenses.id"), nullable=False),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id"), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("share_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("is_paid", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_split_participants_id", "split_participants", ["id"])
    op.create_index("ix_split_participants_expense", "split_participants", ["split_expense_id"])


def downgrade() -> None:
    op.drop_table("split_participants")
    op.drop_table("split_expenses")
    op.drop_table("shared_budgets")

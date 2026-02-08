"""Phase 5: Investment holdings and dividend tracking

Revision ID: 012
Revises: 011
Create Date: 2026-02-08

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Investment holdings table
    op.create_table(
        "investment_holdings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("quantity", sa.Numeric(14, 6), nullable=False),
        sa.Column("price", sa.Numeric(14, 4), nullable=False),
        sa.Column("value", sa.Numeric(14, 2), nullable=False),
        sa.Column("cost_basis", sa.Numeric(14, 2), nullable=True),
        sa.Column("gain_loss", sa.Numeric(14, 2), nullable=True),
        sa.Column("asset_class", sa.String(30), server_default="stocks"),
        sa.Column("last_updated", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_investment_holdings_id", "investment_holdings", ["id"])
    op.create_index("ix_investment_holdings_account", "investment_holdings", ["account_id"])

    # Add is_dividend column to transactions
    op.add_column("transactions", sa.Column("is_dividend", sa.Boolean(), server_default=sa.text("false"), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "is_dividend")
    op.drop_table("investment_holdings")

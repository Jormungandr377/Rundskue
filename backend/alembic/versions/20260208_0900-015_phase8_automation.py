"""Phase 8: Automation - scheduled reports and webhooks

Revision ID: 015
Revises: 014
Create Date: 2026-02-08

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Scheduled email reports
    op.create_table(
        "scheduled_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("report_type", sa.String(30), nullable=False),
        sa.Column("frequency", sa.String(20), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=True),
        sa.Column("day_of_month", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("last_sent", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_scheduled_reports_id", "scheduled_reports", ["id"])
    op.create_index("ix_scheduled_reports_user_active", "scheduled_reports", ["user_id", "is_active"])

    # Webhooks
    op.create_table(
        "webhooks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("events", sa.JSON(), nullable=False),
        sa.Column("secret", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("last_triggered", sa.DateTime(), nullable=True),
        sa.Column("failure_count", sa.Integer(), server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_webhooks_id", "webhooks", ["id"])
    op.create_index("ix_webhooks_user_active", "webhooks", ["user_id", "is_active"])


def downgrade() -> None:
    op.drop_table("webhooks")
    op.drop_table("scheduled_reports")

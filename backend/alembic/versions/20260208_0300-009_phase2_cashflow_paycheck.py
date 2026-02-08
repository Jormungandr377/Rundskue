"""Phase 2: Cash flow & income - paycheck rules and allocations.

Revision ID: 009
Revises: 008
Create Date: 2026-02-08 03:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Paycheck rules
    op.create_table(
        'paycheck_rules',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('profile_id', sa.Integer(), sa.ForeignKey('profiles.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('match_merchant', sa.String(255), nullable=False),
        sa.Column('match_amount_min', sa.Numeric(14, 2), nullable=True),
        sa.Column('match_amount_max', sa.Numeric(14, 2), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_paycheck_rules_profile_active', 'paycheck_rules', ['profile_id', 'is_active'])

    # Paycheck allocations
    op.create_table(
        'paycheck_allocations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('rule_id', sa.Integer(), sa.ForeignKey('paycheck_rules.id'), nullable=False),
        sa.Column('target_type', sa.String(20), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=False),
        sa.Column('amount_type', sa.String(20), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('priority', sa.Integer(), server_default=sa.text('0')),
    )
    op.create_index('ix_paycheck_allocations_rule_id', 'paycheck_allocations', ['rule_id'])


def downgrade() -> None:
    op.drop_table('paycheck_allocations')
    op.drop_table('paycheck_rules')

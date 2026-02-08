"""Phase 3: Savings & goals enhancements - savings rules, emergency fund, sinking funds.

Revision ID: 010
Revises: 009
Create Date: 2026-02-08 04:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to savings_goals
    op.add_column('savings_goals', sa.Column('is_emergency_fund', sa.Boolean(), server_default=sa.text('false')))
    op.add_column('savings_goals', sa.Column('fund_type', sa.String(20), server_default='general'))
    op.add_column('savings_goals', sa.Column('target_date', sa.Date(), nullable=True))
    op.add_column('savings_goals', sa.Column('monthly_contribution', sa.Numeric(14, 2), nullable=True))

    # Create savings_rules table
    op.create_table(
        'savings_rules',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('profile_id', sa.Integer(), sa.ForeignKey('profiles.id'), nullable=False),
        sa.Column('goal_id', sa.Integer(), sa.ForeignKey('savings_goals.id'), nullable=False),
        sa.Column('rule_type', sa.String(20), nullable=False),
        sa.Column('round_up_to', sa.Integer(), nullable=True),
        sa.Column('percentage', sa.Numeric(5, 2), nullable=True),
        sa.Column('fixed_amount', sa.Numeric(14, 2), nullable=True),
        sa.Column('frequency', sa.String(20), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('total_saved', sa.Numeric(14, 2), server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_savings_rules_profile_active', 'savings_rules', ['profile_id', 'is_active'])


def downgrade() -> None:
    op.drop_table('savings_rules')
    op.drop_column('savings_goals', 'monthly_contribution')
    op.drop_column('savings_goals', 'target_date')
    op.drop_column('savings_goals', 'fund_type')
    op.drop_column('savings_goals', 'is_emergency_fund')

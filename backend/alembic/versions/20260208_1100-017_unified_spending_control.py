"""unified spending control system

Revision ID: 017_unified_spending
Revises: 016_credit_health
Create Date: 2026-02-08 11:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '017_unified_spending'
down_revision = '016_credit_health'
branch_labels = None
depends_on = None


def upgrade():
    """Create unified spending_controls table."""
    op.create_table(
        'spending_controls',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('profile_id', sa.Integer(), sa.ForeignKey('profiles.id'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('methodology', sa.String(20), nullable=False, comment='budget, envelope, or savings_rule'),

        # Common fields
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=True),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('period', sa.String(20), default='monthly', comment='monthly, weekly, or one_time'),
        sa.Column('is_active', sa.Boolean(), default=True),

        # Budget-specific
        sa.Column('month', sa.Date(), nullable=True, comment='First day of month for budget methodology'),
        sa.Column('is_template', sa.Boolean(), default=False, comment='Use as template for new periods'),
        sa.Column('rollover_amount', sa.Numeric(14, 2), default=0, comment='Carried over from previous period'),
        sa.Column('alert_threshold_pct', sa.Integer(), default=80, comment='Alert when spending reaches this %'),

        # Envelope-specific
        sa.Column('color', sa.String(7), default='#3b82f6', comment='UI color for envelope'),
        sa.Column('icon', sa.String(50), default='wallet', comment='UI icon for envelope'),

        # Savings Rule-specific
        sa.Column('goal_id', sa.Integer(), sa.ForeignKey('savings_goals.id'), nullable=True),
        sa.Column('rule_type', sa.String(20), nullable=True, comment='round_up, percentage, fixed_schedule'),
        sa.Column('round_up_to', sa.Integer(), nullable=True, comment='1, 5, or 10 for round-up rules'),
        sa.Column('percentage', sa.Numeric(5, 2), nullable=True, comment='Percentage for percentage-based rules'),
        sa.Column('frequency', sa.String(20), nullable=True, comment='weekly, monthly for scheduled rules'),
        sa.Column('total_saved', sa.Numeric(14, 2), default=0, comment='Total saved via this rule'),

        # Metadata
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create indexes
    op.create_index('ix_spending_controls_profile_active', 'spending_controls', ['profile_id', 'is_active'])
    op.create_index('ix_spending_controls_methodology', 'spending_controls', ['methodology'])
    op.create_index('ix_spending_controls_category', 'spending_controls', ['category_id'])
    op.create_index('ix_spending_controls_goal', 'spending_controls', ['goal_id'])


def downgrade():
    """Drop unified spending_controls table."""
    op.drop_index('ix_spending_controls_goal', 'spending_controls')
    op.drop_index('ix_spending_controls_category', 'spending_controls')
    op.drop_index('ix_spending_controls_methodology', 'spending_controls')
    op.drop_index('ix_spending_controls_profile_active', 'spending_controls')
    op.drop_table('spending_controls')

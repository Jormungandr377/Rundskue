"""credit health integration

Revision ID: 016_credit_health
Revises: 015_phase8_automation
Create Date: 2026-02-08 10:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '016_credit_health'
down_revision = '015_phase8_automation'
branch_labels = None
depends_on = None


def upgrade():
    """Add credit health metrics fields."""
    # Add new columns to credit_scores table
    op.add_column('credit_scores',
        sa.Column('credit_utilization', sa.Numeric(5, 2), nullable=True, comment='Credit utilization percentage'))
    op.add_column('credit_scores',
        sa.Column('debt_to_income_ratio', sa.Numeric(5, 2), nullable=True, comment='Debt-to-income ratio percentage'))
    op.add_column('credit_scores',
        sa.Column('total_credit_limit', sa.Numeric(14, 2), nullable=True, comment='Total credit limit across all accounts'))
    op.add_column('credit_scores',
        sa.Column('total_credit_used', sa.Numeric(14, 2), nullable=True, comment='Total credit used'))
    op.add_column('credit_scores',
        sa.Column('monthly_income', sa.Numeric(14, 2), nullable=True, comment='Monthly income for DTI calculation'))
    op.add_column('credit_scores',
        sa.Column('monthly_debt_payment', sa.Numeric(14, 2), nullable=True, comment='Total monthly debt payments'))

    # Add payoff_impact field to debts table for score projection
    op.add_column('debts',
        sa.Column('payoff_impact', sa.Integer, nullable=True, comment='Estimated credit score impact of paying off this debt'))
    op.add_column('debts',
        sa.Column('priority', sa.Integer, default=0, comment='User-defined priority for debt payoff (0=none)'))


def downgrade():
    """Remove credit health metrics fields."""
    op.drop_column('debts', 'priority')
    op.drop_column('debts', 'payoff_impact')
    op.drop_column('credit_scores', 'monthly_debt_payment')
    op.drop_column('credit_scores', 'monthly_income')
    op.drop_column('credit_scores', 'total_credit_used')
    op.drop_column('credit_scores', 'total_credit_limit')
    op.drop_column('credit_scores', 'debt_to_income_ratio')
    op.drop_column('credit_scores', 'credit_utilization')

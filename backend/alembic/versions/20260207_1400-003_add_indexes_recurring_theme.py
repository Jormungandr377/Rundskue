"""Add database indexes, recurring transactions, user theme preference

Revision ID: 003
Revises: 002
Create Date: 2026-02-07 14:00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add indexes, recurring_transactions table, and user theme column."""

    # Add theme preference to users
    op.add_column('users', sa.Column('theme', sa.String(length=10), server_default='light'))

    # Add missing indexes on foreign keys for faster joins/lookups
    op.create_index('ix_profiles_user_id', 'profiles', ['user_id'])
    op.create_index('ix_refresh_tokens_user_id', 'refresh_tokens', ['user_id'])
    op.create_index('ix_accounts_profile_id', 'accounts', ['profile_id'])

    # Create recurring_transactions table
    op.create_table(
        'recurring_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('profile_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('frequency', sa.String(length=20), nullable=False),
        sa.Column('day_of_month', sa.Integer(), nullable=True),
        sa.Column('day_of_week', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('next_due_date', sa.Date(), nullable=False),
        sa.Column('is_income', sa.Boolean(), server_default='false'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('auto_categorize', sa.Boolean(), server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['profile_id'], ['profiles.id']),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_recurring_transactions_id', 'recurring_transactions', ['id'])
    op.create_index('ix_recurring_profile_id', 'recurring_transactions', ['profile_id'])
    op.create_index('ix_recurring_profile_active', 'recurring_transactions', ['profile_id', 'is_active'])
    op.create_index('ix_recurring_next_due', 'recurring_transactions', ['next_due_date'])


def downgrade() -> None:
    """Remove recurring_transactions table, indexes, and theme column."""
    op.drop_table('recurring_transactions')
    op.drop_index('ix_accounts_profile_id', table_name='accounts')
    op.drop_index('ix_refresh_tokens_user_id', table_name='refresh_tokens')
    op.drop_index('ix_profiles_user_id', table_name='profiles')
    op.drop_column('users', 'theme')

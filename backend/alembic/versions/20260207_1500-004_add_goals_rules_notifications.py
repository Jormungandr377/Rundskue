"""Add savings goals, category rules, and notifications tables

Revision ID: 004
Revises: 003
Create Date: 2026-02-07 15:00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add savings_goals, category_rules, and notifications tables."""

    # Savings Goals
    op.create_table(
        'savings_goals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('profile_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('target_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('current_amount', sa.Numeric(precision=14, scale=2), server_default='0'),
        sa.Column('deadline', sa.Date(), nullable=True),
        sa.Column('color', sa.String(length=7), server_default='#3b82f6'),
        sa.Column('icon', sa.String(length=50), server_default='piggy-bank'),
        sa.Column('is_completed', sa.Boolean(), server_default='false'),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['profile_id'], ['profiles.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_savings_goals_id', 'savings_goals', ['id'])
    op.create_index('ix_savings_goals_profile_id', 'savings_goals', ['profile_id'])
    op.create_index('ix_savings_goals_profile', 'savings_goals', ['profile_id', 'is_completed'])

    # Category Rules (auto-categorization)
    op.create_table(
        'category_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('profile_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('match_field', sa.String(length=20), server_default='name'),
        sa.Column('match_type', sa.String(length=20), server_default='contains'),
        sa.Column('match_value', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('priority', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['profile_id'], ['profiles.id']),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_category_rules_id', 'category_rules', ['id'])
    op.create_index('ix_category_rules_profile_id', 'category_rules', ['profile_id'])
    op.create_index('ix_category_rules_profile_active', 'category_rules', ['profile_id', 'is_active'])

    # Notifications
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('is_read', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_notifications_id', 'notifications', ['id'])
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_user_read', 'notifications', ['user_id', 'is_read'])


def downgrade() -> None:
    """Remove savings_goals, category_rules, and notifications tables."""
    op.drop_table('notifications')
    op.drop_table('category_rules')
    op.drop_table('savings_goals')

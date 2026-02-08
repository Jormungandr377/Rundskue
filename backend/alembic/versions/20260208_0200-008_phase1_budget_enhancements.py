"""Phase 1: Budget enhancements - envelopes, alerts, subscriptions, rollover.

Revision ID: 008
Revises: 007
Create Date: 2026-02-08 02:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rollover column on budget_items
    op.add_column('budget_items', sa.Column('rollover_amount', sa.Numeric(12, 2), server_default='0'))

    # Envelope_id on transactions
    op.add_column('transactions', sa.Column('envelope_id', sa.Integer(), nullable=True))

    # Envelopes table
    op.create_table(
        'envelopes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('profile_id', sa.Integer(), sa.ForeignKey('profiles.id'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('allocated_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('color', sa.String(7), server_default="'#3b82f6'"),
        sa.Column('icon', sa.String(50), server_default="'wallet'"),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_envelopes_profile_active', 'envelopes', ['profile_id', 'is_active'])

    # FK from transactions to envelopes
    op.create_foreign_key('fk_transactions_envelope_id', 'transactions', 'envelopes', ['envelope_id'], ['id'])

    # Budget alerts table
    op.create_table(
        'budget_alerts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('budget_item_id', sa.Integer(), sa.ForeignKey('budget_items.id'), nullable=False),
        sa.Column('threshold_pct', sa.Integer(), nullable=False, server_default='80'),
        sa.Column('is_enabled', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_budget_alerts_user_id', 'budget_alerts', ['user_id'])

    # Subscriptions table
    op.create_table(
        'subscriptions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('profile_id', sa.Integer(), sa.ForeignKey('profiles.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('merchant_name', sa.String(255), nullable=True),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('frequency', sa.String(20), server_default="'monthly'"),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=True),
        sa.Column('last_charged', sa.Date(), nullable=True),
        sa.Column('next_expected', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_flagged_unused', sa.Boolean(), server_default='false'),
        sa.Column('detected_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_subscriptions_profile_active', 'subscriptions', ['profile_id', 'is_active'])


def downgrade() -> None:
    op.drop_index('ix_subscriptions_profile_active', 'subscriptions')
    op.drop_table('subscriptions')
    op.drop_index('ix_budget_alerts_user_id', 'budget_alerts')
    op.drop_table('budget_alerts')
    op.drop_constraint('fk_transactions_envelope_id', 'transactions', type_='foreignkey')
    op.drop_index('ix_envelopes_profile_active', 'envelopes')
    op.drop_table('envelopes')
    op.drop_column('transactions', 'envelope_id')
    op.drop_column('budget_items', 'rollover_amount')

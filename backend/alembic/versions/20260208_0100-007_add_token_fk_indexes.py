"""Add indexes on token foreign keys for faster lookups.

Revision ID: 007
Revises: 006
Create Date: 2026-02-08 01:00:00
"""
from alembic import op

# revision identifiers
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_password_reset_tokens_user_id', 'password_reset_tokens', ['user_id'])
    op.create_index('ix_email_verification_tokens_user_id', 'email_verification_tokens', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_email_verification_tokens_user_id', 'email_verification_tokens')
    op.drop_index('ix_password_reset_tokens_user_id', 'password_reset_tokens')

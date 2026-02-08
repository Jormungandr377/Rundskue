"""Add email_verification_tokens table.

Revision ID: 006
Revises: 005
Create Date: 2026-02-07 23:00:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create email_verification_tokens table
    op.create_table(
        'email_verification_tokens',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('token', sa.String(255), unique=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('is_used', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_email_verification_tokens_token', 'email_verification_tokens', ['token'])

    # Set all existing users as verified so they aren't locked out
    op.execute("UPDATE users SET is_verified = true")


def downgrade() -> None:
    op.drop_index('ix_email_verification_tokens_token', table_name='email_verification_tokens')
    op.drop_table('email_verification_tokens')

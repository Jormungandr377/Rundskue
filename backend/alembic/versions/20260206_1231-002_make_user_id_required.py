"""Make profiles.user_id non-nullable and add foreign key constraint

NOTE: This migration should ONLY be run AFTER the data migration script
(scripts/migrate_to_auth.py) has been executed to ensure all profiles
have a user_id assigned.

Revision ID: 002
Revises: 001
Create Date: 2026-02-06 12:31:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make user_id required and add foreign key."""

    # Make user_id non-nullable
    # NOTE: This will fail if any profiles have NULL user_id
    # Make sure to run scripts/migrate_to_auth.py first!
    op.alter_column('profiles', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=False)

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_profiles_user_id',
        'profiles',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    """Remove foreign key and make user_id nullable."""

    # Drop foreign key constraint
    op.drop_constraint('fk_profiles_user_id', 'profiles', type_='foreignkey')

    # Make user_id nullable again
    op.alter_column('profiles', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=True)

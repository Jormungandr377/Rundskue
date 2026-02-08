"""Shared encryption utilities using Fernet symmetric encryption."""
from cryptography.fernet import Fernet

from ..config import get_settings

settings = get_settings()

# Singleton Fernet instance – reused across the app
_fernet = Fernet(settings.encryption_key.encode())


def encrypt_value(value: str) -> str:
    """Encrypt a plaintext string and return the ciphertext as a UTF-8 string."""
    return _fernet.encrypt(value.encode()).decode()


def decrypt_value(encrypted: str) -> str:
    """Decrypt a Fernet ciphertext and return the original plaintext."""
    return _fernet.decrypt(encrypted.encode()).decode()

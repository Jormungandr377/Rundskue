"""Email service for sending notifications."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

from ..config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> bool:
    """
    Send an email using SMTP.

    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML content of the email
        text_content: Optional plain text content (fallback)

    Returns:
        True if email sent successfully, False otherwise
    """
    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("SMTP credentials not configured. Email not sent.")
        return False

    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = settings.smtp_from
        message["To"] = to_email

        # Add plain text part (fallback)
        if text_content:
            text_part = MIMEText(text_content, "plain")
            message.attach(text_part)

        # Add HTML part
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)

        # Connect to SMTP server and send
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(message)

        logger.info(f"Email sent successfully to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


async def send_password_reset_email(email: str, reset_token: str) -> bool:
    """
    Send password reset email with token link.

    Args:
        email: User's email address
        reset_token: Password reset token

    Returns:
        True if email sent successfully, False otherwise
    """
    reset_url = f"{settings.frontend_url}/reset-password?token={reset_token}"

    subject = "Reset Your Password - Finance Tracker"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin: 20px 0;">
            <h1 style="color: #2563eb; margin-top: 0;">Reset Your Password</h1>

            <p>You requested to reset your password for your Finance Tracker account.</p>

            <p>Click the button below to reset your password. This link will expire in 1 hour.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}"
                   style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                    Reset Password
                </a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
                If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="color: #6b7280; font-size: 12px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{reset_url}" style="color: #2563eb; word-break: break-all;">{reset_url}</a>
            </p>
        </div>

        <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
            <p>Finance Tracker - Secure Personal Finance Management</p>
        </div>
    </body>
    </html>
    """

    text_content = f"""
Reset Your Password

You requested to reset your password for your Finance Tracker account.

Click the link below to reset your password. This link will expire in 1 hour.

{reset_url}

If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.

---
Finance Tracker - Secure Personal Finance Management
    """

    return await send_email(email, subject, html_content, text_content)


async def send_welcome_email(email: str) -> bool:
    """
    Send welcome email to new users.

    Args:
        email: User's email address

    Returns:
        True if email sent successfully, False otherwise
    """
    subject = "Welcome to Finance Tracker!"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin: 20px 0;">
            <h1 style="color: #2563eb; margin-top: 0;">Welcome to Finance Tracker! 🎉</h1>

            <p>Thank you for creating an account with Finance Tracker. We're excited to help you manage your finances!</p>

            <h2 style="color: #1e40af; font-size: 18px;">Getting Started</h2>

            <ul style="line-height: 2;">
                <li>Link your bank accounts securely via Plaid</li>
                <li>Set up budgets to track your spending</li>
                <li>View transaction history and analytics</li>
                <li>Plan for retirement with the TSP simulator</li>
            </ul>

            <h2 style="color: #1e40af; font-size: 18px;">Security Tips</h2>

            <ul style="line-height: 2;">
                <li>Enable two-factor authentication for extra security</li>
                <li>Never share your password with anyone</li>
                <li>Use a strong, unique password</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{settings.frontend_url}"
                   style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                    Get Started
                </a>
            </div>
        </div>

        <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
            <p>Finance Tracker - Secure Personal Finance Management</p>
        </div>
    </body>
    </html>
    """

    text_content = f"""
Welcome to Finance Tracker!

Thank you for creating an account with Finance Tracker. We're excited to help you manage your finances!

Getting Started:
- Link your bank accounts securely via Plaid
- Set up budgets to track your spending
- View transaction history and analytics
- Plan for retirement with the TSP simulator

Security Tips:
- Enable two-factor authentication for extra security
- Never share your password with anyone
- Use a strong, unique password

Get started: {settings.frontend_url}

---
Finance Tracker - Secure Personal Finance Management
    """

    return await send_email(email, subject, html_content, text_content)


async def send_verification_email(email: str, verification_token: str) -> bool:
    """
    Send email verification link to new users.

    Args:
        email: User's email address
        verification_token: Email verification token

    Returns:
        True if email sent successfully, False otherwise
    """
    verify_url = f"{settings.frontend_url}/verify-email?token={verification_token}"

    subject = "Verify Your Email - Finance Tracker"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin: 20px 0;">
            <h1 style="color: #0d9488; margin-top: 0;">Verify Your Email</h1>

            <p>Thank you for creating a Finance Tracker account! Please verify your email address to get started.</p>

            <p>Click the button below to verify your email. This link will expire in 24 hours.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{verify_url}"
                   style="background-color: #0d9488; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                    Verify Email
                </a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
                If you didn't create this account, you can safely ignore this email.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="color: #6b7280; font-size: 12px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{verify_url}" style="color: #0d9488; word-break: break-all;">{verify_url}</a>
            </p>
        </div>

        <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
            <p>Finance Tracker - Secure Personal Finance Management</p>
        </div>
    </body>
    </html>
    """

    text_content = f"""
Verify Your Email

Thank you for creating a Finance Tracker account! Please verify your email address to get started.

Click the link below to verify your email. This link will expire in 24 hours.

{verify_url}

If you didn't create this account, you can safely ignore this email.

---
Finance Tracker - Secure Personal Finance Management
    """

    return await send_email(email, subject, html_content, text_content)

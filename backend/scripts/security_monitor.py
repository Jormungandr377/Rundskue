#!/usr/bin/env python3
"""
Security Event Monitor

Monitors audit logs for suspicious activity and security events.
Can be run as a cron job or scheduled task.

Usage:
    python backend/scripts/security_monitor.py

    # With email alerts:
    export ALERT_EMAIL=admin@example.com
    python backend/scripts/security_monitor.py --email

    # With Slack alerts:
    export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
    python backend/scripts/security_monitor.py --slack

Author: Finance Tracker Team
Last Updated: 2026-02-08
"""

import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Dict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import func, and_

from app.database import SessionLocal
from app.models import AuditLog, User


class SecurityMonitor:
    """Monitors security events and sends alerts."""

    def __init__(self):
        self.db = SessionLocal()
        self.alerts = []
        self.time_window = timedelta(hours=1)  # Check last hour

    def check_failed_logins(self):
        """Alert on multiple failed login attempts."""
        since = datetime.now(timezone.utc) - self.time_window

        # Count failed logins per IP
        failed_by_ip = self.db.query(
            AuditLog.ip_address,
            func.count(AuditLog.id).label("count")
        ).filter(
            and_(
                AuditLog.action == "LOGIN_FAILED",
                AuditLog.timestamp >= since
            )
        ).group_by(AuditLog.ip_address).all()

        for ip, count in failed_by_ip:
            if count >= 5:
                self.alerts.append({
                    "severity": "high",
                    "title": f"Multiple Failed Logins from {ip}",
                    "message": f"{count} failed login attempts in the last hour",
                    "action": "Consider blocking IP or enabling rate limiting"
                })

    def check_2fa_disabled(self):
        """Alert when users disable 2FA."""
        since = datetime.now(timezone.utc) - timedelta(hours=24)

        disabled_2fa = self.db.query(AuditLog).filter(
            and_(
                AuditLog.action == "TWO_FA_DISABLED",
                AuditLog.timestamp >= since
            )
        ).all()

        if disabled_2fa:
            for log in disabled_2fa:
                user = self.db.query(User).filter(User.id == log.user_id).first()
                self.alerts.append({
                    "severity": "medium",
                    "title": "2FA Disabled",
                    "message": f"User {user.email if user else log.user_id} disabled 2FA",
                    "action": "Verify this was intentional"
                })

    def check_admin_without_2fa(self):
        """Alert if admin users don't have 2FA enabled."""
        admins_no_2fa = self.db.query(User).filter(
            and_(
                User.role == "admin",
                User.totp_enabled == False,
                User.is_active == True
            )
        ).all()

        if admins_no_2fa:
            self.alerts.append({
                "severity": "high",
                "title": "Admin Without 2FA",
                "message": f"{len(admins_no_2fa)} admin user(s) do not have 2FA enabled",
                "action": "Require 2FA for all admin accounts",
                "users": [u.email for u in admins_no_2fa]
            })

    def check_suspicious_access_patterns(self):
        """Detect suspicious access patterns."""
        since = datetime.now(timezone.utc) - timedelta(hours=1)

        # Check for rapid account switching (session hijacking indicator)
        rapid_switches = self.db.query(
            AuditLog.ip_address,
            func.count(func.distinct(AuditLog.user_id)).label("user_count")
        ).filter(
            and_(
                AuditLog.action == "LOGIN",
                AuditLog.timestamp >= since
            )
        ).group_by(AuditLog.ip_address).having(
            func.count(func.distinct(AuditLog.user_id)) >= 3
        ).all()

        for ip, user_count in rapid_switches:
            self.alerts.append({
                "severity": "high",
                "title": f"Multiple Users from Same IP: {ip}",
                "message": f"{user_count} different users logged in from the same IP in 1 hour",
                "action": "Possible session hijacking or shared credentials"
            })

    def check_data_exports(self):
        """Monitor data export activity."""
        since = datetime.now(timezone.utc) - timedelta(hours=24)

        exports = self.db.query(AuditLog).filter(
            and_(
                AuditLog.action == "DATA_EXPORT",
                AuditLog.timestamp >= since
            )
        ).all()

        if len(exports) > 10:  # More than 10 exports in 24h
            self.alerts.append({
                "severity": "medium",
                "title": "High Export Activity",
                "message": f"{len(exports)} data exports in the last 24 hours",
                "action": "Review export logs for suspicious activity"
            })

    def check_plaid_unlinks(self):
        """Alert on Plaid account disconnections."""
        since = datetime.now(timezone.utc) - timedelta(hours=24)

        unlinks = self.db.query(AuditLog).filter(
            and_(
                AuditLog.action == "PLAID_UNLINK",
                AuditLog.timestamp >= since
            )
        ).all()

        if unlinks:
            for log in unlinks:
                user = self.db.query(User).filter(User.id == log.user_id).first()
                self.alerts.append({
                    "severity": "low",
                    "title": "Bank Account Disconnected",
                    "message": f"User {user.email if user else log.user_id} disconnected a bank account",
                    "action": "Normal if user requested, investigate if unexpected"
                })

    def check_password_resets(self):
        """Monitor password reset activity."""
        since = datetime.now(timezone.utc) - timedelta(hours=24)

        resets = self.db.query(AuditLog).filter(
            and_(
                AuditLog.action == "PASSWORD_RESET",
                AuditLog.timestamp >= since
            )
        ).all()

        if len(resets) > 5:  # More than 5 resets in 24h
            self.alerts.append({
                "severity": "medium",
                "title": "High Password Reset Activity",
                "message": f"{len(resets)} password resets in the last 24 hours",
                "action": "Possible credential stuffing attack"
            })

    def run_all_checks(self):
        """Run all security checks."""
        print("🔍 Running security checks...")

        self.check_failed_logins()
        self.check_2fa_disabled()
        self.check_admin_without_2fa()
        self.check_suspicious_access_patterns()
        self.check_data_exports()
        self.check_plaid_unlinks()
        self.check_password_resets()

        return self.alerts

    def format_alert_text(self, alert: Dict) -> str:
        """Format alert for display."""
        severity_emoji = {
            "high": "🚨",
            "medium": "⚠️",
            "low": "ℹ️"
        }

        text = f"{severity_emoji.get(alert['severity'], '⚠️')} {alert['title']}\n"
        text += f"   {alert['message']}\n"
        text += f"   Action: {alert['action']}\n"

        if "users" in alert:
            text += f"   Users: {', '.join(alert['users'])}\n"

        return text

    def send_email_alerts(self, alerts: List[Dict]):
        """Send alerts via email."""
        if not alerts:
            return

        email_to = os.getenv("ALERT_EMAIL")
        if not email_to:
            print("⚠️  ALERT_EMAIL not set - skipping email alerts")
            return

        from app.services.email import send_email
        import asyncio

        subject = f"🔒 Security Alert - {len(alerts)} event(s) detected"
        body = "<h2>Security Monitoring Alert</h2>\n"
        body += f"<p>Detected {len(alerts)} security event(s):</p>\n"
        body += "<ul>\n"

        for alert in alerts:
            body += f"<li><strong>{alert['title']}</strong>: {alert['message']}</li>\n"

        body += "</ul>\n"
        body += "<p>Review the audit logs for full details.</p>\n"

        try:
            asyncio.run(send_email(email_to, subject, body))
            print(f"✓ Email alert sent to {email_to}")
        except Exception as e:
            print(f"✗ Failed to send email: {e}")

    def send_slack_alerts(self, alerts: List[Dict]):
        """Send alerts to Slack."""
        if not alerts:
            return

        webhook_url = os.getenv("SLACK_WEBHOOK_URL")
        if not webhook_url:
            print("⚠️  SLACK_WEBHOOK_URL not set - skipping Slack alerts")
            return

        import requests

        text = f"🔒 *Security Monitoring Alert*\nDetected {len(alerts)} security event(s):\n\n"

        for alert in alerts:
            severity_emoji = {"high": "🚨", "medium": "⚠️", "low": "ℹ️"}
            text += f"{severity_emoji.get(alert['severity'], '⚠️')} *{alert['title']}*\n"
            text += f"   {alert['message']}\n"
            text += f"   _Action: {alert['action']}_\n\n"

        payload = {
            "text": text,
            "username": "Finance Tracker Security",
            "icon_emoji": ":lock:"
        }

        try:
            response = requests.post(webhook_url, json=payload)
            if response.status_code == 200:
                print("✓ Slack alert sent")
            else:
                print(f"✗ Slack alert failed: {response.status_code}")
        except Exception as e:
            print(f"✗ Failed to send Slack alert: {e}")

    def cleanup(self):
        """Cleanup resources."""
        self.db.close()


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Monitor security events")
    parser.add_argument("--email", action="store_true", help="Send email alerts")
    parser.add_argument("--slack", action="store_true", help="Send Slack alerts")
    parser.add_argument("--quiet", action="store_true", help="Only output if alerts found")

    args = parser.parse_args()

    monitor = SecurityMonitor()

    try:
        alerts = monitor.run_all_checks()

        if not args.quiet:
            print(f"\n{'='*60}")
            print(f"SECURITY MONITORING REPORT")
            print(f"{'='*60}")
            print(f"Time: {datetime.now().isoformat()}")
            print(f"Alerts: {len(alerts)}")
            print(f"{'='*60}\n")

        if alerts:
            for alert in alerts:
                print(monitor.format_alert_text(alert))

            if args.email:
                monitor.send_email_alerts(alerts)

            if args.slack:
                monitor.send_slack_alerts(alerts)

            sys.exit(1)  # Exit with error code if alerts found
        else:
            if not args.quiet:
                print("✓ No security alerts detected\n")
            sys.exit(0)

    except KeyboardInterrupt:
        print("\n✗ Aborted by user")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Error: {e}")
        sys.exit(1)
    finally:
        monitor.cleanup()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Checks the SMTP credentials the hosted Supabase project is meant to use.

Reads MORAKI_SMTP_* from .env (gitignored) and reports, step by step, what the
mail server says: whether it connects, whether the credentials are accepted,
and whether it will send as the address configured. Supabase only ever reports
"500 Error sending ...", so this is the quickest way to see the real reason.

    python3 scripts/check-smtp.py                # connect and sign in only
    python3 scripts/check-smtp.py you@domain.tld # also send one test message

Nothing secret is printed: the user name is masked and the password is never
shown or logged.
"""

import re
import smtplib
import ssl
import sys
from email.message import EmailMessage
from pathlib import Path

DEFAULTS = {"MORAKI_SMTP_HOST": "smtp.gmail.com", "MORAKI_SMTP_PORT": "587"}


def env() -> dict[str, str]:
    values = dict(DEFAULTS)
    path = Path(__file__).resolve().parent.parent / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip("\"'")
    return values


def mask(address: str) -> str:
    return re.sub(r"^(.).*(.@.*)$", r"\1…\2", address) if "@" in address else "…"


def main() -> int:
    values = env()
    host = values.get("MORAKI_SMTP_HOST", "")
    port = int(values.get("MORAKI_SMTP_PORT", "587"))
    user = values.get("MORAKI_SMTP_USER", "")
    password = values.get("MORAKI_SMTP_PASS", "")
    sender = values.get("MORAKI_SMTP_SENDER", user)
    if not user or not password:
        print("Set MORAKI_SMTP_USER and MORAKI_SMTP_PASS in .env first (see .env.example).")
        return 2

    print(f"host: {host}:{port}   user: {mask(user)}   sender: {mask(sender)}")
    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            server.starttls(context=ssl.create_default_context())
        server.ehlo()
        print("connected, encrypted")
    except Exception as error:  # noqa: BLE001 - the message is the point
        print(f"couldn't connect: {type(error).__name__}: {error}")
        return 1

    try:
        server.login(user, password)
        print("credentials accepted")
    except smtplib.SMTPAuthenticationError as error:
        print(f"credentials refused: {error.smtp_code} {error.smtp_error.decode(errors='replace')}")
        print("535 5.7.8 usually means an ordinary password: Gmail needs an App Password")
        return 1
    except Exception as error:  # noqa: BLE001
        print(f"sign in failed: {type(error).__name__}: {error}")
        return 1

    if len(sys.argv) > 1:
        message = EmailMessage()
        message["From"] = sender
        message["To"] = sys.argv[1]
        message["Subject"] = "Moraki SMTP check"
        message.set_content("If this arrived, Supabase can send sign-in codes with these settings.")
        try:
            server.send_message(message)
            print(f"sent a test message to {mask(sys.argv[1])}")
        except smtplib.SMTPRecipientsRefused as error:
            print(f"the address was refused: {error.recipients}")
            return 1
        except smtplib.SMTPSenderRefused as error:
            print(f"sending as that address was refused: {error.smtp_code} {error.smtp_error!r}")
            print("550 5.7.1 usually means the sender isn't the signed-in mailbox or a verified alias")
            return 1
        except Exception as error:  # noqa: BLE001
            print(f"sending failed: {type(error).__name__}: {error}")
            return 1
    server.quit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

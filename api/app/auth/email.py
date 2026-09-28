import httpx
from fastapi import HTTPException
from ..config import get_settings


async def send_email(email: str, code: str) -> None:
    """The address is used only for delivery, never stored or logged by the API."""
    settings = get_settings()
    if not settings.resend_api_key or not settings.resend_from:
        raise HTTPException(503, "Email sign-in is not configured yet")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={"from": settings.resend_from, "to": [email],
                      "subject": "Your SpeakEz sign-in code",
                      "text": f"Your SpeakEz code is {code}. It expires in 10 minutes. If you did not request it, ignore this email."},
            )
            response.raise_for_status()
    except httpx.HTTPError:
        # Provider errors may contain email addresses; do not forward/log them.
        raise HTTPException(503, "Could not send the code. Please try again later.") from None

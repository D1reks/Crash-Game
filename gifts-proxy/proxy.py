import asyncio
import base64
import logging
from contextlib import asynccontextmanager
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pyrogram import Client, raw
from pyrogram.errors import (
    AuthKeyUnregistered,
    SessionExpired,
    SessionRevoked,
    SessionPasswordNeeded,
    Unauthorized,
)

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gifts-proxy")


class GiftsCache:
    def __init__(self, ttl: int = 300):
        self.gifts: dict[str, dict[str, Any]] = {}
        self.last_hash: int = 0
        self.ttl = ttl
        self.last_update: float = 0
        self._lock = asyncio.Lock()

    def is_expired(self) -> bool:
        import time
        return time.time() - self.last_update > self.ttl

    async def update(self, client: Client) -> None:
        async with self._lock:
            if not self.is_expired():
                return

            try:
                result = await client.invoke(
                    raw.functions.payments.GetStarGifts(hash=self.last_hash)
                )

                if isinstance(result, raw.types.payments.StarGiftsNotModified):
                    import time
                    self.last_update = time.time()
                    return

                new_gifts = {}
                for gift in result.gifts:
                    sticker_file_id = None
                    sticker_raw = None
                    sticker = getattr(gift, "sticker", None)
                    if sticker:
                        dc_id = getattr(sticker, "dc_id", 0)
                        media_id = getattr(sticker, "id", 0)
                        access_hash = getattr(sticker, "access_hash", 0)
                        file_reference = getattr(sticker, "file_reference", b"")
                        if all([dc_id, media_id, access_hash, file_reference]):
                            sticker_raw = {
                                "dc_id": dc_id,
                                "id": media_id,
                                "access_hash": access_hash,
                                "file_reference_b64": base64.b64encode(file_reference).decode(),
                            }

                    gift_data = {
                        "id": str(gift.id),
                        "name": getattr(gift, "title", None) or f"Gift #{str(gift.id)[-6:]}",
                        "price": getattr(gift, "stars", 0),
                        "upgrade_price": getattr(gift, "upgrade_stars", None),
                        "total_amount": getattr(gift, "availability_total", None),
                        "limited": getattr(gift, "limited", False),
                        "premium_required": getattr(gift, "require_premium", False),
                        "has_icon": sticker_raw is not None,
                        "sticker_raw": sticker_raw,
                    }
                    new_gifts[str(gift.id)] = gift_data

                self.gifts = new_gifts
                self.last_hash = result.hash
                import time
                self.last_update = time.time()
                logger.info(f"✅ Cache updated: {len(self.gifts)} gifts loaded")

            except Exception as e:
                logger.error(f"Failed to update cache: {e}")
                if not self.gifts:
                    raise


cache = GiftsCache(ttl=300)


class GiftsClient:
    def __init__(self):
        self.client: Optional[Client] = None

    async def start(self):
        import os

        api_id = int(os.getenv("API_ID", 0))
        api_hash = os.getenv("API_HASH", "")
        phone = os.getenv("PHONE_NUMBER", "")
        password = os.getenv("PASSWORD", "")

        if not all([api_id, api_hash, phone]):
            raise ValueError("Missing API_ID, API_HASH or PHONE_NUMBER in .env")

        self.client = Client(
            name="gifts_proxy",
            api_id=api_id,
            api_hash=api_hash,
            phone_number=phone,
            password=password or None,
            workdir="/data",
            in_memory=False,
        )

        phone_code = os.getenv("PHONE_CODE", "").strip()

        if phone_code:
            # Non-interactive auth for containerised environments (no TTY).
            # The caller must supply PHONE_CODE via the environment variable.
            logger.info("PHONE_CODE env var detected — using non-interactive auth flow")
            try:
                await self.client.connect()

                # Request the confirmation code so Telegram gives us a
                # phone_code_hash that is required for sign_in().
                sent = await self.client.send_code(phone)
                logger.info("Confirmation code requested from Telegram")

                try:
                    signed_in = await self.client.sign_in(
                        phone_number=phone,
                        phone_code_hash=sent.phone_code_hash,
                        phone_code=phone_code,
                    )
                    logger.info(f"✅ Signed in as {signed_in.first_name} [{signed_in.id}]")
                except SessionPasswordNeeded:
                    # Account has two-step verification enabled.
                    if not password:
                        raise ValueError(
                            "Two-step verification is enabled but PASSWORD env var is not set"
                        )
                    logger.info("Two-step verification required — using PASSWORD")
                    signed_in = await self.client.check_password(password)
                    logger.info(f"✅ Signed in (2FA) as {signed_in.first_name} [{signed_in.id}]")

            except (AuthKeyUnregistered, SessionExpired, SessionRevoked, Unauthorized) as e:
                logger.error(f"Auth error: {e}")
                raise
        else:
            # Interactive fallback — works locally when a TTY is available.
            logger.info("No PHONE_CODE env var — falling back to interactive auth (requires TTY)")
            try:
                await self.client.start()
                me = await self.client.get_me()
                logger.info(f"✅ Logged in as @{me.username or me.first_name} [{me.id}]")
            except (AuthKeyUnregistered, SessionExpired, SessionRevoked, Unauthorized) as e:
                logger.error(f"Auth error: {e}")
                raise

    async def stop(self):
        if self.client:
            await self.client.stop()


gifts_client = GiftsClient()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await gifts_client.start()
        await cache.update(gifts_client.client)
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise
    yield
    await gifts_client.stop()


app = FastAPI(lifespan=lifespan, title="Gifts Proxy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "gifts_count": len(cache.gifts)}


@app.get("/api/gifts")
async def get_gifts():
    if not gifts_client.client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    await cache.update(gifts_client.client)
    return {"success": True, "count": len(cache.gifts), "gifts": list(cache.gifts.values())}


@app.get("/api/gifts/{gift_id}")
async def get_gift(gift_id: str):
    if not gifts_client.client:
        raise HTTPException(status_code=503, detail="Client not initialized")
    await cache.update(gifts_client.client)
    gift = cache.gifts.get(gift_id)
    if not gift:
        raise HTTPException(status_code=404, detail="Gift not found")
    return {"success": True, "gift": gift}


@app.get("/api/gifts/{gift_id}/icon")
async def get_gift_icon(gift_id: str):
    if not gifts_client.client:
        raise HTTPException(status_code=503, detail="Client not initialized")

    gift = cache.gifts.get(gift_id)
    if not gift:
        raise HTTPException(status_code=404, detail="Gift not found")

    sticker_raw = gift.get("sticker_raw")
    if not sticker_raw:
        raise HTTPException(status_code=404, detail="No icon available")

    try:
        from pyrogram.types import InputDocumentFileLocation

        file_location = InputDocumentFileLocation(
            dc_id=sticker_raw["dc_id"],
            id=sticker_raw["id"],
            access_hash=sticker_raw["access_hash"],
            file_reference=base64.b64decode(sticker_raw["file_reference_b64"]),
        )

        file_bytes = await gifts_client.client.download_media(file_location, in_memory=True)

        return Response(
            content=bytes(file_bytes) if file_bytes else b"",
            media_type="image/webp",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except Exception as e:
        logger.error(f"Failed to download icon for gift {gift_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
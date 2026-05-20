import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pyrogram import Client, raw
from pyrogram.errors import (
    AuthKeyUnregistered,
    SessionExpired,
    SessionRevoked,
    Unauthorized,
)

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gifts-proxy")

# ==================== Кэш подарков ====================


class GiftsCache:
    """Кэш подарков с автообновлением"""

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
                    logger.debug("Gift list unchanged, keeping cache")
                    import time
                    self.last_update = time.time()
                    return

                new_gifts = {}
                for gift in result.gifts:
                    gift_data = {
                        "id": str(gift.id),
                        "name": getattr(gift, "title", None) or f"Gift #{str(gift.id)[-6:]}",
                        "price": getattr(gift, "stars", 0),
                        "upgrade_price": getattr(gift, "upgrade_stars", None),
                        "total_amount": getattr(gift, "availability_total", None),
                        "limited": getattr(gift, "limited", False),
                        "premium_required": getattr(gift, "require_premium", False),
                    }
                    new_gifts[str(gift.id)] = gift_data

                self.gifts = new_gifts
                self.last_hash = result.hash
                import time
                self.last_update = time.time()
                logger.info(f"✅ Cache updated: {len(self.gifts)} gifts loaded")

                sample = list(self.gifts.values())[:5]
                logger.info("📋 Sample: " + ", ".join(
                    f"{g['name']} ({g['price']}⭐)" for g in sample
                ))

            except Exception as e:
                logger.error(f"Failed to update cache: {e}")
                if not self.gifts:
                    raise


cache = GiftsCache(ttl=300)


# ==================== Клиент ====================


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
    workdir="./data",
    in_memory=False,
)

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
            logger.info("Client stopped")


gifts_client = GiftsClient()


# ==================== FastAPI ====================


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
    return {
        "status": "ok",
        "gifts_count": len(cache.gifts),
        "client_ready": gifts_client.client is not None,
    }


@app.get("/api/gifts")
async def get_gifts():
    if not gifts_client.client:
        raise HTTPException(status_code=503, detail="Client not initialized")

    await cache.update(gifts_client.client)

    return {
        "success": True,
        "count": len(cache.gifts),
        "gifts": list(cache.gifts.values()),
    }


@app.get("/api/gifts/{gift_id}")
async def get_gift(gift_id: str):
    if not gifts_client.client:
        raise HTTPException(status_code=503, detail="Client not initialized")

    await cache.update(gifts_client.client)

    gift = cache.gifts.get(gift_id)
    if not gift:
        raise HTTPException(status_code=404, detail="Gift not found")

    return {"success": True, "gift": gift}


@app.get("/api/gifts/search")
async def search_gifts(q: str = "", min_price: int = 0, max_price: int = 999999999):
    if not gifts_client.client:
        raise HTTPException(status_code=503, detail="Client not initialized")

    await cache.update(gifts_client.client)

    results = []
    for gift in cache.gifts.values():
        if min_price <= gift["price"] <= max_price:
            if not q or q.lower() in gift["name"].lower():
                results.append(gift)

    return {"success": True, "count": len(results), "gifts": results}


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.getenv("PROXY_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
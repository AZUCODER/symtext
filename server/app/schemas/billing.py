from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Literal

from pydantic import BaseModel, Field, field_validator


BillingProvider = Literal["paypal", "alipay"]
BillingMode = Literal["sandbox", "live"]
BillingTransactionType = Literal["charge", "renewal", "refund", "adjustment"]
BillingTransactionStatus = Literal["pending", "succeeded", "failed", "refunded"]


class BillingGatewayProviderStatus(BaseModel):
    provider: BillingProvider
    configured: bool
    enabled: bool
    mode: BillingMode


class BillingGatewayEditableFields(BaseModel):
    app_id: str = ""
    secret: str = ""
    webhook_secret: str = ""
    has_app_id: bool = False
    has_secret: bool = False
    has_webhook_secret: bool = False


class BillingGatewayConfigResponse(BaseModel):
    selected_provider: BillingProvider
    providers: list[BillingGatewayProviderStatus]
    mode: BillingMode
    enabled: bool
    editable: BillingGatewayEditableFields


class BillingGatewayConfigUpdateRequest(BaseModel):
    selected_provider: BillingProvider
    mode: BillingMode
    enabled: bool
    app_id: str | None = Field(default=None, max_length=512)
    secret: str | None = Field(default=None, max_length=4096)
    webhook_secret: str | None = Field(default=None, max_length=4096)


class BillingTransactionItem(BaseModel):
    id: str
    customer_id: str | None
    user_email: str | None
    provider: BillingProvider
    provider_transaction_id: str
    provider_order_id: str | None
    provider_subscription_id: str | None
    transaction_type: BillingTransactionType
    currency: str
    amount_minor: int
    status_canonical: BillingTransactionStatus
    status_provider_raw: str | None
    occurred_at: datetime


class BillingTransactionListResponse(BaseModel):
    items: list[BillingTransactionItem]
    total: int


class BillingWebhookProcessResponse(BaseModel):
    accepted: bool = True
    duplicate: bool = False
    provider_event_id: str


def amount_to_minor(value: str | int | float | None) -> int:
    if value is None:
        return 0
    if isinstance(value, int):
        return value

    try:
        decimal_value = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return 0

    return int(decimal_value * 100)


class BillingTransactionQuery(BaseModel):
    provider: BillingProvider | None = None
    status: BillingTransactionStatus | None = None
    customer: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    limit: int = Field(default=100, ge=1, le=500)

    @field_validator("customer", mode="before")
    @classmethod
    def normalize_customer(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

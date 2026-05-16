import base64
import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.models import AppSetting, BillingAuditLog, BillingCustomer, BillingTransaction, BillingWebhookEvent
from app.schemas.billing import (
    BillingGatewayConfigResponse,
    BillingGatewayConfigUpdateRequest,
    BillingGatewayEditableFields,
    BillingGatewayProviderStatus,
    BillingMode,
    BillingProvider,
    BillingReconcileItem,
    BillingReconcileResponse,
    BillingTransactionItem,
    BillingTransactionListResponse,
    BillingTransactionQuery,
    amount_to_minor,
)


SUPPORTED_PROVIDERS: tuple[BillingProvider, ...] = ("paypal", "alipay")
SELECTED_PROVIDER_KEY = "billing.selected_provider"
WEBHOOK_TOLERANCE_SECONDS = 300


@dataclass(frozen=True)
class ProviderRuntimeConfig:
    mode: BillingMode
    enabled: bool
    app_id: str
    secret: str
    webhook_secret: str


@dataclass(frozen=True)
class WebhookProcessResult:
    provider_event_id: str
    duplicate: bool


def _write_audit_log(
    db: Session,
    *,
    actor_email: str,
    action: str,
    entity_type: str,
    entity_id: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    db.add(
        BillingAuditLog(
            actor_email=actor_email,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=json.dumps(metadata or {}, sort_keys=True),
        )
    )


def _setting_key(provider: BillingProvider, field: str) -> str:
    return f"billing.{provider}.{field}"


def _fernet(settings: Settings) -> Fernet:
    configured_key = settings.oss_config_encryption_key.strip()
    if configured_key:
        return Fernet(configured_key.encode("utf-8"))

    digest = hashlib.sha256(settings.jwt_secret_key.encode("utf-8")).digest()
    derived_key = base64.urlsafe_b64encode(digest)
    return Fernet(derived_key)


def _encrypt_secret(settings: Settings, value: str) -> str:
    return _fernet(settings).encrypt(value.encode("utf-8")).decode("utf-8")


def _decrypt_secret(settings: Settings, value: str) -> str:
    try:
        return _fernet(settings).decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


def _upsert_setting(db: Session, *, key: str, value: str, is_secret: bool) -> None:
    item = db.get(AppSetting, key)
    if item is None:
        db.add(AppSetting(key=key, value=value, is_secret=is_secret))
        return

    item.value = value
    item.is_secret = is_secret


def _get_setting(db: Session, key: str) -> AppSetting | None:
    return db.get(AppSetting, key)


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "*" * len(value)
    return f"{'*' * (len(value) - 4)}{value[-4:]}"


def _get_provider_runtime_config(db: Session, settings: Settings, provider: BillingProvider) -> ProviderRuntimeConfig:
    mode_setting = _get_setting(db, _setting_key(provider, "mode"))
    enabled_setting = _get_setting(db, _setting_key(provider, "enabled"))
    app_id_setting = _get_setting(db, _setting_key(provider, "app_id"))
    secret_setting = _get_setting(db, _setting_key(provider, "secret"))
    webhook_setting = _get_setting(db, _setting_key(provider, "webhook_secret"))

    mode: BillingMode = "sandbox"
    if mode_setting and mode_setting.value in {"sandbox", "live"}:
        mode = mode_setting.value  # type: ignore[assignment]

    enabled = bool(enabled_setting and enabled_setting.value.lower() == "true")
    app_id = _decrypt_secret(settings, app_id_setting.value) if app_id_setting else ""
    secret = _decrypt_secret(settings, secret_setting.value) if secret_setting else ""
    webhook_secret = _decrypt_secret(settings, webhook_setting.value) if webhook_setting else ""

    return ProviderRuntimeConfig(
        mode=mode,
        enabled=enabled,
        app_id=app_id.strip(),
        secret=secret.strip(),
        webhook_secret=webhook_secret.strip(),
    )


def _is_provider_configured(runtime: ProviderRuntimeConfig) -> bool:
    return bool(runtime.enabled and runtime.app_id and runtime.secret and runtime.webhook_secret)


def _get_selected_provider(db: Session) -> BillingProvider:
    persisted = _get_setting(db, SELECTED_PROVIDER_KEY)
    if persisted and persisted.value in SUPPORTED_PROVIDERS:
        return persisted.value  # type: ignore[return-value]
    return "paypal"


def get_billing_gateway_config(db: Session, settings: Settings) -> BillingGatewayConfigResponse:
    selected = _get_selected_provider(db)
    selected_runtime = _get_provider_runtime_config(db, settings, selected)

    provider_statuses = []
    for provider in SUPPORTED_PROVIDERS:
        runtime = _get_provider_runtime_config(db, settings, provider)
        provider_statuses.append(
            BillingGatewayProviderStatus(
                provider=provider,
                configured=_is_provider_configured(runtime),
                enabled=runtime.enabled,
                mode=runtime.mode,
            )
        )

    return BillingGatewayConfigResponse(
        selected_provider=selected,
        providers=provider_statuses,
        mode=selected_runtime.mode,
        enabled=selected_runtime.enabled,
        editable=BillingGatewayEditableFields(
            app_id=_mask_secret(selected_runtime.app_id),
            secret="",
            webhook_secret="",
            has_app_id=bool(selected_runtime.app_id),
            has_secret=bool(selected_runtime.secret),
            has_webhook_secret=bool(selected_runtime.webhook_secret),
        ),
    )


def update_billing_gateway_config(
    db: Session,
    settings: Settings,
    payload: BillingGatewayConfigUpdateRequest,
    actor_email: str | None = None,
) -> BillingGatewayConfigResponse:
    _upsert_setting(db, key=SELECTED_PROVIDER_KEY, value=payload.selected_provider, is_secret=False)
    _upsert_setting(
        db,
        key=_setting_key(payload.selected_provider, "mode"),
        value=payload.mode,
        is_secret=False,
    )
    _upsert_setting(
        db,
        key=_setting_key(payload.selected_provider, "enabled"),
        value="true" if payload.enabled else "false",
        is_secret=False,
    )

    if payload.app_id is not None:
        _upsert_setting(
            db,
            key=_setting_key(payload.selected_provider, "app_id"),
            value=_encrypt_secret(settings, payload.app_id.strip()),
            is_secret=True,
        )

    if payload.secret is not None:
        _upsert_setting(
            db,
            key=_setting_key(payload.selected_provider, "secret"),
            value=_encrypt_secret(settings, payload.secret.strip()),
            is_secret=True,
        )

    if payload.webhook_secret is not None:
        _upsert_setting(
            db,
            key=_setting_key(payload.selected_provider, "webhook_secret"),
            value=_encrypt_secret(settings, payload.webhook_secret.strip()),
            is_secret=True,
        )

    _write_audit_log(
        db,
        actor_email=actor_email or "system@billing",
        action="gateway.config.updated",
        entity_type="billing.gateway",
        entity_id=payload.selected_provider,
        metadata={
            "mode": payload.mode,
            "enabled": payload.enabled,
            "updated_fields": {
                "app_id": payload.app_id is not None,
                "secret": payload.secret is not None,
                "webhook_secret": payload.webhook_secret is not None,
            },
        },
    )

    db.commit()
    return get_billing_gateway_config(db, settings)


def ensure_billing_customer(db: Session, user_email: str) -> BillingCustomer:
    existing = db.execute(select(BillingCustomer).where(BillingCustomer.user_email == user_email)).scalar_one_or_none()
    if existing is not None:
        return existing

    created = BillingCustomer(user_email=user_email)
    db.add(created)
    db.flush()
    return created


def get_billing_transactions(db: Session, query: BillingTransactionQuery) -> BillingTransactionListResponse:
    conditions = []
    if query.provider:
        conditions.append(BillingTransaction.provider == query.provider)
    if query.status:
        conditions.append(BillingTransaction.status_canonical == query.status)
    if query.start_time:
        conditions.append(BillingTransaction.occurred_at >= query.start_time)
    if query.end_time:
        conditions.append(BillingTransaction.occurred_at <= query.end_time)
    if query.customer:
        conditions.append(
            or_(
                BillingTransaction.payer_email.ilike(f"%{query.customer}%"),
                BillingCustomer.user_email.ilike(f"%{query.customer}%"),
                BillingCustomer.id == query.customer,
            )
        )

    base_stmt = select(BillingTransaction, BillingCustomer).join(
        BillingCustomer,
        BillingTransaction.customer_id == BillingCustomer.id,
        isouter=True,
    )
    if conditions:
        base_stmt = base_stmt.where(*conditions)

    count_stmt = select(func.count()).select_from(BillingTransaction).join(
        BillingCustomer,
        BillingTransaction.customer_id == BillingCustomer.id,
        isouter=True,
    )
    if conditions:
        count_stmt = count_stmt.where(*conditions)

    total = db.execute(count_stmt).scalar_one()
    rows = db.execute(base_stmt.order_by(BillingTransaction.occurred_at.desc()).limit(query.limit)).all()

    items = [
        BillingTransactionItem(
            id=txn.id,
            customer_id=customer.id if customer else txn.customer_id,
            user_email=customer.user_email if customer else txn.payer_email,
            provider=txn.provider,
            provider_transaction_id=txn.provider_transaction_id,
            provider_order_id=txn.provider_order_id,
            provider_subscription_id=txn.provider_subscription_id,
            transaction_type=txn.transaction_type,
            currency=txn.currency,
            amount_minor=txn.amount_minor,
            status_canonical=txn.status_canonical,
            status_provider_raw=txn.status_provider_raw,
            occurred_at=txn.occurred_at,
        )
        for txn, customer in rows
    ]

    return BillingTransactionListResponse(items=items, total=total)


def _get_paypal_api_base(mode: BillingMode) -> str:
    return "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com"


def _verify_paypal_webhook(
    runtime: ProviderRuntimeConfig,
    headers: dict[str, str],
    payload: dict[str, Any],
) -> bool:
    required_headers = {
        "paypal-auth-algo",
        "paypal-cert-url",
        "paypal-transmission-id",
        "paypal-transmission-sig",
        "paypal-transmission-time",
    }
    if not all(header in headers for header in required_headers):
        return False

    api_base = _get_paypal_api_base(runtime.mode)
    with httpx.Client(timeout=15.0) as client:
        token_response = client.post(
            f"{api_base}/v1/oauth2/token",
            auth=(runtime.app_id, runtime.secret),
            data={"grant_type": "client_credentials"},
        )
        if token_response.status_code != 200:
            return False

        access_token = token_response.json().get("access_token", "")
        if not access_token:
            return False

        verify_response = client.post(
            f"{api_base}/v1/notifications/verify-webhook-signature",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "auth_algo": headers["paypal-auth-algo"],
                "cert_url": headers["paypal-cert-url"],
                "transmission_id": headers["paypal-transmission-id"],
                "transmission_sig": headers["paypal-transmission-sig"],
                "transmission_time": headers["paypal-transmission-time"],
                "webhook_id": runtime.webhook_secret,
                "webhook_event": payload,
            },
        )
        if verify_response.status_code != 200:
            return False

        body = verify_response.json()
        return body.get("verification_status") == "SUCCESS"


def _parse_paypal_transmission_time(value: str) -> datetime | None:
    trimmed = value.strip()
    if not trimmed:
        return None
    normalized = trimmed.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _is_recent_paypal_webhook(headers: dict[str, str]) -> bool:
    transmission_time = headers.get("paypal-transmission-time", "")
    parsed = _parse_paypal_transmission_time(transmission_time)
    if parsed is None:
        return False
    now = datetime.now(UTC)
    return abs((now - parsed).total_seconds()) <= WEBHOOK_TOLERANCE_SECONDS


def _normalize_alipay_public_key(raw_key: str) -> str:
    stripped = "".join(raw_key.strip().split())
    if "BEGINPUBLICKEY" in stripped or "BEGINRSAPUBLICKEY" in stripped:
        return raw_key

    lines = [stripped[i : i + 64] for i in range(0, len(stripped), 64)]
    return "-----BEGIN PUBLIC KEY-----\n" + "\n".join(lines) + "\n-----END PUBLIC KEY-----\n"


def _build_alipay_sign_string(payload: dict[str, str]) -> str:
    pairs: list[tuple[str, str]] = []
    for key, value in payload.items():
        if key in {"sign", "sign_type"}:
            continue
        if value is None or value == "":
            continue
        pairs.append((key, value))

    pairs.sort(key=lambda item: item[0])
    return "&".join([f"{key}={value}" for key, value in pairs])


def _verify_alipay_signature(runtime: ProviderRuntimeConfig, payload: dict[str, str]) -> bool:
    signature = payload.get("sign", "").strip()
    if not signature:
        return False

    sign_type = payload.get("sign_type", "RSA2").upper()
    algorithm = hashes.SHA256() if sign_type == "RSA2" else hashes.SHA1()

    try:
        public_key = serialization.load_pem_public_key(_normalize_alipay_public_key(runtime.webhook_secret).encode("utf-8"))
        public_key.verify(
            base64.b64decode(signature),
            _build_alipay_sign_string(payload).encode("utf-8"),
            padding.PKCS1v15(),
            algorithm,
        )
    except Exception:
        return False

    return True


def _parse_alipay_notify_time(value: str) -> datetime | None:
    trimmed = value.strip()
    if not trimmed:
        return None
    try:
        parsed = datetime.strptime(trimmed, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None
    return parsed.replace(tzinfo=UTC)


def _is_recent_alipay_webhook(payload: dict[str, str]) -> bool:
    parsed = _parse_alipay_notify_time(payload.get("notify_time", ""))
    if parsed is None:
        return False
    now = datetime.now(UTC)
    return abs((now - parsed).total_seconds()) <= WEBHOOK_TOLERANCE_SECONDS


def _canonical_status(event_type: str, provider_status: str) -> str:
    upper_event = event_type.upper()
    upper_status = provider_status.upper()
    if "REFUND" in upper_event or "REFUND" in upper_status:
        return "refunded"
    if "FAIL" in upper_event or "FAIL" in upper_status or "CLOSE" in upper_status:
        return "failed"
    if "PENDING" in upper_event or "WAIT" in upper_status:
        return "pending"
    return "succeeded"


def _canonical_transaction_type(event_type: str) -> str:
    upper_event = event_type.upper()
    if "REFUND" in upper_event:
        return "refund"
    if "SUBSCRIPTION" in upper_event or "RECURR" in upper_event or "BILLING" in upper_event:
        return "renewal"
    return "charge"


def _create_webhook_event(
    db: Session,
    *,
    provider: BillingProvider,
    provider_event_id: str,
    event_type: str,
    payload_sha256: str,
) -> BillingWebhookEvent | None:
    existing = db.execute(
        select(BillingWebhookEvent).where(
            BillingWebhookEvent.provider == provider,
            BillingWebhookEvent.provider_event_id == provider_event_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return None

    event = BillingWebhookEvent(
        provider=provider,
        provider_event_id=provider_event_id,
        event_type=event_type,
        signature_verified=True,
        payload_sha256=payload_sha256,
        processed=False,
    )
    db.add(event)
    db.flush()
    return event


def process_paypal_webhook(
    db: Session,
    settings: Settings,
    headers: dict[str, str],
    payload: dict[str, Any],
) -> WebhookProcessResult:
    runtime = _get_provider_runtime_config(db, settings, "paypal")
    if not _is_provider_configured(runtime):
        raise ValueError("PayPal gateway is not fully configured")

    if not _is_recent_paypal_webhook(headers):
        raise ValueError("PayPal webhook rejected: transmission time is outside replay window")

    if not _verify_paypal_webhook(runtime, headers, payload):
        raise ValueError("Invalid PayPal webhook signature")

    provider_event_id = str(payload.get("id", "")).strip()
    if not provider_event_id:
        raise ValueError("Missing PayPal webhook event id")

    event_type = str(payload.get("event_type", "UNKNOWN")).strip() or "UNKNOWN"
    payload_sha256 = hashlib.sha256(str(payload).encode("utf-8")).hexdigest()
    webhook_event = _create_webhook_event(
        db,
        provider="paypal",
        provider_event_id=provider_event_id,
        event_type=event_type,
        payload_sha256=payload_sha256,
    )
    if webhook_event is None:
        return WebhookProcessResult(provider_event_id=provider_event_id, duplicate=True)

    resource = payload.get("resource", {}) or {}
    payer = resource.get("payer", {}) or {}
    email = str(
        payer.get("email_address")
        or payer.get("payer_info", {}).get("email")
        or ""
    ).strip()
    customer_id = None
    if email:
        customer = ensure_billing_customer(db, email)
        customer_id = customer.id

    amount = resource.get("amount", {}) or {}
    amount_value = amount.get("value") or amount.get("total")
    currency = str(amount.get("currency_code") or amount.get("currency") or "USD").upper()

    provider_transaction_id = str(resource.get("id") or provider_event_id)
    related_ids = resource.get("supplementary_data", {}).get("related_ids", {}) if isinstance(resource, dict) else {}
    provider_order_id = str(related_ids.get("order_id") or "") or None
    provider_subscription_id = str(resource.get("billing_agreement_id") or "") or None

    txn = BillingTransaction(
        customer_id=customer_id,
        payer_email=email or None,
        provider="paypal",
        provider_transaction_id=provider_transaction_id,
        provider_order_id=provider_order_id,
        provider_subscription_id=provider_subscription_id,
        transaction_type=_canonical_transaction_type(event_type),
        currency=currency,
        amount_minor=amount_to_minor(amount_value),
        status_canonical=_canonical_status(event_type, str(resource.get("status", ""))),
        status_provider_raw=str(resource.get("status", "")) or None,
        occurred_at=datetime.now(UTC),
    )
    db.add(txn)

    webhook_event.processed = True
    webhook_event.processed_at = datetime.now(UTC)
    _write_audit_log(
        db,
        actor_email="webhook:paypal",
        action="webhook.processed",
        entity_type="billing.webhook",
        entity_id=provider_event_id,
        metadata={"provider": "paypal", "duplicate": False, "event_type": event_type},
    )
    db.commit()
    return WebhookProcessResult(provider_event_id=provider_event_id, duplicate=False)


def process_alipay_webhook(
    db: Session,
    settings: Settings,
    payload: dict[str, str],
) -> WebhookProcessResult:
    runtime = _get_provider_runtime_config(db, settings, "alipay")
    if not _is_provider_configured(runtime):
        raise ValueError("Alipay gateway is not fully configured")

    if not _is_recent_alipay_webhook(payload):
        raise ValueError("Alipay webhook rejected: notify_time is outside replay window")

    if not _verify_alipay_signature(runtime, payload):
        raise ValueError("Invalid Alipay webhook signature")

    provider_event_id = (
        str(payload.get("notify_id") or "").strip()
        or str(payload.get("trade_no") or "").strip()
        or hashlib.sha256(str(payload).encode("utf-8")).hexdigest()
    )
    event_type = str(payload.get("trade_status") or "ALIPAY_EVENT")
    payload_sha256 = hashlib.sha256(str(payload).encode("utf-8")).hexdigest()

    webhook_event = _create_webhook_event(
        db,
        provider="alipay",
        provider_event_id=provider_event_id,
        event_type=event_type,
        payload_sha256=payload_sha256,
    )
    if webhook_event is None:
        return WebhookProcessResult(provider_event_id=provider_event_id, duplicate=True)

    email = str(payload.get("buyer_email") or "").strip()
    customer_id = None
    if email:
        customer = ensure_billing_customer(db, email)
        customer_id = customer.id

    provider_subscription_id = str(payload.get("agreement_no") or "") or None
    provider_order_id = str(payload.get("out_trade_no") or "") or None
    provider_transaction_id = str(payload.get("trade_no") or provider_event_id)
    amount_value = payload.get("total_amount") or payload.get("receipt_amount") or "0"
    provider_status = str(payload.get("trade_status") or "")

    txn = BillingTransaction(
        customer_id=customer_id,
        payer_email=email or None,
        provider="alipay",
        provider_transaction_id=provider_transaction_id,
        provider_order_id=provider_order_id,
        provider_subscription_id=provider_subscription_id,
        transaction_type=_canonical_transaction_type(event_type),
        currency="CNY",
        amount_minor=amount_to_minor(amount_value),
        status_canonical=_canonical_status(event_type, provider_status),
        status_provider_raw=provider_status or None,
        occurred_at=datetime.now(UTC),
    )
    db.add(txn)

    webhook_event.processed = True
    webhook_event.processed_at = datetime.now(UTC)
    _write_audit_log(
        db,
        actor_email="webhook:alipay",
        action="webhook.processed",
        entity_type="billing.webhook",
        entity_id=provider_event_id,
        metadata={"provider": "alipay", "duplicate": False, "event_type": event_type},
    )
    db.commit()
    return WebhookProcessResult(provider_event_id=provider_event_id, duplicate=False)


def _paypal_status_from_capture(
    runtime: ProviderRuntimeConfig,
    provider_transaction_id: str,
) -> str | None:
    api_base = _get_paypal_api_base(runtime.mode)
    with httpx.Client(timeout=15.0) as client:
        token_response = client.post(
            f"{api_base}/v1/oauth2/token",
            auth=(runtime.app_id, runtime.secret),
            data={"grant_type": "client_credentials"},
        )
        if token_response.status_code != 200:
            return None
        access_token = token_response.json().get("access_token", "")
        if not access_token:
            return None

        capture_response = client.get(
            f"{api_base}/v2/payments/captures/{provider_transaction_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if capture_response.status_code != 200:
            return None
        body = capture_response.json()
        return str(body.get("status", "")).strip() or None


def reconcile_pending_transactions(
    db: Session,
    settings: Settings,
    *,
    actor_email: str,
    older_than_minutes: int = 15,
    limit: int = 200,
) -> BillingReconcileResponse:
    threshold = datetime.now(UTC) - timedelta(minutes=max(1, older_than_minutes))
    rows = db.execute(
        select(BillingTransaction)
        .where(BillingTransaction.status_canonical == "pending", BillingTransaction.occurred_at <= threshold)
        .order_by(BillingTransaction.occurred_at.asc())
        .limit(max(1, min(limit, 500)))
    ).scalars().all()

    items: list[BillingReconcileItem] = []
    skipped_unsupported_provider = 0
    updated = 0

    paypal_runtime = _get_provider_runtime_config(db, settings, "paypal")

    for txn in rows:
        if txn.provider != "paypal":
            skipped_unsupported_provider += 1
            continue
        if not _is_provider_configured(paypal_runtime):
            skipped_unsupported_provider += 1
            continue

        provider_status = _paypal_status_from_capture(paypal_runtime, txn.provider_transaction_id)
        if not provider_status:
            continue

        next_status = _canonical_status("PAYMENT.CAPTURE", provider_status)
        if next_status == txn.status_canonical:
            continue

        prev_status = txn.status_canonical
        txn.status_canonical = next_status
        txn.status_provider_raw = provider_status
        updated += 1
        items.append(
            BillingReconcileItem(
                transaction_id=txn.id,
                provider=txn.provider,
                previous_status=prev_status,
                new_status=next_status,
                provider_transaction_id=txn.provider_transaction_id,
            )
        )

    _write_audit_log(
        db,
        actor_email=actor_email,
        action="reconcile.pending_transactions",
        entity_type="billing.reconcile",
        entity_id=datetime.now(UTC).isoformat(),
        metadata={
            "scanned": len(rows),
            "updated": updated,
            "skipped_unsupported_provider": skipped_unsupported_provider,
        },
    )
    db.commit()

    return BillingReconcileResponse(
        scanned=len(rows),
        updated=updated,
        skipped_unsupported_provider=skipped_unsupported_provider,
        items=items,
    )

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.schemas.auth import UserProfile
from app.schemas.billing import (
    BillingGatewayConfigResponse,
    BillingGatewayConfigUpdateRequest,
    BillingPricingPlansResponse,
    BillingProvider,
    BillingReconcileResponse,
    BillingTransactionListResponse,
    BillingTransactionQuery,
    BillingTransactionStatus,
    BillingWebhookProcessResponse,
)
from app.services.billing_service import (
    get_billing_gateway_config,
    get_pricing_plans,
    get_billing_transactions,
    process_alipay_webhook,
    process_paypal_webhook,
    reconcile_pending_transactions,
    update_billing_gateway_config,
)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plans", response_model=BillingPricingPlansResponse)
def list_pricing_plans() -> BillingPricingPlansResponse:
    return get_pricing_plans()


@router.get("/config", response_model=BillingGatewayConfigResponse)
def get_billing_config(
    current_user: UserProfile = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> BillingGatewayConfigResponse:
    _ = current_user
    settings = get_settings()
    return get_billing_gateway_config(db, settings)


@router.put("/config", response_model=BillingGatewayConfigResponse)
def update_billing_config(
    payload: BillingGatewayConfigUpdateRequest,
    current_user: UserProfile = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> BillingGatewayConfigResponse:
    settings = get_settings()
    return update_billing_gateway_config(db, settings, payload, actor_email=current_user.email)


@router.get("/transactions", response_model=BillingTransactionListResponse)
def list_billing_transactions(
    provider: BillingProvider | None = Query(default=None),
    status: BillingTransactionStatus | None = Query(default=None),
    customer: str | None = Query(default=None),
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: UserProfile = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> BillingTransactionListResponse:
    _ = current_user
    query = BillingTransactionQuery(
        provider=provider,
        status=status,
        customer=customer,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
    )
    return get_billing_transactions(db, query)


@router.post("/reconcile", response_model=BillingReconcileResponse)
def reconcile_billing_transactions(
    older_than_minutes: int = Query(default=15, ge=1, le=1440),
    limit: int = Query(default=200, ge=1, le=500),
    current_user: UserProfile = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> BillingReconcileResponse:
    settings = get_settings()
    return reconcile_pending_transactions(
        db,
        settings,
        actor_email=current_user.email,
        older_than_minutes=older_than_minutes,
        limit=limit,
    )


@router.post("/webhooks/paypal", response_model=BillingWebhookProcessResponse)
async def handle_paypal_webhook(request: Request, db: Session = Depends(get_db)) -> BillingWebhookProcessResponse:
    payload = await request.json()
    settings = get_settings()
    headers = {key.lower(): value for key, value in request.headers.items()}
    try:
        result = process_paypal_webhook(db, settings, headers, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return BillingWebhookProcessResponse(provider_event_id=result.provider_event_id, duplicate=result.duplicate)


@router.post("/webhooks/alipay", response_model=BillingWebhookProcessResponse)
async def handle_alipay_webhook(request: Request, db: Session = Depends(get_db)) -> BillingWebhookProcessResponse:
    body = await request.body()
    form_payload: dict[str, str] = {}
    if body:
        try:
            form_data = await request.form()
            form_payload = {str(k): str(v) for k, v in form_data.items()}
        except Exception:
            form_payload = {}

    settings = get_settings()
    try:
        result = process_alipay_webhook(db, settings, form_payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return BillingWebhookProcessResponse(provider_event_id=result.provider_event_id, duplicate=result.duplicate)

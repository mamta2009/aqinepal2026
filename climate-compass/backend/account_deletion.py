"""Hard-delete a registrant contact and scrub related personal data."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import HTTPException


async def delete_contact_and_related(db: Any, contact_id: str) -> dict[str, Any]:
    """
    Permanently remove a ``contacts`` document and related personal rows.

    - Deletes consent audit rows, notification logs, and shared-alert dispatch logs.
    - Anonymizes ``action_logs`` (clears ``contact_id`` / email hash) so facility
      preparedness history remains without PII.
    - Deletes the contact (frees the unique email for re-registration).

    Raises HTTPException 400/404 on invalid or missing id.
    """
    cid = (contact_id or "").strip()
    try:
        oid = ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid contact_id") from exc

    existing = await db.contacts.find_one({"_id": oid}, {"_id": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Contact not found")

    d_co = await db.consent_records.delete_many({"contact_id": cid})
    d_nl = await db.notification_logs.delete_many({"recipient_id": cid})
    d_sd = await db.shared_alert_dispatch_log.delete_many(
        {"initiator_contact_id": cid}
    )
    a_res = await db.action_logs.update_many(
        {"contact_id": cid},
        {
            "$set": {
                "contact_id": None,
                "reported_by_email_hash": None,
                "anonymized_at": datetime.utcnow(),
                "anonymized_reason": "account_deletion",
            }
        },
    )
    d_ct = await db.contacts.delete_one({"_id": oid})
    if d_ct.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")

    return {
        "success": True,
        "contact_removed": True,
        "consent_records_removed": int(d_co.deleted_count),
        "notification_logs_removed": int(d_nl.deleted_count),
        "shared_alert_dispatch_logs_removed": int(d_sd.deleted_count),
        "action_logs_anonymized": int(a_res.modified_count),
    }

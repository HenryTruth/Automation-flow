# Handover API — Frontend Integration Reference

**Base URL:** `https://api.handover.ng` (production) · `http://localhost:3333` (local dev)

**Version:** v1 · **Style:** REST/JSON · **Encoding:** UTF-8

---

## Contents

1. [Authentication](#1-authentication)
2. [Response Envelope](#2-response-envelope)
3. [Error Codes](#3-error-codes)
4. [User Profile](#4-user-profile)
5. [Identity Verification](#5-identity-verification)
6. [Listings](#6-listings)
7. [Handovers](#7-handovers)
8. [Handover Manual](#8-handover-manual)
9. [Move-In Checklist](#9-move-in-checklist)
10. [Tenancy Agreement](#10-tenancy-agreement)
11. [Disputes](#11-disputes)
12. [Refunds](#12-refunds)
13. [Inbox & Messaging](#13-inbox--messaging)
14. [Admin](#14-admin)
15. [WebSocket — Live Chat](#15-websocket--live-chat)

---

## 1. Authentication

All endpoints except `POST /auth/*` require a Bearer token.

```
Authorization: Bearer <access_token>
```

Access tokens expire in **15 minutes**. Use the refresh token to rotate silently.

---

### POST /auth/request-otp

Sends a 6-digit OTP to the phone number via SMS.

**Rate limit:** 3 requests per phone number per 10 minutes.

```json
// Request
{
  "phone": "+2348012345678"   // E.164 format, Nigerian numbers only
}
```

```json
// Response 200
{
  "data": {
    "expires_in": 120         // seconds before OTP expires
  }
}
```

**Errors**

| Status | When |
|---|---|
| `400` | Phone number invalid or not in E.164 format |
| `429` | Rate limit hit — wait 10 minutes |

---

### POST /auth/verify-otp

Verifies the OTP. Creates the user on first login.

```json
// Request
{
  "phone": "+2348012345678",
  "otp": "597376"
}
```

```json
// Response 200
{
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "is_new_user": true,
    "user": {
      "id": "b1ea4a9d-...",
      "name": "",                   // empty until NIN verified
      "displayName": "",
      "phone": "+2348012345678",
      "isVerified": false,
      "isBanned": false,
      "isAdmin": false,
      "avatarUrl": null,
      "deviceToken": null,
      "createdAt": "2026-05-30T19:57:10.121Z"
    }
  }
}
```

**Errors**

| Status | When |
|---|---|
| `401` | OTP wrong or expired |
| `429` | 5 failed attempts — locked for 10 minutes |

---

### POST /auth/refresh

Rotates the token pair. Old refresh token is invalidated immediately.

```json
// Request
{
  "refreshToken": "eyJ..."
}
```

```json
// Response 200
{
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ..."
  }
}
```

**Errors**

| Status | When |
|---|---|
| `401` | Refresh token expired, already used, or invalid |

---

### POST /auth/sign-out

Invalidates the current refresh token. Idempotent.

```json
// Request
{
  "refreshToken": "eyJ..."
}
```

```json
// Response 200
{
  "data": { "success": true }
}
```

---

## 2. Response Envelope

Every successful response is wrapped:

```json
{
  "data": { ... }
}
```

Paginated responses include `meta`:

```json
{
  "data": {
    "data": [ ...items ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 83,
      "totalPages": 5
    }
  }
}
```

Error responses are **not** wrapped:

```json
{
  "statusCode": 404,
  "message": "Listing not found"
}
```

---

## 3. Error Codes

| Status | Meaning |
|---|---|
| `400` | Validation failed — `message` is an array of field errors |
| `401` | Missing or expired access token |
| `403` | Authenticated but not authorised (wrong role, banned, unverified) |
| `404` | Resource not found |
| `409` | Conflict — duplicate resource or invalid state transition |
| `422` | Business rule violation (e.g. refund after keys confirmed) |
| `429` | Rate limit hit |
| `500` | Server error |

---

## 4. User Profile

### GET /me

Returns the authenticated user with a computed `has_payout_account` flag.

```json
// Response 200
{
  "data": {
    "id": "b1ea4a9d-...",
    "name": "Nkechi Adeyemi",        // legal name from NIN — never editable
    "displayName": "Nkechi Adeyemi", // shown to others — editable
    "phone": "+2348012345678",
    "isVerified": true,
    "isBanned": false,
    "isAdmin": false,
    "avatarUrl": "https://res.cloudinary.com/...",
    "deviceToken": null,
    "createdAt": "2026-05-30T19:57:10.121Z",
    "has_payout_account": true
  }
}
```

---

### PATCH /me

Updates editable profile fields. `name` (legal) is read-only.

```json
// Request — all fields optional
{
  "displayName": "Nkechi Eze",
  "avatarUrl": "https://res.cloudinary.com/..."
}
```

```json
// Response 200 — updated user object (same shape as GET /me)
```

---

### POST /me/device-token

Registers or updates the device's push notification token. Call on app launch, after login, and whenever the OS issues a new token.

```json
// Request
{
  "token": "fxSb5k...",
  "platform": "ios"           // "ios" | "android"
}
```

```json
// Response 200
{
  "data": { "success": true }
}
```

---

### GET /me/payout-account

Returns the saved bank account for receiving payouts.

```json
// Response 200
{
  "data": {
    "bankName": "GTBank",
    "accountNumber": "0123456789",
    "accountName": "NKECHI ADEYEMI",  // resolved by the backend via bank lookup
    "isVerified": true
  }
}
```

**Errors:** `404` if no account on file.

---

### POST /me/payout-account

Adds or replaces the payout bank account. The backend resolves `accountName` from the bank — never submit it from the client.

```json
// Request
{
  "bankName": "GTBank",
  "bankCode": "058",            // required for account name lookup
  "accountNumber": "0123456789" // must be exactly 10 digits
}
```

```json
// Response 201
{
  "data": {
    "bankName": "GTBank",
    "accountNumber": "0123456789",
    "accountName": "NKECHI ADEYEMI",
    "isVerified": true
  }
}
```

---

### GET /me/notification-preferences

```json
// Response 200
{
  "data": {
    "whatsapp": true,
    "push": true,
    "email": false,
    "handoverUpdates": true,
    "disputeAlerts": true,
    "newMessages": true,
    "marketing": false
  }
}
```

---

### PATCH /me/notification-preferences

All fields optional.

```json
// Request
{
  "whatsapp": false,
  "marketing": true
}
```

```json
// Response 200 — updated preferences (same shape as GET)
```

---

## 5. Identity Verification

### POST /me/verify-identity

Verifies a user's NIN against their selfie using Prembly. On success, sets `isVerified = true` and stores the legal name from the NIN record as an immutable field.

```json
// Request
{
  "nin": "12345678901",          // 11-digit Nigerian NIN
  "selfieBase64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

```json
// Response 200
{
  "data": {
    "verified": true,
    "nin_name": "NKECHI ADEYEMI"  // legal name from NIN — now stored on user
  }
}
```

**Errors**

| Status | When |
|---|---|
| `400` | Verification failed (selfie didn't match NIN photo, or NIN not found) |

---

## 6. Listings

### GET /listings

Browse all listings. All status values are included — use the `status` field to render badges.

**Query parameters**

| Param | Type | Example |
|---|---|---|
| `city` | string | `Lagos` |
| `types` | CSV enums | `mini_flat,two_bedroom` |
| `amenities` | CSV strings | `borehole,inverter,parking` |
| `rent_min` | integer (naira) | `500000` |
| `rent_max` | integer (naira) | `3000000` |
| `move_in_before` | ISO date | `2026-09-30` |
| `page` | integer | `1` |
| `limit` | integer (max 50) | `20` |

**Property type values:** `self_con` `mini_flat` `two_bedroom` `three_bedroom` `duplex` `penthouse`

**Amenity values:** `borehole` `inverter` `parking` `furnished` `bq` `prepaid_meter` `ac` `cctv`

```json
// Response 200
{
  "data": {
    "data": [
      {
        "id": "dea8a95b-...",
        "propertyType": "two_bedroom",
        "address": "5 Admiralty Way, Lekki Phase 1",
        "city": "Lagos",
        "latitude": "6.4374000",
        "longitude": "3.4793000",
        "beds": 2,
        "baths": 2,
        "annualRent": 3500000,
        "retainmentFee": 35000,
        "availableFrom": "2026-08-01T00:00:00.000Z",
        "interestCount": 4,
        "status": "active",        // "active" | "pending_handover" | "completed"
        "photos": ["https://..."],
        "is_saved": false           // relative to the authenticated user
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 83,
      "totalPages": 5
    }
  }
}
```

**Status badge rendering**

| `status` | Badge |
|---|---|
| `active` | None — flat is available |
| `pending_handover` | "Pending handover" |
| `completed` | "Not available" |

---

### GET /listings/map

Lightweight map pins. Same filters as `/listings` plus a bounding box.

**Additional query parameter:**
- `bounds` — `sw_lat,sw_lng,ne_lat,ne_lng` e.g. `6.40,3.30,6.60,3.60`

```json
// Response 200
{
  "data": [
    {
      "id": "dea8a95b-...",
      "latitude": "6.4374000",
      "longitude": "3.4793000",
      "annualRent": 3500000,
      "propertyType": "two_bedroom"
    }
  ]
}
```

---

### GET /listings/mine

The authenticated user's own listings. Returns `active` and `pending_handover` only — completed listings are not shown here.

```json
// Response 200 — array of listing objects (same shape as browse)
```

---

### GET /listings/saved

Listings saved by the authenticated user (excludes own listings).

```json
// Response 200 — paginated, same shape as GET /listings (all items have is_saved: true)
```

---

### GET /listings/:id

Full listing detail.

```json
// Response 200
{
  "data": {
    "id": "dea8a95b-...",
    "propertyType": "two_bedroom",
    "address": "5 Admiralty Way, Lekki Phase 1",
    "city": "Lagos",
    "latitude": "6.4374000",
    "longitude": "3.4793000",
    "beds": 2, "baths": 2,
    "annualRent": 3500000,
    "retainmentFee": 35000,
    "availableFrom": "2026-08-01T00:00:00.000Z",
    "moveOutDate": null,
    "story": "Beautiful 2-bed in Lekki Phase 1...",
    "amenities": ["borehole", "inverter", "parking"],
    "photos": ["https://cdn.cloudinary.com/..."],
    "interestCount": 4,
    "status": "active",
    "createdAt": "2026-05-30T10:00:00.000Z",
    "is_saved": true,
    "outgoing_tenant": {
      "id": "01d038d1-...",
      "name": "Nkechi Adeyemi",
      "initials": "NA",
      "is_verified": true,
      "years_at_address": 2
    }
  }
}
```

---

### GET /listings/:id/gallery

```json
// Response 200
{
  "data": {
    "photos": ["https://...", "https://..."],
    "labels": ["Photo 1", "Photo 2"]
  }
}
```

---

### GET /listings/:id/payment-preview

Show before the incoming tenant confirms payment. The fee breakdown is for display only — the actual amounts are computed server-side.

```json
// Response 200
{
  "data": {
    "retainment_fee": 35000,        // what the listing charges
    "platform_fee": 3500,           // 10% — shown for transparency
    "total": 35000,                 // what the incoming tenant pays
    "outgoing_receives": 31500,     // what the outgoing tenant gets
    "currency": "NGN"
  }
}
```

---

### POST /listings

Creates a listing. Requires `isVerified = true`.

If the user has no payout account on file, `payoutAccount` is required in this request and will be created atomically.

**`retainmentFee` is always calculated server-side.** Do not submit it — it will be ignored.

```json
// Request
{
  "propertyType": "two_bedroom",
  "address": "5 Admiralty Way, Lekki Phase 1",
  "city": "Lagos",
  "latitude": 6.4374,          // from Google Places — submit as received
  "longitude": 3.4793,
  "beds": 2,
  "baths": 2,
  "annualRent": 3500000,
  "availableFrom": "2026-08-01",
  "moveOutDate": "2026-07-28",  // optional
  "story": "Beautiful 2-bed in Lekki...",
  "amenities": ["borehole", "inverter"],
  "photos": ["https://res.cloudinary.com/..."],

  // only required if user has no payout account on file
  "payoutAccount": {
    "bankName": "GTBank",
    "bankCode": "058",
    "accountNumber": "0123456789"
  }
}
```

```json
// Response 201 — created listing object (same shape as GET /listings/:id)
```

**Errors**

| Status | When |
|---|---|
| `403` | User is not verified |
| `422` | `latitude`/`longitude` missing, or no payout account and none provided |

**Retainment fee formula (for display in the UI):**
```
retainmentFee = clamp(annualRent × 0.01, 35_000, 100_000)
```

---

### PATCH /listings/:id

Updates a listing. Owner only. Only allowed when `status = active`.

```json
// Request — all fields optional
{
  "beds": 2,
  "story": "Updated write-up...",
  "amenities": ["borehole", "inverter", "ac"],
  "photos": ["https://..."]
}
```

**Errors**

| Status | When |
|---|---|
| `403` | Not the listing owner |
| `409` | Listing is `pending_handover` or `completed` |

---

### DELETE /listings/:id

Owner only. Only allowed when `status = active`.

**Response:** `204 No Content`

**Errors:** `403` not owner · `409` not active

---

### POST /listings/:id/save

```json
// Response 200
{
  "data": { "saved": true }
}
```

Idempotent — saving an already-saved listing returns `200`.

**Errors:** `403` if own listing.

---

### DELETE /listings/:id/save

```json
// Response 200
{
  "data": { "saved": false }
}
```

Idempotent.

---

## 7. Handovers

The `role` field (`"outgoing"` or `"incoming"`) is always computed for the requesting user and must be used to render the correct view.

---

### POST /handovers

Initiates a handover. The incoming tenant calls this.

```json
// Request
{
  "listingId": "dea8a95b-..."
}
```

```json
// Response 201
{
  "data": {
    "handover_id": "1c6e5fae-...",
    "payment_intent": {
      "reference": "HO_REF_1748636400",
      "authorizationUrl": "https://checkout.provider.com/..."
    }
  }
}
```

Pass `payment_intent` to the Paystack/payment SDK on the client to open the payment sheet.

**Errors**

| Status | When |
|---|---|
| `403` | Authenticated user is the listing owner |
| `409` | Listing is not `active` (already has a pending handover) |

---

### GET /handovers

All handovers for the authenticated user (incoming and outgoing).

```json
// Response 200
{
  "data": [
    {
      "id": "1c6e5fae-...",
      "role": "incoming",           // "outgoing" | "incoming"
      "status": "active",
      "retainmentAmount": 35000,
      "moveInDate": "2026-08-01T00:00:00.000Z",
      "listing": {
        "id": "dea8a95b-...",
        "propertyType": "two_bedroom",
        "address": "5 Admiralty Way",
        "city": "Lagos"
      },
      "steps": [ ... ]
    }
  ]
}
```

---

### GET /handovers/:id

Full status screen data. Powers the entire Handover Status screen.

```json
// Response 200
{
  "data": {
    "id": "1c6e5fae-...",
    "role": "incoming",
    "listing": {
      "title": "two bedroom in Lagos",
      "photo": "https://...",
      "city": "Lagos"
    },
    "status": "active",
    "move_in_date": "2026-08-01T00:00:00.000Z",
    "escrow_amount": 35000,
    "escrow_status": "held",           // "held" | "released_outgoing" | "released_incoming"
    "auto_release_at": "2026-08-04T12:00:00.000Z",
    "landlord_confirm_deadline": "2026-08-02T12:00:00.000Z",
    "keys_confirmed": false,
    "steps": [
      { "step": "retainment_paid",    "status": "done",    "completed_at": "2026-08-01T..." },
      { "step": "landlord_confirmed", "status": "done",    "completed_at": "2026-08-01T..." },
      { "step": "inspection_done",    "status": "active",  "completed_at": null },
      { "step": "agreement_signed",   "status": "pending", "completed_at": null },
      { "step": "keys_received",      "status": "pending", "completed_at": null }
    ],
    "contact": {
      "name": "Nkechi Adeyemi",
      "initials": "NA",
      "role": "Outgoing tenant"       // or "Incoming tenant" depending on viewer's role
    },
    "dispute": {
      "active": false
    },
    "refund": {
      "available": true,              // false after keys confirmed
      "reason": null
    }
  }
}
```

**Handover status values:** `initiated` `active` `keys_confirmed` `completed` `refunded` `disputed`

**Step names:** `retainment_paid` `landlord_confirmed` `inspection_done` `agreement_signed` `keys_received`

**Step status values:** `pending` `active` `done`

---

### GET /handovers/:id/steps

```json
// Response 200
{
  "data": [
    { "step": "retainment_paid",    "status": "done",    "completed_at": "2026-08-01T..." },
    { "step": "landlord_confirmed", "status": "active",  "completed_at": null },
    { "step": "inspection_done",    "status": "pending", "completed_at": null },
    { "step": "agreement_signed",   "status": "pending", "completed_at": null },
    { "step": "keys_received",      "status": "pending", "completed_at": null }
  ]
}
```

---

### POST /handovers/:id/landlord-confirm

Outgoing tenant only. Must be called within 48 hours of payment confirmation.

```json
// Response 200 — empty data ({}), check steps to confirm advance
```

**Errors**

| Status | When |
|---|---|
| `403` | Caller is not the outgoing tenant |
| `409` | 48-hour confirmation window has already expired |

---

### POST /handovers/:id/confirm-keys

Incoming tenant only. Triggers escrow release to the outgoing tenant.

```json
// Response 200
{
  "data": {
    "handoverId": "1c6e5fae-...",
    "keysCollected": true,
    ...
  }
}
```

After this call: refund option is permanently removed, `escrow_status → released_outgoing`.

---

## 8. Handover Manual

The manual belongs to the **listing**, not a specific handover. One manual per listing.

The outgoing tenant can write it at any time after listing creation.

The incoming tenant can read it only after `keys_confirmed_at` is set on their handover.

---

### GET /listings/:id/manual

```json
// Response 200
{
  "data": {
    "id": "...",
    "listingId": "dea8a95b-...",
    "appliances": "Borehole pump switch is behind the kitchen door...",
    "building": "Gate code is 2580. Security guard on 7pm–6am...",
    "utilities": "Prepaid meter — recharge at any shop nearby...",
    "neighborhood": "Great suya spot at the end of the road...",
    "whatsIncluded": "Sofa, dining table, 2 AC units...",
    "publishedAt": "2026-07-01T10:00:00.000Z",
    "createdAt": "2026-07-01T10:00:00.000Z",
    "updatedAt": "2026-07-15T14:30:00.000Z"
  }
}
```

**Errors**

| Status | When |
|---|---|
| `403` | Incoming tenant before `keys_confirmed_at` is set, or not a participant |
| `404` | Manual not written yet |

---

### PUT /listings/:id/manual

Listing owner only. Creates or fully replaces the manual. Every save publishes immediately — there is no draft state.

> **Note:** The frontend section called "what stays" maps to the `whatsIncluded` field.

```json
// Request — all fields optional but include all you have
{
  "appliances": "Borehole pump switch is behind the kitchen door. Washing machine: left slot for detergent.",
  "building": "Gate code 2580. Security guard 7pm–6am. Spare key with Mr Bello (caretaker, flat 1).",
  "utilities": "Prepaid meter — top up at any shop. Borehole fills automatically overnight.",
  "neighborhood": "Suya spot at end of road. Shell petrol station 2 mins walk. Avoid weekends at Admiralty Way.",
  "whatsIncluded": "Sofa set, dining table + 4 chairs, 2 AC units (serviced Jan 2026), fitted kitchen cabinets."
}
```

```json
// Response 200 — full manual object
```

---

## 9. Move-In Checklist

Incoming tenant only.

---

### GET /handovers/:id/checklist

```json
// Response 200
{
  "data": {
    "handoverId": "1c6e5fae-...",
    "inspectionCompleted": false,
    "agreementSigned": false,
    "keysCollected": false,
    "meterToppedUp": false,
    "caretakerIntroduced": false,
    "photosTaken": false,
    "completedAt": null
  }
}
```

---

### PATCH /handovers/:id/checklist

Updates one or more checklist items.

**Critical:** When `keysCollected` transitions from `false` to `true`, this triggers the full escrow release sequence — same effect as `POST /handovers/:id/confirm-keys`.

```json
// Request — any subset of boolean fields
{
  "inspectionCompleted": true,
  "meterToppedUp": true
}
```

```json
// Response 200 — updated checklist (same shape as GET)
```

---

## 10. Tenancy Agreement

---

### GET /handovers/:id/agreement

```json
// Response 200
{
  "data": {
    "id": "...",
    "handoverId": "1c6e5fae-...",
    "documentUrl": null,            // populated after both parties sign + PDF generated
    "outgoingSigned": false,
    "incomingSigned": false,
    "outgoingSignedAt": null,
    "incomingSignedAt": null
  }
}
```

---

### POST /handovers/:id/agreement/sign

Either party calls this to record their signature. No request body needed.

When both parties have signed, `documentUrl` is populated (async — poll or use WebSocket event).

```json
// Response 200
{
  "data": {
    "outgoingSigned": true,
    "incomingSigned": false,    // will be true after the other party signs
    "outgoingSignedAt": "2026-08-10T14:00:00.000Z",
    "incomingSignedAt": null,
    "documentUrl": null
  }
}
```

---

## 11. Disputes

### POST /handovers/:id/disputes

Either party may raise a dispute.

**Incoming tenant reasons:** `keys_not_handed_over` `condition_mismatch` `landlord_refused` `date_changed` `other`

**Outgoing tenant reasons:** `keys_handed_no_confirmation` `tenant_unresponsive` `invalid_refund_request` `other`

```json
// Request
{
  "reason": "condition_mismatch",
  "details": "Bathroom has severe damp not shown in photos."  // optional
}
```

```json
// Response 201
{
  "data": {
    "id": "b721ce44-...",
    "handoverId": "1c6e5fae-...",
    "raisedById": "f651e260-...",
    "reason": "condition_mismatch",
    "details": "Bathroom has severe damp...",
    "status": "active",
    "outgoingConfirmed": false,
    "incomingConfirmed": false,
    "mediatorAssignedAt": null,
    "resolvedAt": null,
    "createdAt": "2026-08-11T09:00:00.000Z"
  }
}
```

**Errors**

| Status | When |
|---|---|
| `409` | An active dispute already exists on this handover |
| `409` | Handover is already `keys_confirmed` or `completed` |

---

### GET /handovers/:id/disputes/active

Returns the current active dispute or `404` if none.

```json
// Response 200 — dispute object (same shape as POST response)
```

---

### GET /disputes/:id

```json
// Response 200 — full dispute detail
```

---

### POST /disputes/:id/resolve

Either party marks their side as resolved. A dispute only closes when **both** sides confirm.

```json
// Response 200 — updated dispute object
// When both confirmed: status → "resolved", handover status → "active"
```

**Flow:**
1. Party A presses "Mark as resolved" → `outgoingConfirmed: true` (or `incomingConfirmed: true`)
2. Other party receives a push notification
3. Other party confirms → dispute closes, escrow auto-release timer resets

---

### POST /disputes/:id/reopen

Called by the second party to decline the proposed resolution and reopen the case with the mediator.

```json
// Response 200 — dispute object with the first party's confirmation reset to false
```

---

## 12. Refunds

Refunds are separate from disputes. A refund returns the retainment to the incoming tenant within 24 hours automatically.

**Refund is permanently blocked once `keys_confirmed_at` is set.**

---

### POST /handovers/:id/refunds

Incoming tenant only.

**Reason values:** `landlord_did_not_confirm` `condition_mismatch` `date_changed` `keys_not_received` `found_other` `other`

**Case 3 — incoming tenant has an active dispute they raised:** Pass `withdrawDispute: true` to atomically close the dispute and proceed with the refund. Omitting it returns `409`.

```json
// Request
{
  "reason": "date_changed",
  "details": "Move-in date was changed from Aug 1 to Oct 1 without notice.",  // optional

  // only required in Case 3 (incoming raised an active dispute)
  "withdrawDispute": true
}
```

```json
// Response 201
{
  "data": {
    "id": "aee5d196-...",
    "handoverId": "1c6e5fae-...",
    "reason": "date_changed",
    "status": "pending",           // auto-approved after 24h if no dispute
    "source": "standard",
    "createdAt": "2026-08-11T10:00:00.000Z"
  }
}
```

**Errors**

| Status | When |
|---|---|
| `403` | Caller is not the incoming tenant |
| `409` | Another active refund already exists |
| `409` | Incoming has an active dispute they raised and `withdrawDispute` is missing |
| `422` | `keys_confirmed_at` is set — refund no longer available |
| `422` | Handover is `completed` |

---

### GET /handovers/:id/refunds/active

Returns the current pending refund or `404`.

```json
// Response 200
{
  "data": {
    "id": "aee5d196-...",
    "reason": "date_changed",
    "status": "pending",
    "createdAt": "2026-08-11T10:00:00.000Z"
  }
}
```

---

### DELETE /handovers/:id/refunds/active

Incoming tenant withdraws their pending refund request. Only allowed when `status = pending`.

```json
// Response 200
{
  "data": { "success": true }
}
```

---

## 13. Inbox & Messaging

### GET /inbox

Returns all conversation threads for the authenticated user, newest first.

**Query parameters**

| Param | Values | Default |
|---|---|---|
| `filter` | `all` `unread` `enquiries` `handovers` | `all` |
| `page` | integer | `1` |
| `limit` | integer (max 50) | `20` |

```json
// Response 200
{
  "data": {
    "data": [
      {
        "thread_id": "a4ac80ef-...",
        "context_type": "handover",    // "enquiry" | "handover"
        "context_id": "1c6e5fae-...", // listing ID (enquiry) or handover ID (handover)
        "other_participant": {
          "id": "01d038d1-...",
          "name": "Nkechi Adeyemi",
          "initials": "NA"
        },
        "last_message": {
          "body": "Keys are ready — let me know when you're coming.",
          "time": "2026-08-10T16:30:00.000Z"
        },
        "unread_count": 2
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
  }
}
```

---

### POST /inbox/mark-read

Marks all unread messages in specified threads as read without opening each chat.

```json
// Request
{
  "threadIds": ["a4ac80ef-...", "b721ce44-..."]
}
```

```json
// Response 200
{
  "data": { "updated": 2 }   // number of threads that had messages marked
}
```

---

### POST /listings/:id/enquire

Opens a pre-handover enquiry thread between the incoming tenant and the listing creator. Increments `interest_count` on first call. Idempotent — returns the same `thread_id` on subsequent calls.

```json
// Response 200
{
  "data": { "thread_id": "a4ac80ef-..." }
}
```

**Errors:** `403` if own listing · `404` if listing not found.

---

### GET /threads/:id/messages

Returns the full message history and marks all unread messages as read for the caller.

```json
// Response 200
{
  "data": [
    {
      "id": "msg-uuid",
      "threadId": "a4ac80ef-...",
      "senderId": "f651e260-...",
      "body": "Is the flat still available?",
      "readByOther": true,
      "createdAt": "2026-08-01T11:00:00.000Z"
    }
  ]
}
```

---

### POST /threads/:id/messages

```json
// Request
{
  "body": "Yes, come for inspection on Wednesday."
}
```

```json
// Response 201
{
  "data": {
    "id": "msg-uuid",
    "threadId": "a4ac80ef-...",
    "senderId": "01d038d1-...",
    "body": "Yes, come for inspection on Wednesday.",
    "readByOther": false,
    "createdAt": "2026-08-01T12:00:00.000Z"
  }
}
```

---

## 14. Admin

All `/admin/*` endpoints require `isAdmin = true` on the user account. Regular users receive `403`.

---

### POST /admin/appeals

Creates an appeal record when an incoming tenant contacts Handover support after a dispute closes.

```json
// Request
{
  "handoverId": "1c6e5fae-...",
  "filedBy": "f651e260-...",           // incoming tenant's user ID
  "grounds": ["listing_discrepancy"],  // one or more: "rent_inflation" | "listing_discrepancy" | "agreement_breach"
  "evidenceDetails": "Photos taken at inspection show bathroom tiles cracked, not matching..."
}
```

```json
// Response 201 — appeal object
{
  "data": {
    "id": "appeal-uuid",
    "status": "open",
    "appealDeadline": "2026-08-25T09:00:00.000Z",
    ...
  }
}
```

**Errors:** `422` if the 14-day window from dispute resolution has passed.

---

### PATCH /admin/appeals/:id

Updates an appeal during review. All fields optional.

```json
// Request
{
  "outgoingResponse": "I handed over the keys on Aug 10...",
  "incomingResponse": "I never received working keys...",
  "adminNotes": "Evidence reviewed — photos confirm discrepancy.",
  "status": "under_review"          // "open" | "under_review" | "upheld" | "rejected"
}
```

---

### POST /admin/appeals/:id/uphold

Appeal upheld — refund issued to the incoming tenant, outgoing tenant optionally banned.

```json
// Request
{
  "banOutgoingTenant": true   // or false
}
```

```json
// Response 200
{
  "data": {
    "appeal_id": "appeal-uuid",
    "refund_id": "refund-uuid",
    "banned": true
  }
}
```

---

### POST /admin/appeals/:id/reject

```json
// Response 200 — updated appeal object with status: "rejected"
```

---

## 15. WebSocket — Live Chat

The WebSocket gateway is available at:

```
wss://api.handover.ng/threads
```

Authentication is via the access token in the Socket.io handshake:

```js
const socket = io("wss://api.handover.ng/threads", {
  auth: { token: "<access_token>" }
});
```

An invalid or expired token disconnects the client immediately.

---

### Client → Server: `joinThread`

Join a thread room to receive real-time messages. The user must be a participant of the thread.

```js
socket.emit("joinThread", "a4ac80ef-...");
```

If the user is not a participant, the server emits an `error` event and does not join the room.

---

### Server → Client: `message`

Emitted when a new message is sent in a thread the client has joined.

```json
// Payload
{
  "id": "msg-uuid",
  "threadId": "a4ac80ef-...",
  "senderId": "01d038d1-...",
  "body": "See you Wednesday at 10am.",
  "readByOther": false,
  "createdAt": "2026-08-01T12:00:00.000Z"
}
```

---

### Server → Client: `error`

```json
// Payload (string)
"Not a participant of this thread"
```

---

### Reconnection

Socket.io handles reconnection automatically. After reconnecting, re-emit `joinThread` for each open chat screen.

---

## Appendix: Enum Reference

### `propertyType`
`self_con` · `mini_flat` · `two_bedroom` · `three_bedroom` · `duplex` · `penthouse`

### `listingStatus`
`draft` · `active` · `pending_handover` · `completed`

### `handoverStatus`
`initiated` · `active` · `keys_confirmed` · `completed` · `refunded` · `disputed`

### `escrowStatus`
`held` · `released_outgoing` · `released_incoming`

### `handoverStep`
`retainment_paid` · `landlord_confirmed` · `inspection_done` · `agreement_signed` · `keys_received`

### `stepStatus`
`pending` · `active` · `done`

### `disputeStatus`
`active` · `resolved` · `withdrawn`

### `refundStatus`
`pending` · `approved` · `rejected` · `withdrawn`

### `amenities`
`borehole` · `inverter` · `parking` · `furnished` · `bq` · `prepaid_meter` · `ac` · `cctv`

---

*Handover · Made in Lagos*

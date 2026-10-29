# Security Specification — Sistem Inventory Control Store (PT ABADI AGROSINDO PERSADA)

## 1. Access Control Model
- **Application Context**: Internal Store Inventory Control System (`PT ABADI AGROSINDO PERSADA` - Sidoarjo) supporting multi-device synchronization for internal staff accounts (`superuser`, `kepala_gudang`, `admin`, `user`, `viewer`).
- **Bootstrapped Admin**: `rickyilung28@gmail.com` (`request.auth.token.email_verified == true`) or users with `role == 'superuser'` in `/users/$(request.auth.uid)`.
- **Collections**:
  - `/test/connection`: Read-only health check path used by `getDocFromServer` on startup.
  - `/inventory_state/{docId}`: Stores the synchronized store inventory state (`docId == 'shared'`). Validated to ensure `updatedAt` (string) and `version` (number) are present and within size constraints.
  - `/users/{userId}`: Stores user account metadata and role definitions.

## 2. Validation Invariants
- All writes to `/inventory_state/{docId}` must include a valid `updatedAt` timestamp string (`size() <= 64`) and a positive numeric `version`.
- All writes to `/users/{userId}` must validate `id`, `username`, `name`, `role`, and `department` fields.

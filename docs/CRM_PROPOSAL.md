# Proposal: In-House IoT-CRM Application

**A multi-tenant, white-label Customer Relationship Management platform that adapts to any company's requirements — purpose-built on top of an IoT/ThingsBoard operations stack.**

| | |
|---|---|
| **Document** | Solution Proposal |
| **Prepared for** | Prospective customers / internal stakeholders |
| **Product** | IoT-CRM (module of the IoT Dashboard – TB Stack) |
| **Version** | 2.0 |
| **Date** | 31 May 2026 |
| **Status** | For review |

---

## 1. Executive Summary

Most companies running connected hardware end up with a painful gap: their **IoT operations data** (devices, telemetry, alarms) lives in one system, while their **business relationships** (customers, vendors, contracts, support, billing) live in a generic, off-the-shelf CRM that knows nothing about devices. Bridging the two means manual spreadsheets, brittle integrations, and per-customer data leakage risks.

This proposal presents an **in-house IoT-CRM application** that closes that gap. It is a production-grade, multi-tenant CRM built directly on top of the existing IoT Dashboard / ThingsBoard stack. Crucially, it is designed as a **configurable platform rather than a fixed product** — a single deployment serves many organizations, each with its own branding, data isolation, user roles, subscription plan, and feature set. The same codebase can be tailored to a manufacturer, a systems integrator, a facilities operator, or a device reseller **without forking the code**.

The platform is already implemented end-to-end:

- **Backend:** Fastify + TypeScript + Prisma ORM over PostgreSQL, with 20+ REST route modules, JWT auth, RBAC, WebSocket real-time, Stripe billing, and OpenAI-powered assistance. Self-documenting via OpenAPI/Swagger.
- **Frontend:** Next.js 16 + React 19 + Tailwind + shadcn/ui, with a dedicated CRM portal, internationalization (EN/ZH/FR/ES), and real-time updates.
- **Integration:** Native linkage between ThingsBoard devices/assets and CRM customers, contracts, and tickets — without duplicating telemetry.

This document describes **what it does, how it adapts to any company, the architecture, and a delivery plan to onboard a new organization.**

---

## 2. The Problem

| Pain point | Today's reality | Cost |
|---|---|---|
| **Disconnected systems** | Device platform and CRM are separate; no link between a customer and the devices they own. | Support agents can't see which devices a customer runs; engineers can't see who owns a failing device. |
| **No multi-tenancy** | Generic CRMs aren't built to isolate multiple downstream customers/resellers under one operator. | Data-leakage risk; one CRM instance per customer is expensive to run. |
| **Rigid products** | SaaS CRMs force a fixed data model and workflow. | Companies bend their process to the tool, or pay heavily for customization. |
| **Manual service & billing** | Contracts, SLAs, tickets, and invoices tracked in spreadsheets. | Missed renewals, SLA breaches, revenue leakage. |
| **No device-aware support** | Tickets aren't linked to the actual device, its warranty, or its service contract. | Slow resolution, poor customer experience. |

---

## 3. The Solution: One Adaptable Platform

The IoT-CRM is organized into four cooperating layers, all already present in the codebase:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 16)                          │
│   IoT Dashboard  ───────────────────  CRM Portal (white-labeled)      │
│   device & telemetry views            companies, deals, contracts,    │
│                                       vendors, tickets, billing, AI    │
└───────────────┬──────────────────────────────────┬───────────────────┘
                │                                   │
                ▼                                   ▼
┌─────────────────────────────┐      ┌──────────────────────────────────┐
│     ThingsBoard Backend     │      │        CRM Backend (Fastify)      │
│  devices, telemetry, MQTT,  │◄────►│  multi-tenant, RBAC, billing,     │
│  rule engine                │ link │  contracts, tickets, AI, WS       │
└─────────────────────────────┘      └────────────────┬─────────────────┘
                                                       ▼
                                          ┌──────────────────────────┐
                                          │  PostgreSQL (iot_crm)     │
                                          │  Prisma schema, 30+ models│
                                          └──────────────────────────┘
```

The defining characteristic is **configurability**. The next section explains exactly how the same deployment adapts to any company's requirements.

---

## 4. How It Adapts to Any Company

This is the heart of the proposal. Six built-in mechanisms make the platform fit a company rather than forcing the company to fit the platform.

### 4.1 Multi-Tenancy — one platform, many organizations

A first-class `Tenant` model isolates every organization's data. Each tenant has its own companies, vendors, items, contracts, users, subscription, device/asset assignments, alert rules, and audit trail. Tenant scoping is enforced in the backend middleware (`getTenantScope` / `withTenantScope`), so data never crosses organizational boundaries. A `sys_admin` operates across all tenants; everyone else is confined to theirs.

> **Result:** A single deployment can serve an operator's many downstream customers — or be sold as a SaaS to many independent companies — with strict isolation and no code forking.

### 4.2 White-Label Branding — every tenant looks like its own product

The `Tenant` record carries `logo`, `primaryColor`, an optional custom `domain`, and an open `settings` JSON blob. New organizations self-register (`/crm-register`) and await approval, then present their own brand in the portal.

> **Result:** Resellers and operators can offer the CRM under their own identity.

### 4.3 Role-Based Access Control — fits any org chart

Four roles cover the common hierarchy out of the box, plus a **fine-grained permission system** for anything beyond it:

| Role | Scope |
|---|---|
| `sys_admin` | Whole platform: tenant & plan management |
| `tenant_admin` | Full control within their organization, incl. user management |
| `tenant_user` | Day-to-day CRUD on their tenant's data |
| `customer_user` | Read-only access to data for their own company |

The `UserPermission` model (`resource` + `action` + optional JSON `conditions`) lets administrators grant granular rights — e.g. "write on contracts but read-only on billing" — without code changes, via `requirePermission(resource, action)`.

> **Result:** The access model maps to a 3-person startup or a multi-division enterprise equally well.

### 4.4 Configurable Subscription Plans — any commercial model

`Plan` and `Subscription` models, wired to **Stripe**, define tiers (e.g. Starter / Professional / Enterprise) with per-plan limits (`maxUsers`, `maxDevices`, `maxAssets`, `maxStorageGb`), a `features` list, and a `featureFlags` JSON. Usage is tracked against limits, and invoices are generated and tracked.

> **Result:** A company can run the platform free internally, sell it per-seat, or meter by device count — all by configuring plans, not editing code.

### 4.5 Flexible Data Model — extend without migrations

Several models carry open JSON fields designed for per-company extension: `Tenant.settings`, `Item.specifications`, `Contract.slaDetails`, `Plan.featureFlags`, and message/notification `metadata`. Items also support free-form `tags[]`. This lets each organization capture its own attributes (custom device specs, bespoke SLA terms, industry-specific fields) without schema migrations.

> **Result:** Industry-specific requirements are absorbed by configuration, not custom builds.

### 4.6 Internationalization — any market

The frontend ships with `next-intl` and four locales (English, Chinese, French, Spanish) and a language switcher, with the structure to add more.

> **Result:** The same product serves global customers in their own language.

---

## 5. Functional Modules

Every module below is implemented as a dedicated backend route group and a corresponding CRM portal page.

### 5.1 CRM Core
- **Companies** — customer organizations (industry, size, website, address), each linkable to its own devices, contacts, deals, and contracts.
- **Contacts** — people at companies, with positions and notes.
- **Deals** — a sales pipeline with stages `lead → qualified → proposal → negotiation → closed_won/closed_lost`, value, currency, probability, and expected close date.
- **Activities** — calls, emails, meetings, notes, and tasks logged against contacts, deals, and companies, with due dates and completion.

### 5.2 Vendor & Procurement
- **Vendors** — suppliers, manufacturers, distributors, service providers, and partners, with payment terms, tax IDs, currency, performance rating, and status (incl. blacklisting).
- **Vendor Contacts** — primary and secondary contacts per vendor.
- **Items / Product Catalog** — SKU-based catalog with categories, tags, manufacturer part numbers, pricing, technical `specifications`, and optional **inventory tracking** (`minStockLevel`, `currentStock`).

### 5.3 Contract Management
- **Contracts** — purchase, sales, service, maintenance, subscription, NDA, and partnership types, linked to a vendor and/or company, with start/end dates, **auto-renewal**, **SLA level and detail**, total value, document URLs, and an approval lifecycle (`draft → pending_approval → approved → active → expired/cancelled/terminated`).
- **Contract Items** — line items with quantity, unit price, discount, and totals, optionally tied to catalog items.

### 5.4 Device-Aware Service & Support
- **Device & Asset Assignments** — links a ThingsBoard device/asset UUID to a CRM company **without duplicating telemetry**, recording cached name, type, and location.
- **Service Contracts** — maintenance/support/warranty/subscription agreements tied to a specific assigned device, with SLA level (Gold/Silver/Bronze).
- **Service Tickets** — auto-numbered support tickets with priority (`low → critical`), a rich status flow (`open → in_progress → waiting_on_customer/vendor → resolved → closed`), category, resolution notes, and the reporting user — each linkable to the exact device involved.

### 5.5 Billing & Subscriptions
- **Plans, Subscriptions, Invoices** — Stripe-backed billing with trials, monthly/yearly cycles, period tracking, cancellation handling, usage metering, and hosted invoice/PDF links.

### 5.6 Collaboration & Engagement
- **Notifications** — typed (info/success/warning/error/alert/system), per-user, read-tracked, with action URLs, pushed in real time over WebSocket.
- **Direct Messaging** — 1-to-1, group, and **tenant-to-SysAdmin support** conversations, with participants, read receipts, edits, and soft-delete.
- **Feedback** — bug reports, feature requests, questions, and general feedback with an admin response workflow.

### 5.7 AI Assistant
- An **OpenAI-powered assistant** (`gpt-4-turbo` by default, configurable) with **streaming responses over WebSocket**, tenant-aware context building, and persisted **chat sessions and message history**. Each user's role and tenant shape the assistant's context.

### 5.8 Alerting
- **Alert Rules & History** — tenant-scoped, device-type-targeted rules with severity and JSON conditions, and a history log with acknowledgement tracking.

### 5.9 Governance
- **Audit Logging** — every create/update/delete captured with old/new values, actor, tenant, and request metadata (IP, user agent), indexed for compliance reporting.

---

## 6. Technical Architecture

### 6.1 Backend (`/crm`)
- **Runtime/Framework:** Node.js + **Fastify 4** in **TypeScript**.
- **Data:** **PostgreSQL** via **Prisma ORM 7** (30+ models, dedicated `iot_crm` database to avoid collision with ThingsBoard).
- **Auth:** `@fastify/jwt`; bcrypt password hashing; RBAC + per-resource permissions middleware.
- **Real-time:** `@fastify/websocket` for notifications and AI streaming.
- **Billing:** Stripe SDK.
- **AI:** OpenAI SDK.
- **API surface:** ~20 route modules under `/api`, **rate-limited** (500 req/min) and CORS-enabled, fully documented via **OpenAPI 3.0 / Swagger UI** at `/docs`.
- **Ops:** Dockerfile + docker-compose; graceful shutdown; health checks (`/health`, `/health/db`).

### 6.2 Frontend (`/ui`)
- **Framework:** **Next.js 16** (App Router) + **React 19** + **TypeScript**.
- **UI:** **Tailwind CSS 4** + **shadcn/ui** + Radix primitives + lucide icons; charts via **Recharts**.
- **Structure:** route groups for `(auth)`, `(dashboard)` (IoT), `(crm-auth)`, and `(crm-dashboard)` (CRM portal with its own sidebar, header, and auth guard).
- **State/Realtime:** dedicated auth contexts and a CRM WebSocket provider.
- **i18n:** `next-intl` with EN/ZH/FR/ES.

### 6.3 Integration Principle
The CRM **complements** ThingsBoard rather than replacing it: telemetry, device attributes, and core device records stay in ThingsBoard; the CRM links to them by UUID and layers on ownership, contracts, and support. This keeps both systems authoritative for what they do best.

---

## 7. Why Build In-House vs. Buy

| Criterion | Off-the-shelf CRM | This In-House IoT-CRM |
|---|---|---|
| Device/IoT awareness | None (needs integration) | Native — devices link to customers, contracts, tickets |
| Multi-tenancy | Rarely; expensive | Built-in, enforced, white-label |
| Data ownership | Vendor-hosted | Your database, your infrastructure |
| Customization | Limited / costly | Open data model + JSON extension fields |
| Per-customer cost | Recurring per-seat | One platform, your plans |
| Billing model | Fixed | Configurable Stripe plans you control |
| Source control | Closed | Full source, extensible |

---

## 8. Delivery Plan to Onboard a New Company

Because the platform is already built, "adapting to a company" is primarily **configuration and onboarding**, not development. A typical engagement:

| Phase | Activities | Outcome |
|---|---|---|
| **0. Discovery (1 wk)** | Capture the company's roles, plan/pricing model, branding, required custom fields, and which devices map to which customers. | Configuration spec. |
| **1. Provision (1 wk)** | Stand up CRM backend + PostgreSQL (Docker), connect to the company's ThingsBoard, create the tenant, branding, and SysAdmin/Tenant Admin accounts. | Running, branded instance. |
| **2. Configure (1–2 wks)** | Define roles & permissions, subscription plans (Stripe), catalog/vendor seed data, alert rules, and any JSON-field custom attributes. | Tailored workspace. |
| **3. Integrate (1–2 wks)** | Map existing ThingsBoard devices/assets to CRM companies; import contacts/companies; wire notifications. | Device-aware CRM. |
| **4. Pilot & Train (1 wk)** | Onboard a pilot team, validate workflows (deals, tickets, contracts, billing), train admins. | Validated rollout. |
| **5. Go-Live & Support** | Production cutover, monitoring, audit-log review, iterate via feedback module. | Live platform. |

Custom requirements that exceed configuration (e.g. a wholly new entity type or third-party integration) are scoped as incremental modules following the existing route+page pattern — typically days, not months, given the established architecture.

---

## 9. Security & Compliance

- **Tenant isolation** enforced at the data-access layer.
- **JWT authentication** with bcrypt-hashed credentials.
- **RBAC + granular permissions** per resource and action.
- **Full audit trail** of all mutations with actor, before/after values, and request metadata — ready for compliance reporting.
- **Rate limiting** and CORS controls on the API.
- **Self-hosted** data in your own PostgreSQL — no third-party data residency concerns beyond Stripe (billing) and OpenAI (optional AI).

---

## 10. Roadmap Alignment

The broader platform roadmap (time-series analytics, anomaly detection, predictive maintenance, RAG-based AI agents, multi-channel notifications) extends naturally from the CRM's existing AI, alerting, and notification foundations — meaning the investment compounds rather than being thrown away.

---

## 11. Summary & Recommendation

The IoT-CRM is a **complete, production-grade, configurable platform** that already solves the core problem: it unifies IoT operations with customer, vendor, contract, support, and billing management under one multi-tenant, white-label roof. Its adaptability is structural — multi-tenancy, RBAC + granular permissions, configurable plans, white-label branding, JSON-extensible data, and i18n — so it fits a company's requirements through **configuration rather than rebuilds**.

**Recommendation:** Proceed with a discovery + provisioning engagement (Phases 0–1) to stand up a branded tenant against the target company's ThingsBoard instance, then iterate through configuration to production. This delivers a working, device-aware CRM in weeks while preserving full ownership, extensibility, and a clear path to advanced AI and analytics.

---

*Prepared from the existing `crm/` (Fastify + Prisma backend) and `ui/` (Next.js CRM portal) implementations in this repository.*

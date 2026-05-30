# CRM Backend

A CRM (Customer Relationship Management) REST API built with **Fastify**, **TypeScript**, and **Prisma ORM** with PostgreSQL.

## Purpose

This CRM service extends ThingsBoard functionality by providing:

- **Customer Management** — Track companies and contacts associated with IoT deployments
- **Device Ownership** — Link ThingsBoard devices/assets to customer companies
- **Service & Support** — Manage service contracts and support tickets for devices
- **Deal Pipeline** — Track sales opportunities from lead to close
- **User Feedback** — Collect and manage user feedback and feature requests
- **AI Chat History** — Store conversation history for the AI assistant

## Features

### CRM Core
- **Contacts** — Manage customer contacts with company associations
- **Companies** — Track organizations, their size, and industry
- **Deals** — Pipeline management with stages (lead → qualified → proposal → negotiation → closed)
- **Activities** — Log calls, emails, meetings, notes, and tasks

### ThingsBoard Integration
- **Device Assignments** — Link ThingsBoard devices to CRM companies
- **Asset Assignments** — Link ThingsBoard assets to CRM companies
- **Service Contracts** — Track maintenance, support, and warranty contracts
- **Service Tickets** — Manage support tickets for devices with priority and status

### AI & Feedback
- **Feedback System** — Collect bug reports, feature requests, and general feedback
- **Chat Sessions** — Store AI assistant conversation history with metadata

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL 14+
- pnpm (recommended)

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL="postgresql://user:password@host:5432/iot_crm"
```

### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Create database and run migrations
npx prisma migrate dev --name init

# Or push schema directly (for development)
npx prisma db push

# Explore database with Prisma Studio
npx prisma studio
```

### Running the Server

```bash
# Development (hot-reload)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

The server starts on **http://localhost:3001** by default.

## API Endpoints

### Health Checks

| Method | Endpoint      | Description              |
|--------|---------------|--------------------------|
| GET    | `/health`     | Server health check      |
| GET    | `/health/db`  | Database connection check|

### CRM Core

| Method | Endpoint              | Description          |
|--------|-----------------------|----------------------|
| GET    | `/api/contacts`       | List contacts        |
| POST   | `/api/contacts`       | Create contact       |
| GET    | `/api/contacts/:id`   | Get contact          |
| PUT    | `/api/contacts/:id`   | Update contact       |
| DELETE | `/api/contacts/:id`   | Delete contact       |
| GET    | `/api/companies`      | List companies       |
| POST   | `/api/companies`      | Create company       |
| GET    | `/api/companies/:id`  | Get company (with relations) |
| PUT    | `/api/companies/:id`  | Update company       |
| DELETE | `/api/companies/:id`  | Delete company       |
| GET    | `/api/deals`          | List deals           |
| POST   | `/api/deals`          | Create deal          |
| GET    | `/api/deals/:id`      | Get deal             |
| PUT    | `/api/deals/:id`      | Update deal          |
| DELETE | `/api/deals/:id`      | Delete deal          |
| GET    | `/api/activities`     | List activities      |
| POST   | `/api/activities`     | Create activity      |
| GET    | `/api/activities/:id` | Get activity         |
| PUT    | `/api/activities/:id` | Update activity      |
| DELETE | `/api/activities/:id` | Delete activity      |

### ThingsBoard Integration

| Method | Endpoint                                    | Description              |
|--------|---------------------------------------------|--------------------------|
| GET    | `/api/device-assignments`                   | List device assignments  |
| POST   | `/api/device-assignments`                   | Create device assignment |
| GET    | `/api/device-assignments/:id`               | Get assignment           |
| GET    | `/api/device-assignments/by-device/:tbId`   | Get by ThingsBoard ID    |
| PUT    | `/api/device-assignments/:id`               | Update assignment        |
| DELETE | `/api/device-assignments/:id`               | Delete assignment        |
| GET    | `/api/service-tickets`                      | List service tickets     |
| POST   | `/api/service-tickets`                      | Create ticket            |
| GET    | `/api/service-tickets/:id`                  | Get ticket               |
| PUT    | `/api/service-tickets/:id`                  | Update ticket            |
| DELETE | `/api/service-tickets/:id`                  | Delete ticket            |

### Feedback & AI

| Method | Endpoint                           | Description              |
|--------|------------------------------------|--------------------------|
| GET    | `/api/feedback`                    | List feedback            |
| POST   | `/api/feedback`                    | Submit feedback          |
| GET    | `/api/feedback/:id`                | Get feedback             |
| PUT    | `/api/feedback/:id`                | Update feedback status   |
| DELETE | `/api/feedback/:id`                | Delete feedback          |
| GET    | `/api/chat/sessions`               | List chat sessions       |
| POST   | `/api/chat/sessions`               | Create chat session      |
| GET    | `/api/chat/sessions/:id`           | Get session with messages|
| POST   | `/api/chat/sessions/:id/messages`  | Add message to session   |
| PUT    | `/api/chat/sessions/:id`           | Update session           |
| DELETE | `/api/chat/sessions/:id`           | Delete session           |

### Query Parameters

**All list endpoints support:**
- `page` — Page number (default: 1)
- `limit` — Items per page (default: 20)
- `search` — Text search filter

**Specific filters:**
- Deals: `stage` (lead, qualified, proposal, negotiation, closed_won, closed_lost)
- Activities: `type` (call, email, meeting, note, task)
- Service Tickets: `status`, `priority`, `deviceAssignmentId`
- Feedback: `type` (bug, feature_request, question, general), `status`
- Device Assignments: `companyId`
- Chat Sessions: `userEmail`

## Data Models

### Company
```typescript
{
  id: string
  name: string
  industry?: string
  website?: string
  address?: string
  phone?: string
  size?: 'small' | 'medium' | 'large' | 'enterprise'
  createdAt: DateTime
  updatedAt: DateTime
  // Relations: contacts, deals, activities, deviceAssignments, assetAssignments
}
```

### Contact
```typescript
{
  id: string
  firstName: string
  lastName: string
  email: string (unique)
  phone?: string
  position?: string
  notes?: string
  companyId?: string
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Deal
```typescript
{
  id: string
  title: string
  value: number
  currency: string (default: 'USD')
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
  probability?: number
  expectedCloseDate?: DateTime
  notes?: string
  contactId?: string
  companyId?: string
  createdAt: DateTime
  updatedAt: DateTime
}
```

### DeviceAssignment
```typescript
{
  id: string
  thingsboardDeviceId: string (unique) // Links to ThingsBoard device
  deviceName: string
  deviceType?: string
  companyId: string
  notes?: string
  assignedAt: DateTime
  // Relations: company, serviceContracts, serviceTickets
}
```

### ServiceTicket
```typescript
{
  id: string
  ticketNumber: string (unique, auto-generated)
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'waiting_on_customer' | 'waiting_on_vendor' | 'resolved' | 'closed'
  category?: string
  resolution?: string
  deviceAssignmentId?: string
  createdAt: DateTime
  updatedAt: DateTime
  resolvedAt?: DateTime
}
```

### Feedback
```typescript
{
  id: string
  type: 'bug' | 'feature_request' | 'question' | 'general'
  subject: string
  message: string
  userEmail?: string
  status: 'new' | 'in_review' | 'planned' | 'completed' | 'declined'
  response?: string // Admin response
  createdAt: DateTime
  updatedAt: DateTime
}
```

## Environment Variables

| Variable       | Default   | Description                    |
|----------------|-----------|--------------------------------|
| `DATABASE_URL` | -         | PostgreSQL connection string   |
| `PORT`         | `3001`    | Server port                    |
| `HOST`         | `0.0.0.0` | Server host                    |
| `NODE_ENV`     | -         | Environment (development/production) |

## Database Scripts

```bash
# Explore ThingsBoard database schema
npx tsx scripts/explore-db.ts

# Generate Prisma client after schema changes
npx prisma generate

# Create a migration
npx prisma migrate dev --name <migration_name>

# Reset database (caution: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (GUI for database)
npx prisma studio
```

## Integration with ThingsBoard

The CRM service is designed to complement ThingsBoard by:

1. **Not duplicating ThingsBoard data** — Device telemetry, attributes, and core device info stay in ThingsBoard
2. **Linking via IDs** — `DeviceAssignment.thingsboardDeviceId` references ThingsBoard device UUIDs
3. **Adding CRM context** — Customer ownership, service contracts, and support tickets
4. **Separate database** — Uses its own PostgreSQL database (`iot_crm`) to avoid schema conflicts

### Recommended Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Dashboard UI  │────▶│  ThingsBoard    │
│   (Next.js)     │     │  API            │
└────────┬────────┘     └─────────────────┘
         │
         │ CRM Data
         ▼
┌─────────────────┐     ┌─────────────────┐
│   CRM Service   │────▶│  PostgreSQL     │
│   (Fastify)     │     │  (iot_crm db)   │
└─────────────────┘     └─────────────────┘
```

## License

MIT

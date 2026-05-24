# IoT Dashboard

<p align="center">
  <img src="public/iot-icon.png" alt="IoT Dashboard" width="120" height="120">
</p>

<p align="center">
  <strong>Industrial Automation Monitoring & Management Platform</strong>
</p>

## Overview

IoT Dashboard is a modern web application designed for monitoring and managing industrial automation systems. It provides real-time visibility into device status, asset information, and operational metrics, enabling efficient management of IoT infrastructure.

### Key Purposes

- **Automation Monitoring**: Track and monitor automation devices, sensors, and controllers in real-time
- **Device Management**: Centralized management of IoT devices with status tracking (online/offline)
- **Asset Information**: Organize and track physical assets connected to your automation system
- **ERP Integration Ready**: Architecture designed to integrate with ERP systems for managing business processes beyond IoT (inventory, maintenance scheduling, compliance tracking)

## Features

- **Dashboard Overview**: Real-time statistics showing total devices, online/offline status, and asset counts with visual charts
- **Device Management**: Browse, search, and filter devices by profile and status
- **Asset Management**: Browse, search, and filter assets by profile
- **Real-time Updates**: WebSocket connection for live notifications and status updates
- **Responsive Design**: Mobile-friendly interface with bottom navigation for smaller screens
- **Dark/Light Mode**: Theme support with system preference detection
- **AI Assistant**: Built-in chat assistant for IoT-related queries (coming soon)

## Use Cases

- **Manufacturing**: Monitor production line sensors, PLCs, and automation equipment
- **Building Automation**: Track HVAC systems, lighting controls, and security devices
- **Energy Management**: Monitor power meters, solar inverters, and energy storage systems
- **Logistics**: Track fleet devices, warehouse sensors, and supply chain equipment

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Notifications**: Sonner

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn or pnpm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd IoT-Dashboard/ui
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set your ThingsBoard API URL:
```
NEXT_PUBLIC_API_URL=https://your-thingsboard-server.com/api
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
ui/
├── app/
│   ├── (auth)/          # Authentication pages (signin, terms, privacy)
│   └── (dashboard)/     # Protected dashboard pages
├── components/          # Reusable UI components
├── contexts/            # React contexts (auth)
├── lib/                 # Utility functions and API clients
└── public/              # Static assets
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ThingsBoard API base URL (e.g., `https://your-server.com/api`) |

## API Integration

This dashboard integrates with ThingsBoard IoT Platform API:

- **Authentication**: JWT-based login with token refresh
- **Devices**: Fetch device info, profiles, and status
- **Assets**: Fetch asset info and profiles
- **WebSocket**: Real-time notifications via `wss://your-server.com/api/ws`

### ERP Integration (Planned)

The platform architecture supports future integration with ERP systems:
- Inventory management synchronization
- Maintenance work order generation
- Compliance and audit trail tracking
- Cost center and budget allocation

## License

MIT

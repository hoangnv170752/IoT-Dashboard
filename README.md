# IoT Dashboard

<p align="center">
  <img src="ui/public/iot-icon.png" alt="IoT Dashboard" width="100" height="100">
</p>

<p align="center">
  <strong>Industrial Automation Monitoring & Asset Management Platform</strong>
</p>

## Business Value

A unified platform for monitoring industrial automation systems and managing connected assets, designed to bridge the gap between IoT operations and enterprise business processes.

### What It Does

- **Monitor Automation Systems** - Real-time visibility into device status, connectivity, and performance across your facility
- **Manage Device & Asset Information** - Centralized registry of all IoT devices and physical assets with profile-based organization
- **Enable ERP Integration** - Architecture ready to sync with ERP systems for inventory, maintenance scheduling, and compliance tracking

### Who It's For

- Manufacturing operations teams
- Facility managers
- Industrial automation engineers
- Operations & maintenance departments

## Quick Start

### Dashboard UI
```bash
cd ui
npm install
cp .env.example .env  # Configure NEXT_PUBLIC_API_URL
npm run dev
```

See [ui/README.md](ui/README.md) for detailed technical documentation.

### Firmware
```bash
cd firmware
idf.py menuconfig  # Configure WiFi and API URL
idf.py build flash monitor
```

## Firmware Framework

The `/firmware` directory contains an ESP-IDF based framework for connecting ESP32 devices to the IoT Dashboard.

### Goal

Build a reusable, production-ready firmware foundation for ESP-based IoT devices that enables:

- **Plug & Play Connectivity** - Any ESP32/ESP8266 device can connect to the dashboard with minimal configuration
- **Standardized Communication** - HTTP/HTTPS API integration with the ThingsBoard backend
- **Easy Configuration** - WiFi credentials and API endpoints configurable via `menuconfig`
- **Extensible Architecture** - Base framework for adding sensors, actuators, and custom telemetry

### Supported Devices

- ESP32 (all variants)
- ESP32-S2, ESP32-S3, ESP32-C3
- ESP8266 (with modifications)

### Configuration

Edit via `idf.py menuconfig` → IoT Dashboard Configuration:
- WiFi SSID & Password
- API URL endpoint

### Use Cases

- Environmental monitoring (temperature, humidity, air quality)
- Industrial sensor data collection
- Asset tracking and location
- Machine status reporting
- Energy monitoring

## License

MIT

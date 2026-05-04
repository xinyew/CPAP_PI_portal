# CPAP Pressure Injury Visualization Portal

A real-time, high-fidelity monitoring dashboard designed for the CPAP PI Sensing System. Built with **React**, **Vite**, and **Recharts**.

## Features

- **Hybrid Connectivity**: Support for both **Web Serial API** (USB) and **Web Bluetooth API** (Wireless).
- **High-Fidelity Visualization**: 
    - Dedicated, vertically stacked charts for Red, IR, and Green PPG channels.
    - Real-time Force analysis plot (mV).
    - Dynamic Y-axis auto-scaling to resolve subtle physiological signals.
- **Signal Processing**:
    - Toggleable **Exponential Moving Average (EMA)** filter for noise reduction.
    - Low-latency rendering (60Hz data processing).
- **Data Logging**:
    - **CSV Recording**: Capture entire sessions with high precision for offline analysis.
- **Robustness**: 
    - Built-in Error Boundaries and strict data validation to prevent UI crashes from serial noise.

## Tech Stack

- **Framework**: React 18 (Vite)
- **Visualization**: Recharts (Custom SVG rendering)
- **Icons**: Lucide-React
- **Communication**: Native Web Serial & Web Bluetooth APIs

## Getting Started

### Installation
1. Navigate to the project directory:
   ```bash
   cd CPAP_PI_portal
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open your browser to the provided local URL (usually `http://localhost:5173`).
3. **Important**: Use a Chromium-based browser (Chrome or Edge) for Web Bluetooth/Serial support.

## Usage

1. **Interface Select**: Use the toggle in the header to choose between **Serial** or **BLE**.
2. **Board Sync**: Ensure your nRF52840 board is set to the matching mode via Button 1 (LED1=Serial, LED2=BLE).
3. **Connect**: Click the "Connect" button to begin the stream.
4. **Filtering**: Use the "Filter OFF/ON" button to smooth the waveforms.
5. **Recording**: Click "Start Recording" to begin logging data. When finished, click "Stop & Save" to download the CSV.

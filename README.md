# CPAP Pressure Injury Visualization Portal

A real-time, high-fidelity monitoring dashboard designed for the CPAP PI Sensing System. Built with **React**, **Vite**, and **Recharts**.

## Features

- **Hybrid Connectivity**: **Web Bluetooth** (wireless, NUS binary stream) and **RTT (wired)** via the debug probe — run `python ../CPAP_PI_firmware/scripts/rtt_bridge.py` and connect; the board has no USB serial.
- **High-Fidelity Visualization**: 
    - Dedicated, vertically stacked charts for Red, IR, and Green PPG channels.
    - Real-time Force analysis plot (mV).
    - Dynamic Y-axis auto-scaling to resolve subtle physiological signals.
- **Signal Processing**:
    - Toggleable **Exponential Moving Average (EMA)** filter for noise reduction.
    - Low-latency rendering (60Hz data processing).
- **Analysis controls**:
    - **Time window** (Full / 2 s / 5 s) with an elapsed-seconds x-axis; the 2 s/5 s windows use a fixed numeric domain so traces don't jitter.
    - **AC / RAW** PPG mode — AC removes the slow baseline so the pulsatile waveform stands out.
    - **Adjustable smoothing** — set the EMA strength (0.01–1) while Filter is ON.
    - **Stop / Resume** — freeze the display without disconnecting (recording keeps running).
    - **Event markers** — the Mark button (or the `M` key) drops a numbered marker on every chart and into the CSV `Mark` column to timestamp events.
- **Demo mode**: synthetic 3×PPG + 3×FSR + 6×Baro stream for driving the UI without hardware.
- **Data Logging**:
    - **CSV Recording**: Capture entire sessions with high precision for offline analysis. The CSV includes a `Time_s` column (seconds since the stream started, matching the chart x-axis) and a `Mark` column.
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

1. **Interface Select**: Use the toggle in the header to choose between **RTT (wired)** or **BLE**. For RTT, start the bridge first: `python ../CPAP_PI_firmware/scripts/rtt_bridge.py` (requires the J-Link probe; close other RTT sessions).
2. **Board LEDs**: LED1 = heartbeat, LED2 = BLE connected.
3. **Connect**: Click the "Connect" button to begin the stream.
4. **Filtering**: Use the "Filter OFF/ON" button to smooth the waveforms, and the **Smooth** field to tune the strength.
5. **Window / PPG mode**: Use the controls toolbar to pick the time window (Full / 2 s / 5 s) and toggle PPG **RAW / AC**.
6. **Markers**: Click **Mark** (or press `M`) to timestamp an event; it appears on every chart and in the CSV.
7. **Recording**: Click "Start Recording" to begin logging data. When finished, click "Stop & Save" to download the CSV.

### No hardware?
Click **Demo** on the header to stream synthetic data and explore every control.

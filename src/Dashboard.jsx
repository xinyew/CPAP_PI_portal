import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Activity, Thermometer, Droplets, Zap, Download, Play, Square, Bluetooth, Usb, Gauge } from 'lucide-react';
import { useComm } from './useComm';

// Line colors per sensor instance (1..3 / 1..6)
const PPG_RED_COLORS   = ['#fca5a5', '#ef4444', '#991b1b'];
const PPG_IR_COLORS    = ['#c4b5fd', '#8b5cf6', '#5b21b6'];
const PPG_GREEN_COLORS = ['#86efac', '#22c55e', '#15803d'];
const FORCE_COLORS     = ['#d8b4fe', '#a855f7', '#6b21a8'];
const BARO_COLORS      = ['#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309'];

const fmtRes = (r) => (r === undefined || r < 0) ? '--' : (r / 1000).toFixed(1);

const Dashboard = () => {
  const {
    connect,
    disconnect,
    isConnected,
    latestData,
    history,
    isRecording,
    toggleRecording,
    isFiltered,
    toggleFilter,
    commMode,
    setCommMode
  } = useComm();

  const ppgChart = (title, color, keys, colors, latestKey) => (
    <div className="glass-card ppg-sub-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Activity color={color} size={18} />
        <h2 style={{ fontSize: '1rem' }}>{title}</h2>
      </div>
      <ResponsiveContainer width="100%" height="70%">
        <LineChart data={history}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="timestamp" hide />
          <YAxis stroke="var(--text-dim)" fontSize={10} domain={['auto', 'auto']} hide />
          {keys.map((k, idx) => (
            (latestData.ppgMask & (1 << idx)) !== 0 &&
            <Line key={k} type="monotone" dataKey={k} stroke={colors[idx]}
                  strokeWidth={2} dot={false} name={`S${idx + 1}`} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'right', fontSize: '1.25rem', fontWeight: '700' }}>
        {latestData[latestKey] || 0}
      </div>
    </div>
  );

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <header className="glass-card header-card">
        <div>
          <h1>CPAP Pressure Injury Portal</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            3x PPG @ {latestData.ppgRate || 0}Hz · FSR @ {latestData.fsrRate || 0}Hz · 6x Baro @ {latestData.baroRate || 0}Hz
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {!isConnected && (
            <div style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '0.75rem',
              padding: '0.25rem',
              border: '1px solid var(--border-glass)'
            }}>
              <button
                onClick={() => setCommMode('serial')}
                style={{
                  background: commMode === 'serial' ? 'var(--accent-blue)' : 'transparent',
                  color: commMode === 'serial' ? '#000' : 'var(--text-dim)',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem'
                }}
              >
                <Usb size={16} style={{ marginRight: '0.5rem' }} />
                Serial
              </button>
              <button
                onClick={() => setCommMode('bluetooth')}
                style={{
                  background: commMode === 'bluetooth' ? 'var(--accent-blue)' : 'transparent',
                  color: commMode === 'bluetooth' ? '#000' : 'var(--text-dim)',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem'
                }}
              >
                <Bluetooth size={16} style={{ marginRight: '0.5rem' }} />
                BLE
              </button>
            </div>
          )}

          <div className={`status-badge ${isConnected ? 'status-online' : 'status-offline'}`}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
            {isConnected ? 'LIVE' : 'DISCONNECTED'}
          </div>

          {!isConnected ? (
            <button onClick={connect}>Connect</button>
          ) : (
            <>
              <button
                onClick={toggleFilter}
                style={{
                  background: isFiltered ? 'var(--accent-green)' : 'transparent',
                  color: isFiltered ? '#000' : 'var(--accent-green)',
                  border: '1px solid var(--accent-green)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Download size={16} style={{ transform: 'rotate(180deg)' }} />
                {isFiltered ? 'Filter ON' : 'Filter OFF'}
              </button>

              <button
                className={isRecording ? 'recording' : ''}
                onClick={toggleRecording}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isRecording ? <Square size={16} /> : <Play size={16} />}
                {isRecording ? 'Stop & Save CSV' : 'Start Recording'}
              </button>
              <button className="disconnect" onClick={disconnect}>Disconnect</button>
            </>
          )}
        </div>
      </header>

      {/* Environment Telemetry Card */}
      <div className="glass-card env-card">
        <div className="telemetry-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Thermometer color="var(--accent-blue)" size={16} />
            <span className="telemetry-label">Temp</span>
          </div>
          <div className="telemetry-value" style={{ fontSize: '1.75rem' }}>
            {(latestData.t || 0).toFixed(1)}<span className="telemetry-unit">°C</span>
          </div>
        </div>

        <div className="telemetry-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Droplets color="var(--accent-blue)" size={16} />
            <span className="telemetry-label">Hum</span>
          </div>
          <div className="telemetry-value" style={{ fontSize: '1.75rem' }}>
            {(latestData.h || 0).toFixed(1)}<span className="telemetry-unit">%</span>
          </div>
        </div>

        <div className="telemetry-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Thermometer color="var(--accent-amber)" size={16} />
            <span className="telemetry-label">P-Temp</span>
          </div>
          <div className="telemetry-value" style={{ fontSize: '1.75rem' }}>
            {(latestData.pt || 0).toFixed(1)}<span className="telemetry-unit">°C</span>
          </div>
        </div>

        <div className="telemetry-item" style={{ borderLeft: '1px solid var(--border-glass)', paddingLeft: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Activity color="var(--accent-green)" size={16} />
            <span className="telemetry-label">R-FSR 1/2/3</span>
          </div>
          <div className="telemetry-value" style={{ fontSize: '1.25rem' }}>
            {fmtRes(latestData.res1)}/{fmtRes(latestData.res2)}/{fmtRes(latestData.res3)}
            <span className="telemetry-unit">kΩ</span>
          </div>
        </div>

        <div className="telemetry-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Zap color="var(--accent-yellow)" size={16} />
            <span className="telemetry-label">Vref</span>
          </div>
          <div className="telemetry-value" style={{ fontSize: '1.75rem' }}>
            {latestData.v || 0}<span className="telemetry-unit">mV</span>
          </div>
        </div>
      </div>

      {/* Force Sensor Chart Card */}
      <div className="glass-card force-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Zap color="var(--accent-violet)" size={20} />
          <h2>Force Sensors (ESS102 x3)</h2>
        </div>
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis stroke="var(--text-dim)" fontSize={12} domain={['auto', 'auto']} label={{ value: 'mV', angle: -90, position: 'insideLeft', fill: 'var(--text-dim)' }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
              labelStyle={{ display: 'none' }}
            />
            <Legend />
            {['f1', 'f2', 'f3'].map((k, idx) => (
              <Line key={k} type="monotone" dataKey={k} stroke={FORCE_COLORS[idx]}
                    strokeWidth={2} dot={false} name={`FSR ${idx + 1} (mV)`} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pressure Sensor Chart Card */}
      <div className="glass-card force-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Gauge color="var(--accent-amber)" size={20} />
          <h2>Contact Pressure (MS5611 x6)</h2>
        </div>
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis stroke="var(--text-dim)" fontSize={12} domain={['auto', 'auto']} label={{ value: 'mbar', angle: -90, position: 'insideLeft', fill: 'var(--text-dim)' }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
              labelStyle={{ display: 'none' }}
            />
            <Legend />
            {[1, 2, 3, 4, 5, 6].map((n) => (
              (latestData.baroMask & (1 << (n - 1))) !== 0 &&
              <Line key={n} type="monotone" dataKey={`p${n}`} stroke={BARO_COLORS[n - 1]}
                    strokeWidth={2} dot={false} name={`P${n}`} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* PPG Chart Cards — one per color, three sensors per chart */}
      {ppgChart('PPG Red (x3)', 'var(--accent-red)', ['r1', 'r2', 'r3'], PPG_RED_COLORS, 'r2')}
      {ppgChart('PPG IR (x3)', 'var(--accent-violet)', ['i1', 'i2', 'i3'], PPG_IR_COLORS, 'i2')}
      {ppgChart('PPG Green (x3)', 'var(--accent-green)', ['g1', 'g2', 'g3'], PPG_GREEN_COLORS, 'g2')}
    </div>
  );
};

export default Dashboard;

import React, { useState } from 'react';
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
import { Activity, Thermometer, Droplets, Zap, Download, Play, Square, Pause, Bluetooth, Cable, Gauge, LayoutGrid, Layers, FlaskConical } from 'lucide-react';
import { useComm } from './useComm';

// Line colors per sensor instance (1..3 / 1..6)
const PPG_RED_COLORS   = ['#fca5a5', '#ef4444', '#991b1b'];
const PPG_IR_COLORS    = ['#c4b5fd', '#8b5cf6', '#5b21b6'];
const PPG_GREEN_COLORS = ['#86efac', '#22c55e', '#15803d'];
const FORCE_COLORS     = ['#d8b4fe', '#a855f7', '#6b21a8'];
const BARO_COLORS      = ['#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309'];

const fmtRes = (r) => (r === undefined || r < 0) ? '--' : (r / 1000).toFixed(1);

// Shared dark tooltip; label shows elapsed seconds via labelFormatter set per chart.
const tooltipContentStyle = { background: '#1e293b', border: '1px solid var(--border-glass)', borderRadius: '8px' };
const tooltipLabelStyle = { color: 'var(--text-dim)', fontSize: '0.75rem' };

// Single-signal card used by split view
const MiniChart = ({ title, dataKey, color, history, latest, unit, xTick }) => (
  <div className="glass-card mini-card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
      <h2 style={{ fontSize: '0.875rem', color: color }}>{title}</h2>
      <span className="num" style={{ fontSize: '1rem', fontWeight: 700 }}>
        {latest}{unit && <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}> {unit}</span>}
      </span>
    </div>
    <ResponsiveContainer width="100%" height="72%">
      <LineChart data={history}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="timestamp" tickFormatter={xTick} stroke="var(--text-dim)" fontSize={11}
               tickLine={false} axisLine={false} minTickGap={60} height={18} />
        <YAxis stroke="var(--text-dim)" fontSize={11} domain={['auto', 'auto']} width={52}
               label={unit ? { value: unit, angle: -90, position: 'insideLeft', fill: 'var(--text-dim)', fontSize: 11, style: { textAnchor: 'middle' } } : undefined} />
        <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle}
                 labelFormatter={xTick} isAnimationActive={false} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

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
    isPaused,
    togglePause,
    isDemo,
    toggleDemo,
    streamStart,
    commMode,
    setCommMode
  } = useComm();

  const [splitView, setSplitView] = useState(false);

  // X-axis label: seconds elapsed since the stream started
  const fmtElapsed = (t) => (streamStart && typeof t === 'number' ? `${((t - streamStart) / 1000).toFixed(1)}s` : '');
  const timeAxisProps = {
    dataKey: 'timestamp',
    tickFormatter: fmtElapsed,
    stroke: 'var(--text-dim)',
    fontSize: 12,
    tickLine: false,
    axisLine: false,
    minTickGap: 70,
    height: 22,
  };
  const tooltipProps = {
    contentStyle: tooltipContentStyle,
    labelStyle: tooltipLabelStyle,
    labelFormatter: fmtElapsed,
    isAnimationActive: false,
  };

  const livePpg = [0, 1, 2].filter(s => (latestData.ppgMask & (1 << s)) !== 0);
  const liveBaro = [0, 1, 2, 3, 4, 5].filter(b => (latestData.baroMask & (1 << b)) !== 0);

  const ppgOverlayChart = (title, color, keys, colors, latestKey) => (
    <div className="glass-card ppg-sub-card" key={title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Activity color={color} size={18} />
        <h2 style={{ fontSize: '1rem' }}>{title}</h2>
      </div>
      <ResponsiveContainer width="100%" height="70%">
        <LineChart data={history}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis {...timeAxisProps} />
          <YAxis stroke="var(--text-dim)" fontSize={11} domain={['auto', 'auto']} width={58}
                 label={{ value: 'counts', angle: -90, position: 'insideLeft', fill: 'var(--text-dim)', fontSize: 11, style: { textAnchor: 'middle' } }} />
          <Tooltip {...tooltipProps} />
          {keys.map((k, idx) => (
            (latestData.ppgMask & (1 << idx)) !== 0 &&
            <Line key={k} type="monotone" dataKey={k} stroke={colors[idx]}
                  strokeWidth={2} dot={false} name={`S${idx + 1}`} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="num" style={{ textAlign: 'right', fontSize: '1.25rem', fontWeight: '700' }}>
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
                onClick={() => setCommMode('rtt')}
                style={{
                  background: commMode === 'rtt' ? 'var(--accent-blue)' : 'transparent',
                  color: commMode === 'rtt' ? '#000' : 'var(--text-dim)',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem'
                }}
              >
                <Cable size={16} style={{ marginRight: '0.5rem' }} />
                RTT (wired)
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

          <button
            onClick={() => setSplitView(!splitView)}
            style={{
              background: 'transparent',
              color: 'var(--accent-blue)',
              border: '1px solid var(--accent-blue)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {splitView ? <LayoutGrid size={16} /> : <Layers size={16} />}
            {splitView ? 'Split' : 'Overlay'}
          </button>

          <div className={`status-badge ${isConnected ? (isPaused ? 'status-paused' : 'status-online') : 'status-offline'}`}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
            {isConnected ? (isPaused ? 'PAUSED' : isDemo ? 'DEMO' : 'LIVE') : 'DISCONNECTED'}
          </div>

          {!isConnected ? (
            <>
              <button className={isDemo ? 'demo active' : 'demo'} onClick={toggleDemo}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FlaskConical size={16} />
                Demo
              </button>
              <button onClick={connect}>Connect</button>
            </>
          ) : (
            <>
              {/* Stop = freeze charts while staying connected (no re-pairing) */}
              <button className={isPaused ? 'pause active' : 'pause'} onClick={togglePause}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isPaused ? <Play size={16} /> : <Pause size={16} />}
                {isPaused ? 'Resume' : 'Stop'}
              </button>

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

      {splitView ? (
        <>
          {/* Split view: one card per live signal */}
          {[0, 1, 2].map(i => (
            <MiniChart key={`f${i + 1}`} title={`FSR ${i + 1}`} dataKey={`f${i + 1}`}
                       color={FORCE_COLORS[i]} history={history} xTick={fmtElapsed}
                       latest={latestData[`f${i + 1}`] || 0} unit="mV" />
          ))}
          {liveBaro.map(b => (
            <MiniChart key={`p${b + 1}`} title={`Pressure ${b + 1}`} dataKey={`p${b + 1}`}
                       color={BARO_COLORS[b]} history={history} xTick={fmtElapsed}
                       latest={(latestData[`p${b + 1}`] || 0).toFixed(1)} unit="mbar" />
          ))}
          {livePpg.map(s => (
            <React.Fragment key={`ppg${s}`}>
              <MiniChart title={`PPG ${s + 1} Red`} dataKey={`r${s + 1}`}
                         color={PPG_RED_COLORS[s]} history={history} xTick={fmtElapsed}
                         latest={latestData[`r${s + 1}`] || 0} unit="counts" />
              <MiniChart title={`PPG ${s + 1} IR`} dataKey={`i${s + 1}`}
                         color={PPG_IR_COLORS[s]} history={history} xTick={fmtElapsed}
                         latest={latestData[`i${s + 1}`] || 0} unit="counts" />
              <MiniChart title={`PPG ${s + 1} Green`} dataKey={`g${s + 1}`}
                         color={PPG_GREEN_COLORS[s]} history={history} xTick={fmtElapsed}
                         latest={latestData[`g${s + 1}`] || 0} unit="counts" />
            </React.Fragment>
          ))}
        </>
      ) : (
        <>
          {/* Overlay view: grouped multi-line charts */}
          <div className="glass-card force-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Zap color="var(--accent-violet)" size={20} />
              <h2>Force Sensors (ESS102 x3)</h2>
            </div>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis {...timeAxisProps} />
                <YAxis stroke="var(--text-dim)" fontSize={12} width={58} domain={['auto', 'auto']} label={{ value: 'mV', angle: -90, position: 'insideLeft', fill: 'var(--text-dim)', style: { textAnchor: 'middle' } }} />
                <Tooltip {...tooltipProps} />
                <Legend />
                {['f1', 'f2', 'f3'].map((k, idx) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={FORCE_COLORS[idx]}
                        strokeWidth={2} dot={false} name={`FSR ${idx + 1} (mV)`} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card force-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Gauge color="var(--accent-amber)" size={20} />
              <h2>Contact Pressure (MS5611 x6)</h2>
            </div>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis {...timeAxisProps} />
                <YAxis stroke="var(--text-dim)" fontSize={12} width={58} domain={['auto', 'auto']} label={{ value: 'mbar', angle: -90, position: 'insideLeft', fill: 'var(--text-dim)', style: { textAnchor: 'middle' } }} />
                <Tooltip {...tooltipProps} />
                <Legend />
                {liveBaro.map((b) => (
                  <Line key={b} type="monotone" dataKey={`p${b + 1}`} stroke={BARO_COLORS[b]}
                        strokeWidth={2} dot={false} name={`P${b + 1}`} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {ppgOverlayChart('PPG Red (x3)', 'var(--accent-red)', ['r1', 'r2', 'r3'], PPG_RED_COLORS, 'r2')}
          {ppgOverlayChart('PPG IR (x3)', 'var(--accent-violet)', ['i1', 'i2', 'i3'], PPG_IR_COLORS, 'i2')}
          {ppgOverlayChart('PPG Green (x3)', 'var(--accent-green)', ['g1', 'g2', 'g3'], PPG_GREEN_COLORS, 'g2')}
        </>
      )}
    </div>
  );
};

export default Dashboard;

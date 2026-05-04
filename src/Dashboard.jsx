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
import { Activity, Thermometer, Droplets, Zap, Download, Play, Square } from 'lucide-react';
import { useSerial } from './useSerial';

const Dashboard = () => {
  const { 
    connect, 
    disconnect, 
    isConnected, 
    latestData, 
    history, 
    isRecording, 
    toggleRecording 
  } = useSerial();

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <header className="glass-card header-card">
        <div>
          <h1>CPAP Pressure Injury Portal</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Real-time multi-sensor diagnostic stream (60Hz)
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className={`status-badge ${isConnected ? 'status-online' : 'status-offline'}`}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
            {isConnected ? 'LIVE' : 'DISCONNECTED'}
          </div>

          {!isConnected ? (
            <button onClick={connect}>Connect to nRF52840</button>
          ) : (
            <>
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

      {/* PPG Chart Card */}
      <div className="glass-card ppg-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Activity color="var(--accent-red)" size={20} />
          <h2>Photoplethysmogram (PPG)</h2>
        </div>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="timestamp" hide domain={['auto', 'auto']} />
            <YAxis stroke="var(--text-dim)" fontSize={12} domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ background: '#1e293b', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
              labelStyle={{ display: 'none' }}
            />
            <Legend verticalAlign="top" height={36}/>
            <Line type="monotone" dataKey="r" stroke="var(--accent-red)" strokeWidth={2} dot={false} name="Red LED" isAnimationActive={false} />
            <Line type="monotone" dataKey="i" stroke="var(--accent-violet)" strokeWidth={2} dot={false} name="IR LED" isAnimationActive={false} />
            <Line type="monotone" dataKey="g" stroke="var(--accent-green)" strokeWidth={2} dot={false} name="Green LED" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Environment Telemetry Card */}
      <div className="glass-card env-card">
        <div className="telemetry-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Thermometer color="var(--accent-blue)" size={18} />
            <span className="telemetry-label">Temperature</span>
          </div>
          <div className="telemetry-value">
            {latestData.t.toFixed(1)}<span className="telemetry-unit">°C</span>
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border-glass)', margin: '1rem 0' }} />

        <div className="telemetry-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Droplets color="var(--accent-blue)" size={18} />
            <span className="telemetry-label">Humidity</span>
          </div>
          <div className="telemetry-value">
            {latestData.h.toFixed(1)}<span className="telemetry-unit">%</span>
          </div>
        </div>
      </div>

      {/* Force Sensor Chart Card */}
      <div className="glass-card force-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Zap color="var(--accent-violet)" size={20} />
          <h2>Force Sensor Analysis</h2>
        </div>
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis stroke="var(--text-dim)" fontSize={12} label={{ value: 'mV', angle: -90, position: 'insideLeft', fill: 'var(--text-dim)' }} />
            <Tooltip 
              contentStyle={{ background: '#1e293b', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
              labelStyle={{ display: 'none' }}
            />
            <Line type="monotone" dataKey="f" stroke="var(--accent-violet)" strokeWidth={3} dot={false} name="Force (mV)" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;

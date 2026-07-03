import { useState, useRef } from 'react';

const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// Binary protocol — must match firmware src/comm/comm_protocol.h
const MAGIC = 0xC9A5;
const TYPE_DATA = 0x01;
const TYPE_STATUS = 0x02;
const TICK_MS = 10;

const WAVE_KEYS = ['r1','i1','g1','r2','i2','g2','r3','i3','g3','f1','f2','f3'];
const HISTORY_LEN = 300;

const emptyLatest = {
  r1: 0, i1: 0, g1: 0, r2: 0, i2: 0, g2: 0, r3: 0, i3: 0, g3: 0,
  f1: 0, f2: 0, f3: 0, v: 0,
  p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0,
  res1: -1, res2: -1, res3: -1,
  t: 0, h: 0, pt: 0,
  ppgRate: 0, fsrRate: 0, baroRate: 0,
  ppgMask: 0, baroMask: 0,
};

const RTT_BRIDGE_URL = 'ws://localhost:8765'; // scripts/rtt_bridge.py

export const useComm = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [commMode, setCommMode] = useState('bluetooth'); // 'bluetooth' or 'rtt'
  const [isRecording, setIsRecording] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const isRecordingRef = useRef(false);
  const isFilteredRef = useRef(false);
  const isPausedRef = useRef(false);
  const deviceRef = useRef(null);
  const wsRef = useRef(null);
  const demoTimerRef = useRef(null);
  const demoTickRef = useRef(0);

  const alphaPPG = 0.15;
  const alphaForce = 0.1;
  const filterStateRef = useRef({});

  const [latestData, setLatestData] = useState(emptyLatest);
  const [history, setHistory] = useState([]);
  const statusRef = useRef({});
  const recordedDataRef = useRef([]);

  // Timestamp of the first sample of this session — charts show seconds
  // elapsed since the stream started.
  const [streamStart, setStreamStart] = useState(null);
  const streamStartRef = useRef(null);

  // Event markers: pressing Mark tags the NEXT sample, so the marker lands on
  // a real data point (drawn on every chart, saved in the CSV Mark column).
  const [markCount, setMarkCount] = useState(0);
  const markCounterRef = useRef(0);
  const markNextRef = useRef(0);
  const addMark = () => {
    markCounterRef.current += 1;
    markNextRef.current = markCounterRef.current;
    setMarkCount(markCounterRef.current);
  };

  const applyFilter = (point) => {
    if (!isFilteredRef.current) return point;
    const fs = filterStateRef.current;
    const out = { ...point };
    for (const key of WAVE_KEYS) {
      const alpha = key.startsWith('f') ? alphaForce : alphaPPG;
      if (fs[key] === undefined || isNaN(fs[key])) fs[key] = point[key];
      fs[key] = alpha * point[key] + (1 - alpha) * fs[key];
      out[key] = Math.round(fs[key]);
    }
    return out;
  };

  const pushPoints = (points) => {
    if (points.length && streamStartRef.current === null) {
      streamStartRef.current = points[0].timestamp;
      setStreamStart(points[0].timestamp);
    }
    const processed = points.map(applyFilter);
    // Attach a pending marker to the most recent sample of this batch so it
    // flows to BOTH the recorded copy and the on-screen history.
    if (markNextRef.current) {
      processed[processed.length - 1].mark = markNextRef.current;
      markNextRef.current = 0;
    }
    // Recording keeps capturing even while the display is paused
    if (isRecordingRef.current) {
      for (const p of processed) {
        recordedDataRef.current.push({ ...p, ...statusRef.current });
      }
    }
    // Stop (pause) freezes the charts without dropping the connection
    if (isPausedRef.current) return;
    const last = processed[processed.length - 1];
    setLatestData(prev => ({ ...prev, ...last, ...statusRef.current }));
    setHistory(prev => [...prev, ...processed].slice(-HISTORY_LEN));
  };

  const readU24 = (dv, off) => dv.getUint16(off, true) + (dv.getUint8(off + 2) << 16);

  const processBinaryFrame = (dv) => {
    if (dv.byteLength < 12 || dv.getUint16(0, true) !== MAGIC) return false;
    const type = dv.getUint8(2);

    if (type === TYPE_DATA) {
      const n = dv.getUint8(9);
      if (dv.byteLength < 12 + 108 + 32 + 72) return true; // truncated: drop
      const now = Date.now();
      const points = [];
      for (let k = 0; k < n; k++) {
        const pt = { timestamp: now - (n - 1 - k) * TICK_MS };
        // PPG block: sensor-major, 4 samples x (r,i,g) u24
        for (let s = 0; s < 3; s++) {
          const base = 12 + s * (n * 9) + k * 9;
          pt[`r${s + 1}`] = readU24(dv, base);
          pt[`i${s + 1}`] = readU24(dv, base + 3);
          pt[`g${s + 1}`] = readU24(dv, base + 6);
        }
        // FSR block: 4 samples x (ff1,ff2,ff3,vref) i16
        const fb = 12 + 108 + k * 8;
        pt.f1 = dv.getInt16(fb, true);
        pt.f2 = dv.getInt16(fb + 2, true);
        pt.f3 = dv.getInt16(fb + 4, true);
        pt.v = dv.getInt16(fb + 6, true);
        // Baro block: 4 samples x 6 x u24 Pa -> mbar (100 Hz)
        const bb = 12 + 108 + 32 + k * 18;
        for (let b = 0; b < 6; b++) {
          pt[`p${b + 1}`] = readU24(dv, bb + b * 3) / 100;
        }
        points.push(pt);
      }
      pushPoints(points);
      return true;
    }

    if (type === TYPE_STATUS) {
      const baroMask = dv.getUint8(40);
      let ptSum = 0, ptCnt = 0;
      for (let i = 0; i < 6; i++) {
        if (baroMask & (1 << i)) {
          ptSum += dv.getInt16(12 + 2 * i, true);
          ptCnt++;
        }
      }
      statusRef.current = {
        t: dv.getInt16(8, true) / 100,
        h: dv.getUint16(10, true) / 100,
        pt: ptCnt ? ptSum / ptCnt / 100 : 0,
        res1: dv.getInt32(24, true),
        res2: dv.getInt32(28, true),
        res3: dv.getInt32(32, true),
        ppgRate: dv.getUint8(36),
        fsrRate: dv.getUint8(37),
        baroRate: dv.getUint8(38),
        ppgMask: dv.getUint8(39),
        baroMask,
      };
      setLatestData(prev => ({ ...prev, ...statusRef.current }));
      return true;
    }
    return true;
  };

  // Legacy JSON line (firmware JSON debug mode over BLE)
  const processDataLine = (line) => {
    line = line.trim();
    if (!(line.startsWith('{') && line.endsWith('}'))) return;
    try {
      const data = JSON.parse(line);
      const now = Date.now();
      const pt = {
        timestamp: now,
        r1: data.r ?? 0, i1: data.i ?? 0, g1: data.g ?? 0,
        r2: 0, i2: 0, g2: 0, r3: 0, i3: 0, g3: 0,
        f1: data.f ?? 0, f2: 0, f3: 0, v: data.v ?? 0,
        p1: data.p ?? 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0,
      };
      statusRef.current = {
        ...statusRef.current,
        t: data.t ?? 0, h: data.h ?? 0, pt: data.pt ?? 0,
        res1: data.res ?? -1,
      };
      pushPoints([pt]);
    } catch (e) {}
  };

  // Wired mode: binary frames relayed from SEGGER RTT by
  // scripts/rtt_bridge.py (requires the J-Link debug probe attached).
  const connectRtt = () => {
    try {
      const ws = new WebSocket(RTT_BRIDGE_URL);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      ws.onmessage = (event) => {
        processBinaryFrame(new DataView(event.data));
      };
      ws.onclose = () => setIsConnected(false);
      ws.onerror = (err) => {
        console.error('RTT bridge error (is rtt_bridge.py running?):', err);
        setIsConnected(false);
      };
    } catch (err) {
      console.error('RTT Error:', err);
    }
  };

  const connectBluetooth = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'CPAP' }],
        optionalServices: [NUS_SERVICE_UUID]
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(NUS_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(NUS_TX_CHARACTERISTIC_UUID);

      deviceRef.current = device;
      setIsConnected(true);

      await characteristic.startNotifications();
      let textBuffer = "";
      const decoder = new TextDecoder();

      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        // Binary frames are detected by magic; anything else is treated
        // as the legacy/debug JSON text stream.
        if (processBinaryFrame(value)) return;
        textBuffer += decoder.decode(value);
        const lines = textBuffer.split('\n');
        textBuffer = lines.pop();
        for (let line of lines) processDataLine(line);
      });

      // Ensure the firmware is in binary mode
      try {
        const rx = await service.getCharacteristic(NUS_RX_CHARACTERISTIC_UUID);
        await rx.writeValueWithoutResponse(new Uint8Array([0x42])); // 'B'
      } catch (e) { /* RX optional */ }

      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
      });

    } catch (err) {
      console.error('Bluetooth Error:', err);
    }
  };

  // ── Demo mode: synthetic 3xPPG + 3xFSR + 6xBaro stream, no hardware ──
  // Emits a batch of 4 samples every 40 ms (like a 100 Hz binary DATA frame).
  const demoBatch = () => {
    const now = Date.now();
    const pts = [];
    for (let j = 0; j < 4; j++) {
      const k = demoTickRef.current++;
      const t = k / 100; // seconds
      const beat = Math.sin(2 * Math.PI * 1.2 * t) + 0.3 * Math.sin(2 * Math.PI * 2.4 * t + 1.2);
      const nz = () => (Math.random() - 0.5) * 60;
      const pt = { timestamp: now - (3 - j) * 10 };
      for (let s = 0; s < 3; s++) {
        pt[`r${s + 1}`] = Math.round(52000 + s * 1000 + 1500 * beat + nz());
        pt[`i${s + 1}`] = Math.round(98000 + s * 1000 + 2600 * beat + nz());
        pt[`g${s + 1}`] = Math.round(23000 + s * 800 + 900 * beat + nz());
      }
      pt.f1 = Math.round(450 + 120 * Math.sin(2 * Math.PI * 0.15 * t));
      pt.f2 = Math.round(500 + 100 * Math.sin(2 * Math.PI * 0.15 * t + 1));
      pt.f3 = Math.round(400 + 90 * Math.sin(2 * Math.PI * 0.15 * t + 2));
      pt.v = 300;
      for (let b = 0; b < 6; b++) pt[`p${b + 1}`] = 1013 + b * 0.5 + 4 * Math.sin(2 * Math.PI * 0.2 * t + b);
      pts.push(pt);
    }
    statusRef.current = {
      t: 24.5, h: 45.2, pt: 25.1,
      res1: 12000, res2: 15000, res3: 9000,
      ppgRate: 100, fsrRate: 100, baroRate: 100,
      ppgMask: 0b111, baroMask: 0b111111,
    };
    pushPoints(pts);
  };

  const toggleDemo = () => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
      setIsDemo(false);
      setIsConnected(false);
    } else {
      demoTickRef.current = 0;
      streamStartRef.current = null;
      setIsConnected(true);
      setIsDemo(true);
      demoTimerRef.current = setInterval(demoBatch, 40);
    }
  };

  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    isPausedRef.current = next;
  };

  const connect = () => {
    if (isDemo) toggleDemo(); // stop demo before a real connection
    streamStartRef.current = null; // restart the elapsed-time clock
    if (commMode === 'rtt') connectRtt();
    else connectBluetooth();
  };

  const disconnect = () => {
    window.location.reload();
  };

  const toggleRecording = () => {
    const nextState = !isRecording;
    if (isRecording) exportToCsv();
    else recordedDataRef.current = [];
    setIsRecording(nextState);
    isRecordingRef.current = nextState;
  };

  const toggleFilter = () => {
    const nextState = !isFiltered;
    setIsFiltered(nextState);
    isFilteredRef.current = nextState;
  };

  const exportToCsv = () => {
    if (recordedDataRef.current.length === 0) return;
    // Time_s = seconds since the session's first sample, matching the chart
    // x-axis. Mark = event-marker number on that row (blank if none).
    const t0 = streamStartRef.current ?? recordedDataRef.current[0].timestamp;
    const cols = ['timestamp',
      'r1','i1','g1','r2','i2','g2','r3','i3','g3',
      'f1','f2','f3','v','res1','res2','res3',
      'p1','p2','p3','p4','p5','p6','t','h','pt','mark'];
    const headers = 'Time_s,' + cols.join(',') + '\n';
    const csvContent = recordedDataRef.current.map(d =>
      ((d.timestamp - t0) / 1000).toFixed(3) + ',' + cols.map(c => d[c] ?? '').join(',')
    ).join('\n');
    const blob = new Blob([headers + csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CPAP_PI_Data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return {
    connect, disconnect, isConnected, latestData, history,
    isRecording, toggleRecording, isFiltered, toggleFilter,
    isPaused, togglePause,
    isDemo, toggleDemo,
    markCount, addMark,
    streamStart,
    commMode, setCommMode
  };
};

import { useState, useRef } from 'react';

const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export const useComm = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [commMode, setCommMode] = useState('serial'); // 'serial' or 'bluetooth'
  const [isRecording, setIsRecording] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);
  
  const isRecordingRef = useRef(false);
  const isFilteredRef = useRef(false);
  const deviceRef = useRef(null);
  const portRef = useRef(null);
  
  const alphaPPG = 0.15;
  const alphaForce = 0.1;
  const filterStateRef = useRef({ r: 0, i: 0, g: 0, f: 0 });

  const [latestData, setLatestData] = useState({ r: 0, i: 0, g: 0, f: 0, v: 0, res: 0, t: 0, h: 0, p: 0, pt: 0 });
  const [history, setHistory] = useState([]);
  const recordedDataRef = useRef([]);

  const processDataLine = (line) => {
    line = line.trim();
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const data = JSON.parse(line);
        const required = ['r', 'i', 'g', 'f', 'v', 'res', 't', 'h', 'p', 'pt'];
        if (!required.every(key => typeof data[key] === 'number')) return;

        const timestamp = Date.now();
        const dataPoint = { ...data, timestamp };
        let processedData = { ...dataPoint };

        if (isFilteredRef.current) {
          if (!filterStateRef.current || isNaN(filterStateRef.current.r)) {
            filterStateRef.current = { r: data.r, i: data.i, g: data.g, f: data.f };
          }
          filterStateRef.current.r = (alphaPPG * data.r) + ((1 - alphaPPG) * filterStateRef.current.r);
          filterStateRef.current.i = (alphaPPG * data.i) + ((1 - alphaPPG) * filterStateRef.current.i);
          filterStateRef.current.g = (alphaPPG * data.g) + ((1 - alphaPPG) * filterStateRef.current.g);
          filterStateRef.current.f = (alphaForce * data.f) + ((1 - alphaForce) * filterStateRef.current.f);

          processedData.r = Math.round(filterStateRef.current.r);
          processedData.i = Math.round(filterStateRef.current.i);
          processedData.g = Math.round(filterStateRef.current.g);
          processedData.f = Math.round(filterStateRef.current.f);
        }
        
        setLatestData(processedData);
        setHistory(prev => [...prev, processedData].slice(-100));
        if (isRecordingRef.current) recordedDataRef.current.push(processedData);
      } catch (e) {}
    }
  };

  const connectSerial = async () => {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setIsConnected(true);
      
      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (let line of lines) processDataLine(line);
      }
    } catch (err) {
      console.error('Serial Error:', err);
    }
  };

  const connectBluetooth = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'CPAP-PI-Portal' }],
        optionalServices: [NUS_SERVICE_UUID]
      });
      
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(NUS_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(NUS_TX_CHARACTERISTIC_UUID);
      
      deviceRef.current = device;
      setIsConnected(true);

      await characteristic.startNotifications();
      let buffer = "";
      const decoder = new TextDecoder();

      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        buffer += decoder.decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (let line of lines) processDataLine(line);
      });

      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
      });

    } catch (err) {
      console.error('Bluetooth Error:', err);
    }
  };

  const connect = () => {
    if (commMode === 'serial') connectSerial();
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
    const headers = "Timestamp,Red,IR,Green,TIA_Vout_mV,Vref_mV,Resistance_Ohm,Temp_C,Humidity_RH,Pressure,PressureTemp_C\n";
    const csvContent = recordedDataRef.current.map(d =>
      `${d.timestamp},${d.r},${d.i},${d.g},${d.f},${d.v},${d.res},${d.t},${d.h},${d.p},${d.pt}`
    ).join("\n");
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
    commMode, setCommMode 
  };
};

import { useState, useRef, useCallback } from 'react';

export const useSerial = () => {
  const [port, setPort] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);
  
  const isRecordingRef = useRef(false);
  const isFilteredRef = useRef(false);
  
  // EMA Filter coefficients (0.1 = heavy smoothing, 0.9 = light smoothing)
  const alphaPPG = 0.15;
  const alphaForce = 0.1;
  const filterStateRef = useRef({ r: 0, i: 0, g: 0, f: 0 });

  // Real-time data state for UI
  const [latestData, setLatestData] = useState({ r: 0, i: 0, g: 0, f: 0, t: 0, h: 0 });
  
  // Historical data for charts (keep last 100 points)
  const [history, setHistory] = useState([]);
  
  // Full recording log for CSV
  const recordedDataRef = useRef([]);

  const connect = async () => {
    try {
      const serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: 115200 });
      setPort(serialPort);
      setIsConnected(true);
      readLoop(serialPort);
    } catch (err) {
      console.error('Failed to connect to Serial Port:', err);
    }
  };

  const disconnect = async () => {
    if (port) {
      window.location.reload(); 
    }
  };

  const toggleRecording = () => {
    const nextState = !isRecording;
    if (isRecording) {
      exportToCsv();
    } else {
      recordedDataRef.current = []; // clear old recording
    }
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
    
    const headers = "Timestamp,Red,IR,Green,Force_mV,Temp_C,Humidity_RH\n";
    const csvContent = recordedDataRef.current.map(d => 
      `${d.timestamp},${d.r},${d.i},${d.g},${d.f},${d.t},${d.h}`
    ).join("\n");
    
    const blob = new Blob([headers + csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'CPAP_PI_Data.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const readLoop = async (serialPort) => {
    const textDecoder = new TextDecoderStream();
    serialPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (let line of lines) {
            line = line.trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                const data = JSON.parse(line);
                
                // STRICT VALIDATION: Ensure all fields exist and are numbers
                const required = ['r', 'i', 'g', 'f', 't', 'h'];
                const isValid = required.every(key => typeof data[key] === 'number');
                if (!isValid) continue;

                const timestamp = Date.now();
                const dataPoint = { ...data, timestamp };
                let processedData = { ...dataPoint };

                // Apply Exponential Moving Average (EMA) if filtered
                if (isFilteredRef.current) {
                  // Initialize filter state if needed
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
                setHistory(prev => {
                  const newHist = [...prev, processedData];
                  return newHist.slice(-100); // Keep last 100 points
                });

                if (isRecordingRef.current) {
                  recordedDataRef.current.push(processedData);
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (error) {
      console.error("Serial Read Error:", error);
      setIsConnected(false);
    } finally {
      reader.releaseLock();
    }
  };

  return { 
    connect, 
    disconnect, 
    isConnected, 
    latestData, 
    history, 
    isRecording, 
    toggleRecording,
    isFiltered,
    toggleFilter
  };
};

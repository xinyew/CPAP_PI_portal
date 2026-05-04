import { useState, useRef, useCallback } from 'react';

export const useSerial = () => {
  const [port, setPort] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  
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
      // Note: proper teardown of streams requires cancelling the reader first.
      // For simplicity in this demo, we'll just reload the page or rely on garbage collection if the user unplugs.
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
    const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer

          for (let line of lines) {
            line = line.trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                const data = JSON.parse(line);
                const timestamp = Date.now();
                const dataPoint = { ...data, timestamp };
                
                // Update latest
                setLatestData(dataPoint);
                
                // Update history
                setHistory(prev => {
                  const newHist = [...prev, dataPoint];
                  if (newHist.length > 100) newHist.shift(); // Keep last 100 points
                  return newHist;
                });

                // Update recording (Use the Ref here to avoid stale closure)
                if (isRecordingRef.current) {
                  recordedDataRef.current.push(dataPoint);
                }
              } catch (e) {
                // Ignore malformed JSON during startup
              }
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

  return { connect, disconnect, isConnected, latestData, history, isRecording, toggleRecording };
};

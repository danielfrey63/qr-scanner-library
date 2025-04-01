# QR Scanner Library

A lightweight, TypeScript-based QR code scanning library for browser applications. This library provides an easy-to-use interface for accessing the device camera and scanning QR codes in real-time.

## Features

- 📱 Camera device selection
- 🔄 Real-time QR code scanning
- 📊 Configurable logging
- 🎮 Simple API with TypeScript support
- 🧩 Modular architecture for easy integration
- 🔌 No external dependencies except jsQR

## Installation

```bash
npm install qr-scanner-library
```

## Basic Usage

```typescript
import { ScannerService, LogLevel } from 'qr-scanner-library';

// Get a reference to your video element
const videoElement = document.getElementById('video') as HTMLVideoElement;

// Create a scanner instance
const scanner = new ScannerService({
  videoElement,
  onScanSuccess: (result) => {
    console.log('QR Code detected:', result);
    // Handle the scan result
  },
  onError: (error) => {
    console.error('Scanning error:', error);
    // Handle errors
  },
  logLevel: LogLevel.INFO,
  logger: console.log,
  stopOnScan: true, // Stop scanning after first successful scan
});

// Start scanning
scanner.start()
  .then(() => console.log('Scanner started'))
  .catch(err => console.error('Failed to start scanner:', err));

// To stop scanning
// scanner.stop();
```

## Camera Selection

The library provides a utility to list available camera devices:

```typescript
import { CameraManager } from 'qr-scanner-library';

// List available camera devices
CameraManager.listDevices()
  .then(devices => {
    // Display devices to the user for selection
    console.log('Available cameras:', devices);
    
    // Use a specific device ID when creating the scanner
    const scanner = new ScannerService({
      videoElement,
      deviceId: devices[0].deviceId, // Use the first camera
      // ... other options
    });
  })
  .catch(err => console.error('Failed to list camera devices:', err));
```

## API Reference

### ScannerService

The main class for QR code scanning functionality.

#### Constructor Options

```typescript
interface ScannerOptions {
  videoElement: HTMLVideoElement;        // Required: Video element to display camera feed
  onScanSuccess: (result: string) => void; // Required: Callback for successful scans
  onError?: (error: Error) => void;      // Optional: Error callback
  deviceId?: string;                     // Optional: Specific camera device ID
  scanInterval?: number;                 // Optional: Interval between scan attempts (ms)
  logLevel?: LogLevel;                   // Optional: Logging level
  logger?: LoggerCallback;               // Optional: Custom logger function
  stopOnScan?: boolean;                  // Optional: Stop after successful scan (default: true)
}
```

#### Methods

- `start(): Promise<void>` - Start the scanning process
- `stop(): void` - Stop the scanning process

### CameraManager

Utility class for camera management.

#### Static Methods

- `listDevices(): Promise<MediaDeviceInfo[]>` - List available camera devices

#### Instance Methods

- `startStream(deviceId?: string): Promise<void>` - Start camera stream
- `stopStream(): void` - Stop camera stream

### LogLevel

Enum for logging levels:

- `NONE` - No logging
- `ERROR` - Log errors only
- `WARN` - Log warnings and errors
- `INFO` - Log info, warnings, and errors
- `DEBUG` - Log everything including debug messages

## Browser Compatibility

This library works in modern browsers that support the following APIs:
- MediaDevices API (getUserMedia)
- Canvas API
- requestAnimationFrame

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
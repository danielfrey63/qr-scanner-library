/**
 * qr-scanner-library
 *
 * Main entry point for the QR code scanning library.
 * Exports the core ScannerService and utility classes/types.
 */

import ScannerService from './scannerService';
import CameraManager from './cameraManager';
import QrDecoder from './qrDecoder'; // Although internal, might be useful for advanced users? Decide later.

// Export the main service for typical usage
export { ScannerService };

// Export the camera manager for users who might need direct camera control or device listing
export { CameraManager };

// Export the core options type for configuring the service
export type { ScannerOptions } from './scannerService';
// Export LogLevel and LoggerCallback types
export { LogLevel } from './types/log';
export type { LoggerCallback } from './types/log';

// Potentially export QrDecoder if direct access to decoding logic is deemed useful,
// otherwise keep it internal to the ScannerService. For now, let's keep it internal
// as per the initial architecture focus.
// export { QrDecoder };

// Optional: Define a simple factory function for convenience?
// export function createScanner(options: ScannerOptions): ScannerService {
//     return new ScannerService(options);
// }
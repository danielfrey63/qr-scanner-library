import { LogLevel, LoggerCallback } from './types/log'; // Import from library types
import CameraManager from './cameraManager';
import QrDecoder from './qrDecoder';

/**
 * Configuration options for the ScannerService.
 */
export type ScannerOptions = {
    /** The HTMLVideoElement to use for displaying the camera feed. */
    videoElement: HTMLVideoElement;
    /** Callback function triggered upon successful QR code scan. */
    onScanSuccess: (result: string) => void;
    /** Callback function triggered when an error occurs. */
    onError: (error: Error) => void;
    /** Optional: Specific camera device ID to use. */
    deviceId?: string;
    /** Optional: Milliseconds between scan attempts (default: 200ms). Higher values use less CPU. */
    scanInterval?: number;
    /** Optional: Whether to stop scanning after the first successful scan (default: true). */
    stopOnScan?: boolean;
    /** Optional: Callback function for internal logging. */
    logger?: LoggerCallback; // Use the imported type
};

/**
 * Service orchestrating camera access, frame grabbing, and QR code decoding.
 */
class ScannerService {
    private cameraManager: CameraManager;
    private qrDecoder: QrDecoder;
    private options: ScannerOptions;
    private isScanning: boolean = false;
    private animationFrameId: number | null = null;
    private canvasElement: HTMLCanvasElement;
    private canvasContext: CanvasRenderingContext2D;
    // Store listener references for cleanup
    private onMetadataLoadedListener: (() => void) | null = null;
    private onVideoErrorListener: ((err: Event) => void) | null = null;

    /**
     * Initializes the ScannerService.
     * @param options - Configuration options for the scanner.
     * @throws Will throw an error if a 2D canvas context cannot be created.
     */
    constructor(options: ScannerOptions) {
        // Apply default options
        this.options = {
            scanInterval: 200,
            stopOnScan: true,
            deviceId: undefined,
            ...options,
        };

        // Validate required options
        if (!options.videoElement || !(options.videoElement instanceof HTMLVideoElement)) {
            throw new Error("ScannerService: 'videoElement' option is required and must be an HTMLVideoElement.");
        }
        if (!options.onScanSuccess || typeof options.onScanSuccess !== 'function') {
            throw new Error("ScannerService: 'onScanSuccess' option is required and must be a function.");
        }
        if (!options.onError || typeof options.onError !== 'function') {
            throw new Error("ScannerService: 'onError' option is required and must be a function.");
        }

        this.cameraManager = new CameraManager();
        this.cameraManager.setVideoElement(this.options.videoElement);
        this.qrDecoder = new QrDecoder();

        // Create internal canvas for processing frames
        this.canvasElement = document.createElement('canvas');
        const context = this.canvasElement.getContext('2d', {
            willReadFrequently: true // Optimization for frequent getImageData
        });
        if (!context) {
            // Should not happen in modern browsers
            throw new Error("ScannerService: Could not create 2D canvas context.");
        }
        this.canvasContext = context;

        this.log(LogLevel.INFO, "ScannerService initialized.");
    }

    /**
     * Starts the camera stream and begins the scanning loop.
     * Handles camera permissions and setup.
     */
    async start(): Promise<void> {
        if (this.isScanning) {
            this.log(LogLevel.WARN, "ScannerService: start() called while already scanning.");
            return;
        }
        this.log(LogLevel.INFO, "ScannerService: Starting scan...");

        try {
            // Setup listeners before starting stream
            let metadataLoaded = false;
            const videoElement = this.options.videoElement;

            // Define listeners and store references
            this.onMetadataLoadedListener = () => {
                if (metadataLoaded || !this.isScanning) return;
                metadataLoaded = true;
                this.log(LogLevel.INFO, "ScannerService: 'loadedmetadata' event fired.");
                if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                    this.canvasElement.width = videoElement.videoWidth;
                    this.canvasElement.height = videoElement.videoHeight;
                    this.log(LogLevel.INFO, `ScannerService: Canvas dimensions set (${this.canvasElement.width}x${this.canvasElement.height}). Calling scanLoop().`);
                    this.scanLoop(); // Start the loop
                } else {
                    this.log(LogLevel.WARN, "ScannerService: 'loadedmetadata' fired but video dimensions are 0. Scan loop not started.");
                    // TODO: Consider adding delay/retry if video dimensions are 0
                }
            };

            this.onVideoErrorListener = (err: Event) => {
                if (this.isScanning) {
                    this.log(LogLevel.ERROR, "ScannerService: Video element error event.", err);
                    this.options.onError(new Error("Video element encountered an error during setup or playback."));
                    this.stop(); // Stop scanning on video error
                }
            };

            // Attach listeners
            // Use stored references when adding listeners
            videoElement.addEventListener('loadedmetadata', this.onMetadataLoadedListener, { once: true });
            videoElement.addEventListener('error', this.onVideoErrorListener, { once: true });

            // Start the stream
            await this.cameraManager.startStream(this.options.deviceId);
            this.isScanning = true;
            this.log(LogLevel.INFO, "ScannerService: Camera stream started successfully.");

            // Fallback check if 'loadedmetadata' event is missed
            if (!metadataLoaded && videoElement.readyState >= 2) { // HAVE_METADATA or higher
                 this.log(LogLevel.WARN, "ScannerService: 'loadedmetadata' potentially missed, triggering setup via readyState check.");
                 this.onMetadataLoadedListener(); // Call stored listener reference
            }

            // Listener removal is now handled in stop()
        } catch (error: any) {
            this.log(LogLevel.ERROR, "ScannerService: Failed to start camera.", error);
            this.isScanning = false;
            this.options.onError(error); // Forward the error via callback
            throw error; // Re-throw the error to reject the start() promise
        }
    }

    /**
     * Stops the scanning loop and releases the camera.
     */
    stop(): void {
        if (!this.isScanning) {
            // Already stopped
            return;
        }
        this.log(LogLevel.INFO, "ScannerService: Stopping scan...");
        this.isScanning = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Remove event listeners explicitly
        if (this.options.videoElement) {
            if (this.onMetadataLoadedListener) {
                this.options.videoElement.removeEventListener('loadedmetadata', this.onMetadataLoadedListener);
                this.onMetadataLoadedListener = null; // Clear reference
            }
            if (this.onVideoErrorListener) {
                this.options.videoElement.removeEventListener('error', this.onVideoErrorListener);
                this.onVideoErrorListener = null; // Clear reference
            }
        }

        this.cameraManager.stopStream();
        this.log(LogLevel.INFO, "ScannerService: Scan stopped.");
    }

    /**
     * The main loop that grabs frames, attempts decoding, and schedules the next frame.
     */
    private scanLoop = (): void => {
        // this.log(LogLevel.DEBUG, "ScannerService: scanLoop tick"); // Ensure commented out
        // Stop loop if scanning is no longer active or video element is invalid/paused/ended
        if (!this.isScanning || !this.cameraManager.videoElement || this.cameraManager.videoElement.paused || this.cameraManager.videoElement.ended) {
            // Don't call stop() here as it might have been called intentionally
            if (this.isScanning) {
                this.log(LogLevel.WARN, "ScannerService: Scan loop stopping due to video element state.");
                this.stop();
            }
            return;
        }

        // this.log(LogLevel.DEBUG, "ScannerService: scanLoop - Drawing frame to canvas"); // Ensure commented out

        try {
            // Ensure canvas dimensions match video
            if (this.canvasElement.width !== this.options.videoElement.videoWidth ||
                this.canvasElement.height !== this.options.videoElement.videoHeight) {
                this.canvasElement.width = this.options.videoElement.videoWidth;
                this.canvasElement.height = this.options.videoElement.videoHeight;
            }

            // Draw video frame to canvas
            this.canvasContext.drawImage(
                this.cameraManager.videoElement,
                0, 0,
                this.canvasElement.width, this.canvasElement.height
            );

            // Get image data
            const imageData = this.canvasContext.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);

            // Decode image data
            // this.log(LogLevel.DEBUG, "ScannerService: scanLoop - Decoding image data"); // Ensure commented out
            const decodedData = this.qrDecoder.decodeFromImageData(imageData);

            if (decodedData) {
                this.log(LogLevel.INFO, "ScannerService: scanLoop - QR Code detected!", decodedData);
                // console.log("ScannerService: QR Code detected!", decodedData); // Keep console log commented
                this.options.onScanSuccess(decodedData);
                if (this.options.stopOnScan) {
                    this.stop();
                    return;
                }
            
            } // End of if(decodedData)
        } catch (error: any) {
            this.log(LogLevel.ERROR, `ScannerService: Error in scan loop: ${error.message}`, error);
            // TODO: Consider calling onError callback for scan loop errors
            // this.options.onError(new Error(`Scan loop error: ${error.message}`));
        }

        // Schedule the next scan frame
        setTimeout(() => {
            if (this.isScanning) { // Check isScanning again before requesting next frame
                this.animationFrameId = requestAnimationFrame(this.scanLoop);
            }
        }, this.options.scanInterval);
    }

    /**
     * Gets the current scanning state.
     * @returns True if currently scanning, false otherwise.
     */
    getIsScanning(): boolean {
        return this.isScanning;
    }

    // Helper logging function
    private log(level: LogLevel, message: string, data?: unknown): void {
        // If an external logger is provided via options, use it
        if (this.options.logger) {
            // Call the external logger, passing the component name and optional data
            // The external logger (remoteLog) will handle formatting and stringifying data
            this.options.logger('Lib', level, 'ScannerService', message, data);
        } else {
            // Fallback to console if no logger provided (e.g., direct library use)
            const consoleArgs = data !== undefined ? [message, data] : [message];
            // Fallback console logging uses the LogLevel enum values
            switch (level) {
                case LogLevel.INFO: console.info(...consoleArgs); break;
                case LogLevel.WARN: console.warn(...consoleArgs); break;
                case LogLevel.ERROR: console.error(...consoleArgs); break;
                case LogLevel.DEBUG: console.debug(...consoleArgs); break; // Use enum for DEBUG
                default: console.log(...consoleArgs);
            }
        }
    }
}

export default ScannerService;
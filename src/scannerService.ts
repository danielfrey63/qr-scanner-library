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
    // Logger now expects source as first argument
    logger?: (source: string, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) => void;
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

        this.log('INFO', "ScannerService initialized.");
    }

    /**
     * Starts the camera stream and begins the scanning loop.
     * Handles camera permissions and setup.
     */
    async start(): Promise<void> {
        if (this.isScanning) {
            this.log('WARN', "ScannerService: start() called while already scanning.");
            return;
        }
        this.log('INFO', "ScannerService: Starting scan...");

        try {
            // Setup listeners before starting stream
            let metadataLoaded = false;
            const videoElement = this.options.videoElement;

            const onMetadataLoaded = () => {
                if (metadataLoaded || !this.isScanning) return;
                metadataLoaded = true;
                this.log('INFO', "ScannerService: 'loadedmetadata' event fired.");
                if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                    this.canvasElement.width = videoElement.videoWidth;
                    this.canvasElement.height = videoElement.videoHeight;
                    this.log('INFO', `ScannerService: Canvas dimensions set (${this.canvasElement.width}x${this.canvasElement.height}). Calling scanLoop().`);
                    this.scanLoop(); // Start the loop
                } else {
                    this.log('WARN', "ScannerService: 'loadedmetadata' fired but video dimensions are 0. Scan loop not started.");
                    // TODO: Consider adding delay/retry if video dimensions are 0
                }
            };

            const onVideoError = (err: Event) => {
                if (this.isScanning) {
                    this.log('ERROR', "ScannerService: Video element error event.", err);
                    this.options.onError(new Error("Video element encountered an error during setup or playback."));
                    this.stop();
                }
            };

            // Attach listeners
            videoElement.addEventListener('loadedmetadata', onMetadataLoaded, { once: true });
            videoElement.addEventListener('error', onVideoError, { once: true });

            // Start the stream
            await this.cameraManager.startStream(this.options.deviceId);
            this.isScanning = true;
            this.log('INFO', "ScannerService: Camera stream started successfully.");

            // Fallback check if 'loadedmetadata' event is missed
            if (!metadataLoaded && videoElement.readyState >= 2) { // HAVE_METADATA or higher
                 this.log('WARN', "ScannerService: 'loadedmetadata' potentially missed, triggering setup via readyState check.");
                 onMetadataLoaded();
            }

            // TODO: Explicitly remove listeners in stop()
        } catch (error: any) {
            this.log('ERROR', "ScannerService: Failed to start camera.", error);
            this.isScanning = false;
            this.options.onError(error);
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
        this.log('INFO', "ScannerService: Stopping scan...");
        this.isScanning = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // TODO: Explicitly remove listeners added in start()
        this.cameraManager.stopStream();
        this.log('INFO', "ScannerService: Scan stopped.");
    }

    /**
     * The main loop that grabs frames, attempts decoding, and schedules the next frame.
     */
    private scanLoop = (): void => {
        // this.log('DEBUG', "ScannerService: scanLoop tick"); // Ensure commented out
        // Stop loop if scanning is no longer active or video element is invalid/paused/ended
        if (!this.isScanning || !this.cameraManager.videoElement || this.cameraManager.videoElement.paused || this.cameraManager.videoElement.ended) {
            // Don't call stop() here as it might have been called intentionally
            if (this.isScanning) {
                this.log('WARN', "ScannerService: Scan loop stopping due to video element state.");
                this.stop();
            }
            return;
        }

        // this.log('DEBUG', "ScannerService: scanLoop - Drawing frame to canvas"); // Ensure commented out

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
            // this.log('DEBUG', "ScannerService: scanLoop - Decoding image data"); // Ensure commented out
            const decodedData = this.qrDecoder.decodeFromImageData(imageData);

            if (decodedData) {
                this.log('INFO', "ScannerService: scanLoop - QR Code detected!", decodedData);
                // console.log("ScannerService: QR Code detected!", decodedData); // Keep console log commented
                this.options.onScanSuccess(decodedData);
                if (this.options.stopOnScan) {
                    this.stop();
                    return;
                }
            
            } // End of if(decodedData)
        } catch (error: any) {
            this.log('ERROR', `ScannerService: Error in scan loop: ${error.message}`, error);
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
     * Static method to list available camera devices.
     * @returns A promise that resolves with an array of MediaDeviceInfo objects.
     */
    static async listCameras(): Promise<MediaDeviceInfo[]> {
        return CameraManager.listDevices();
    }

    /**
     * Gets the current scanning state.
     * @returns True if currently scanning, false otherwise.
     */
    getIsScanning(): boolean {
        return this.isScanning;
    }

    // Helper logging function
    private log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown): void {
        // If an external logger is provided via options, use it
        if (this.options.logger) {
            // Prepare the message, potentially including stringified data
            let logMessage = message;
            if (data !== undefined) {
                try {
                    // Append stringified data to the main message string
                    logMessage += ` ${JSON.stringify(data)}`;
                } catch (e) {
                    logMessage += ' [Unserializable data]'; // Append note if data can't be stringified
                }
            }
            // Call the external logger with source 'Lib', level, and combined message
            this.options.logger('Lib', level, logMessage);
        } else {
            // Fallback to console if no external logger is provided
            const consoleArgs = data !== undefined ? [message, data] : [message];
            switch (level) {
                case 'INFO': console.info(...consoleArgs); break;
                case 'WARN': console.warn(...consoleArgs); break;
                case 'ERROR': console.error(...consoleArgs); break;
                // case 'DEBUG': console.debug(...consoleArgs); break; // Keep DEBUG commented
                default: console.log(...consoleArgs);
            }
        }
    }
}

export default ScannerService;
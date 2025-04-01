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
    logger?: (source: string, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) => void;
};
/**
 * Service orchestrating camera access, frame grabbing, and QR code decoding.
 */
declare class ScannerService {
    private cameraManager;
    private qrDecoder;
    private options;
    private isScanning;
    private animationFrameId;
    private canvasElement;
    private canvasContext;
    /**
     * Initializes the ScannerService.
     * @param options - Configuration options for the scanner.
     * @throws Will throw an error if a 2D canvas context cannot be created.
     */
    constructor(options: ScannerOptions);
    /**
     * Starts the camera stream and begins the scanning loop.
     * Handles camera permissions and setup.
     */
    start(): Promise<void>;
    /**
     * Stops the scanning loop and releases the camera.
     */
    stop(): void;
    /**
     * The main loop that grabs frames, attempts decoding, and schedules the next frame.
     */
    private scanLoop;
    /**
     * Static method to list available camera devices.
     * @returns A promise that resolves with an array of MediaDeviceInfo objects.
     */
    static listCameras(): Promise<MediaDeviceInfo[]>;
    /**
     * Gets the current scanning state.
     * @returns True if currently scanning, false otherwise.
     */
    getIsScanning(): boolean;
    private log;
}
export default ScannerService;
//# sourceMappingURL=scannerService.d.ts.map
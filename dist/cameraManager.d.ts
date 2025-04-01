/**
 * Manages camera access and video stream handling.
 */
declare class CameraManager {
    videoElement: HTMLVideoElement | null;
    stream: MediaStream | null;
    /**
     * Initializes the CameraManager.
     * Currently doesn't use options, but could be extended.
     * @param options - Configuration options (currently unused).
     */
    constructor(options?: {
        videoElementId?: string;
    });
    /**
     * Requests camera access and starts the video stream.
     * @param deviceId - Optional specific camera device ID to use.
     * @returns A promise that resolves with the MediaStream.
     * @throws Will throw an error if camera access fails.
     */
    startStream(deviceId?: string): Promise<MediaStream>;
    /**
     * Stops the current video stream and releases camera access.
     */
    stopStream(): void;
    /**
     * Lists available video input devices (cameras).
     * @returns A promise that resolves with an array of MediaDeviceInfo objects.
     * @throws Will throw an error if the browser does not support device enumeration.
     */
    static listDevices(): Promise<MediaDeviceInfo[]>;
    /**
     * Sets the HTMLVideoElement to be used for displaying the stream.
     * @param element - The video element.
     */
    setVideoElement(element: HTMLVideoElement): void;
}
export default CameraManager;
//# sourceMappingURL=cameraManager.d.ts.map
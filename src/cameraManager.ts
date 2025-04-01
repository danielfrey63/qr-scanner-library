/**
 * Manages camera access and video stream handling.
 */
class CameraManager {
    videoElement: HTMLVideoElement | null = null;
    stream: MediaStream | null = null;

    /**
     * Initializes the CameraManager.
     * Currently doesn't use options, but could be extended.
     * @param options - Configuration options (currently unused).
     */
    constructor(options?: { videoElementId?: string }) {
        // Optional: Find element if ID provided (less flexible than setVideoElement)
        if (options?.videoElementId) {
            const el = document.getElementById(options.videoElementId);
            if (el instanceof HTMLVideoElement) {
                this.videoElement = el;
            } else {
                // console.warn(`Element with ID '${options.videoElementId}' not found or is not a video element.`); // Keep console for actual warnings if needed
            }
        }
    }

    /**
     * Requests camera access and starts the video stream.
     * @param deviceId - Optional specific camera device ID to use.
     * @returns A promise that resolves with the MediaStream.
     * @throws Will throw an error if camera access fails.
     */
    async startStream(deviceId?: string): Promise<MediaStream> {
        // console.log(`[CameraManager] startStream called. DeviceId: ${deviceId}`); // Removed debug log
        this.stopStream(); // Stop any existing stream first

        // Use simplified constraints for broader compatibility (especially desktop).
        // Request specific deviceId if provided, otherwise default video input.
        const constraints: MediaStreamConstraints = {
            video: deviceId ? { deviceId: { exact: deviceId } } : true,
            audio: false // No audio needed for QR scanning
        };

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("getUserMedia() not supported by this browser.");
            }
            // console.log("[CameraManager] Requesting getUserMedia with constraints:", JSON.stringify(constraints)); // Removed debug log
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            // console.log("[CameraManager] getUserMedia successful. Stream obtained."); // Removed debug log
            this.stream = stream;

            if (this.videoElement) {
                // console.log("[CameraManager] Video element found. Attaching stream."); // Removed debug log
                const video = this.videoElement;
                video.srcObject = stream;
                // console.log("[CameraManager] Stream attached to video element srcObject."); // Removed debug log
                // Required for iOS Safari: playsinline attribute needed on the video tag
                video.setAttribute('playsinline', 'true');

                // --- Try immediate play first ---
                try {
                    // console.log("[CameraManager] Attempting immediate video.play()..."); // Removed debug log
                    await video.play();
                    // console.log("[CameraManager] Immediate video.play() successful."); // Removed debug log
                    // If immediate play works, we still proceed to the promise wait below
                    // to ensure metadata/readiness events are handled consistently,
                    // but this might resolve faster in some cases.
                } catch (immediatePlayError) {
                    // console.warn("[CameraManager] Immediate video.play() failed, proceeding with event listeners/timeout.", immediatePlayError); // Removed debug log
                    // Fallback to event listeners/timeout below.
                }
                // --- End immediate play attempt ---


                // Fallback: Wait for metadata/readyState events if immediate play failed or is insufficient.
                await new Promise<void>((resolve, reject) => {
                    let timeoutId: ReturnType<typeof setTimeout> | null = null;
                    let intervalId: ReturnType<typeof setInterval> | null = null;
                    let resolved = false; // Flag to prevent multiple resolutions/rejections

                    const attemptPlay = async () => {
                        if (resolved) return; // Already handled
                        // console.log(`[CameraManager] Attempting play. ReadyState: ${video.readyState}`); // Removed debug log
                        try {
                            await video.play();
                            // console.log("[CameraManager] video.play() successful."); // Removed debug log
                            resolved = true;
                            cleanup();
                            resolve();
                        } catch (playError) {
                            // Ignore NotAllowedError/AbortError if cleanup already happened (e.g., component unmounted)
                            if (!resolved) {
                                // console.error("[CameraManager] Error during video.play():", playError); // Keep console for actual errors
                                resolved = true;
                                cleanup();
                                reject(new Error(`Failed to play video stream: ${playError instanceof Error ? playError.message : String(playError)}`));
                            } else {
                                // console.log("[CameraManager] video.play() error ignored as promise was already handled."); // Removed debug log
                            }
                        }
                    };

                    const cleanup = () => {
                        if (timeoutId) clearTimeout(timeoutId);
                        if (intervalId) clearInterval(intervalId);
                        video.onloadedmetadata = null;
                        video.onerror = null;
                        video.oncanplay = null;
                    };

                    timeoutId = setTimeout(() => {
                        if (resolved) return;
                        // console.log("[CameraManager] Timeout waiting for video readiness/playback."); // Removed debug log
                        resolved = true;
                        cleanup();
                        reject(new Error("Timeout waiting for video readiness or playback"));
                    }, 2000); // 2 second timeout

                    video.onloadedmetadata = () => {
                        if (resolved) return;
                        // console.log("[CameraManager] onloadedmetadata event fired."); // Removed debug log
                        attemptPlay();
                    };

                    video.oncanplay = () => {
                         if (resolved) return;
                         // console.log("[CameraManager] oncanplay event fired."); // Removed debug log
                         attemptPlay();
                    };

                    video.onerror = (event) => {
                        if (resolved) return;
                        // console.error("[CameraManager] video.onerror event fired.", event); // Keep console for actual errors
                        resolved = true;
                        cleanup();
                        reject(new Error("Video element reported an error."));
                    };

                    // Fallback check using readyState
                    intervalId = setInterval(() => {
                        if (resolved) return;
                        if (video.readyState >= 3) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
                            // console.log(`[CameraManager] readyState is ${video.readyState}, attempting play via interval.`); // Removed debug log
                            attemptPlay();
                        }
                    }, 500); // Check every 500ms

                });
            } else {
                // console.warn("CameraManager: Video element not set. Stream started but not attached."); // Keep console for actual warnings
            }

            return stream;
        } catch (error: any) {
            let errorMessage = `Camera Error: ${error.name}`;
            if (error.message) {
                errorMessage += ` - ${error.message}`;
            }
            // console.error(errorMessage, error); // Keep console for actual errors
            // Provide more specific error types if possible
            if (error.name === 'NotAllowedError') {
                throw new Error("Camera permission denied. Please allow camera access in your browser settings.");
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                throw new Error("No suitable camera found. Please ensure a camera is connected and enabled.");
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                throw new Error("Camera is already in use or cannot be accessed. Please close other applications using the camera.");
            } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
                throw new Error("Could not satisfy camera constraints (e.g., resolution, facing mode).");
            } else if (error.name === 'AbortError') {
                throw new Error("Camera start timed out or was aborted. Ensure the camera is not in use by another application and try again.");
            } else {
                throw new Error(errorMessage); // General error for other cases
            }
        }
    }

    /**
     * Stops the current video stream and releases camera access.
     */
    stopStream(): void {
        // console.log("[CameraManager] stopStream called."); // Removed debug log
        if (this.stream) {
            // console.log("[CameraManager] Active stream found. Stopping tracks."); // Removed debug log
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            if (this.videoElement) {
                this.videoElement.srcObject = null;
                this.videoElement.pause(); // Ensure video playback stops
                this.videoElement.removeAttribute('src'); // Clean up
            }
            // console.log("[CameraManager] Stream stopped successfully."); // Removed debug log
        }
    }

    /**
     * Lists available video input devices (cameras).
     * @returns A promise that resolves with an array of MediaDeviceInfo objects.
     * @throws Will throw an error if the browser does not support device enumeration.
     */
    static async listDevices(): Promise<MediaDeviceInfo[]> {
        if (!navigator.mediaDevices?.enumerateDevices) {
            throw new Error("Device enumeration (enumerateDevices) is not supported by this browser.");
        }
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            return videoDevices;
        } catch (error: any) {
            // console.error("Error listing devices:", error); // Keep console for actual errors
            throw new Error(`Failed to list devices: ${error.message}`);
        }
    }

    /**
     * Sets the HTMLVideoElement to be used for displaying the stream.
     * @param element - The video element.
     */
    setVideoElement(element: HTMLVideoElement): void {
        if (!(element instanceof HTMLVideoElement)) {
            throw new Error("Invalid element provided. Must be an HTMLVideoElement.");
        }
        this.videoElement = element;
        // console.log("Video element set for CameraManager."); // Removed debug log
    }
}

export default CameraManager;
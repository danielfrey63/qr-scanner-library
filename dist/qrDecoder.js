import jsQR from 'jsqr';
/**
 * Decodes QR codes from ImageData using the jsQR library.
 */
class QrDecoder {
    /**
     * Attempts to decode a QR code from the provided ImageData.
     * @param imageData - The ImageData object obtained from a canvas.
     * @returns The decoded string data if a QR code is found, otherwise null.
     */
    decodeFromImageData(imageData) {
        if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
            console.error("QrDecoder: Invalid ImageData provided.");
            return null;
        }
        try {
            // Use jsQR to find and decode the QR code
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
            // Options for jsQR:
            // inversionAttempts: "dontInvert", // default
            // inversionAttempts: "invertFirst",
            // inversionAttempts: "onlyInvert",
            // inversionAttempts: "both",
            });
            if (code && code.data) {
                // Basic validation: Ensure data is not empty
                if (code.data.trim().length > 0) {
                    return code.data;
                }
                else {
                    // console.log("QrDecoder: Found QR code but data is empty.");
                    return null;
                }
            }
            // console.log("QrDecoder: No QR code found in the image data.");
            return null; // No QR code found
        }
        catch (error) {
            // Log decoding errors, but don't stop the scanning process unless critical
            console.error("QrDecoder: Error during QR code decoding:", error.message, error);
            return null;
        }
    }
}
export default QrDecoder;
//# sourceMappingURL=qrDecoder.js.map
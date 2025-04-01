/**
 * Decodes QR codes from ImageData using the jsQR library.
 */
declare class QrDecoder {
    /**
     * Attempts to decode a QR code from the provided ImageData.
     * @param imageData - The ImageData object obtained from a canvas.
     * @returns The decoded string data if a QR code is found, otherwise null.
     */
    decodeFromImageData(imageData: ImageData): string | null;
}
export default QrDecoder;
//# sourceMappingURL=qrDecoder.d.ts.map
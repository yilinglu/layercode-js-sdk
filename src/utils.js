/**
 * Converts a base64 string to an ArrayBuffer.
 * @param {string} base64 - The base64 string to convert.
 * @returns {ArrayBuffer} The resulting ArrayBuffer.
 */
export function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts an ArrayBuffer to a base64 string.
 * @param {ArrayBuffer|Float32Array|Int16Array} arrayBuffer - The ArrayBuffer to convert.
 * @returns {string} The resulting base64 string.
 */
export function arrayBufferToBase64(arrayBuffer) {
  if (arrayBuffer instanceof Float32Array) {
    arrayBuffer = this.floatTo16BitPCM(arrayBuffer);
  } else if (arrayBuffer instanceof Int16Array) {
    arrayBuffer = arrayBuffer.buffer;
  }
  let binary = '';
  let bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000; // 32KB chunk size
  for (let i = 0; i < bytes.length; i += chunkSize) {
    let chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

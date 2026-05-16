/**
 * SSR safe check for WebGPU availability.
 * @returns true if WebGPU is available in navigator, false otherwise.
 *
 * @remarks
 * This only checks for the presence of the WebGPU API surface (`navigator.gpu`).
 * Even when this returns `true`, the actual GPU adapter may still fail to
 * initialize at session creation time due to driver, hardware, permission, or
 * browser-flag constraints.
 */
export function isWebGpuAvailable(): boolean {
	return typeof navigator !== "undefined" && "gpu" in navigator;
}

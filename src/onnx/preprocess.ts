import type { PreprocessOptions } from "./types";

const DEFAULT_INPUT_SIZE = 640;

const bufferCache = new Map<number, Float32Array>();

/**
 * Creates a Float32Array buffer for preprocessing image data.
 * The buffer is sized to hold 3 channels (RGB) for a square image of the specified input size.
 *
 * @param inputSize - The width and height of the input image (default is 640).
 * @returns A Float32Array buffer for preprocessing image data.
 *
 * @remarks
 * This function does not perform any image processing; it only allocates a buffer of the appropriate size.
 *
 * @example
 * ```ts
 * const buffer = createPreprocessBuffer(640);
 * console.log(buffer.length); // 1228800 (3 channels * 640 * 640)
 * ```
 */
export function createPreprocessBuffer(
	inputSize: number = DEFAULT_INPUT_SIZE,
): Float32Array {
	return new Float32Array(3 * inputSize * inputSize);
}

function getOrCreateCachedBuffer(inputSize: number): Float32Array {
	let buf = bufferCache.get(inputSize);
	if (!buf) {
		buf = createPreprocessBuffer(inputSize);
		bufferCache.set(inputSize, buf);
	}
	return buf;
}

/**
 * Converts RGBA pixel data from an ImageData object to a Float32Array in CHW format, scaled to the range [0, 1] by dividing by 255.
 *
 * @param imageData - The ImageData object containing RGBA pixel data to be converted. The width and height of the image should match the inputSize specified in options (default is 640).
 * @param options - Preprocessing options. `inputSize` controls the expected square edge length.
 *   `buffer`, when provided, is a caller-owned `Float32Array` of length `3 * inputSize * inputSize`
 *   that this function writes into and returns; this lets callers control allocation and retain
 *   the result safely across calls.
 * @returns A Float32Array containing the normalized RGB pixel data in CHW format
 *   (all R values, then all G values, then all B values).
 *   When `options.buffer` is provided, the returned reference is the same instance.
 *
 * @remarks
 *
 * When `options.buffer` is omitted, this function returns a module-level cached buffer
 * keyed by `inputSize`. Subsequent calls with the same `inputSize` reuse — and overwrite —
 * that same `Float32Array` instance. Any previously returned reference is therefore
 * invalidated by the next call.
 *
 * If you need to retain a result beyond the next call (e.g. queueing frames for async
 * inference), pass your own pre-allocated `Float32Array` via `options.buffer`.
 *
 * @throws {Error} If the provided buffer length does not match the expected size based on the inputSize.
 *
 * @example
 * With an ImageData object `imgData` and default options:
 * ```ts
 * const floatBuffer = rgbaToFloat32Chw(imgData);
 * console.log(floatBuffer.length); // 1228800 for inputSize 640
 * ```
 *
 * @example
 * With a custom input size and a pre-allocated buffer:
 * ```ts
 * const customBuffer = new Float32Array(3 * 320 * 320);
 * const floatBuffer = rgbaToFloat32Chw(imgData, { inputSize: 320, buffer: customBuffer });
 * console.log(floatBuffer.length); // 307200 for inputSize 320
 * ```
 */
export function rgbaToFloat32Chw(
	imageData: ImageData,
	options: PreprocessOptions = {},
): Float32Array {
	const inputSize = options.inputSize ?? DEFAULT_INPUT_SIZE;
	const channelSize = inputSize * inputSize;
	const required = 3 * channelSize;

	const buffer = options.buffer ?? getOrCreateCachedBuffer(inputSize);
	if (buffer.length !== required) {
		throw new Error(
			`rgbaToFloat32Chw: buffer length ${buffer.length} does not match expected ${required} for inputSize=${inputSize}`,
		);
	}

	const { data } = imageData;
	for (let i = 0; i < channelSize; i++) {
		const rgbaIdx = i * 4;
		buffer[i] = (data[rgbaIdx] as number) / 255;
		buffer[channelSize + i] = (data[rgbaIdx + 1] as number) / 255;
		buffer[2 * channelSize + i] = (data[rgbaIdx + 2] as number) / 255;
	}

	return buffer;
}

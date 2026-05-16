import type { PreprocessOptions } from "./types";

const DEFAULT_INPUT_SIZE = 640;

const bufferCache = new Map<number, Float32Array>();

/**
 * Allocates a fresh `Float32Array` sized for one CHW RGB image of
 * `inputSize × inputSize` — i.e. length `3 * inputSize * inputSize`.
 *
 * @param inputSize - Square edge length of the target image, in pixels. Defaults to 640.
 * @returns A newly allocated `Float32Array`, owned by the caller.
 *
 * @remarks
 * Use this to pre-allocate a buffer that you then pass into {@link rgbaToFloat32Chw}
 * via `options.buffer`. Owning the buffer at the call site is required when you
 * need to retain the conversion result beyond the next `rgbaToFloat32Chw` call
 * (the no-buffer path returns a shared module-level cache; see that function's
 * `@remarks` for the aliasing implications).
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

/**
 * Returns the module-level cached buffer for the given `inputSize`, lazily
 * allocating it on first access. Subsequent calls with the same `inputSize`
 * return the same `Float32Array` instance, so callers downstream of
 * {@link rgbaToFloat32Chw}'s no-buffer path share — and overwrite — this memory.
 *
 * The cache is intentional: it keeps the hot inference loop allocation-free
 * while letting callers opt out by passing their own `options.buffer`.
 *
 * @internal
 */
function getOrCreateCachedBuffer(inputSize: number): Float32Array {
	let buf = bufferCache.get(inputSize);
	if (!buf) {
		buf = createPreprocessBuffer(inputSize);
		bufferCache.set(inputSize, buf);
	}
	return buf;
}

/**
 * Converts RGBA pixel data from an `ImageData` object to a `Float32Array` in CHW format,
 * scaled to the range `[0, 1]` by dividing by 255.
 *
 * @param imageData - The `ImageData` object containing RGBA pixel data to be converted.
 *   Its `width` and `height` must equal `options.inputSize` (default 640); otherwise
 *   the function reads `inputSize * inputSize` source pixels regardless and produces
 *   undefined output.
 * @param options - Preprocessing options. `inputSize` controls the expected square edge length.
 *   `buffer`, when provided, is a caller-owned `Float32Array` of length `3 * inputSize * inputSize`
 *   that this function writes into and returns; this lets callers control allocation and retain
 *   the result safely across calls.
 * @returns A `Float32Array` containing the RGB pixel data in CHW format
 *   (all R values, then all G values, then all B values), scaled to `[0, 1]` by dividing by 255.
 *   When `options.buffer` is provided, the returned reference is that same instance;
 *   otherwise, the reference points into the module-level cache described in `@remarks`.
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

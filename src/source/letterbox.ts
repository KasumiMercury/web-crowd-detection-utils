import type {
	Box,
	CaptureSource,
	LetterboxCaptureResult,
	LetterboxCapturer,
	LetterboxCapturerOptions,
	LetterboxParams,
} from "./types";

const DEFAULT_PAD_COLOR = "rgb(114,114,114)";

export function computeLetterboxParams(
	sourceWidth: number,
	sourceHeight: number,
	inputSize: number,
): LetterboxParams {
	if (
		!Number.isFinite(sourceWidth) ||
		!Number.isFinite(sourceHeight) ||
		sourceWidth <= 0 ||
		sourceHeight <= 0
	) {
		throw new Error(
			`computeLetterboxParams: sourceWidth and sourceHeight must be positive finite numbers (got width=${sourceWidth}, height=${sourceHeight})`,
		);
	}
	if (!Number.isFinite(inputSize) || inputSize <= 0) {
		throw new Error(
			`computeLetterboxParams: inputSize must be a positive finite number (got ${inputSize})`,
		);
	}

	const scale = Math.min(inputSize / sourceWidth, inputSize / sourceHeight);
	const contentWidth = Math.round(sourceWidth * scale);
	const contentHeight = Math.round(sourceHeight * scale);
	const padX = Math.floor((inputSize - contentWidth) / 2);
	const padY = Math.floor((inputSize - contentHeight) / 2);

	return {
		inputSize,
		sourceWidth,
		sourceHeight,
		scale,
		padX,
		padY,
		contentWidth,
		contentHeight,
	};
}

function resolveSourceSize(source: CaptureSource): {
	width: number;
	height: number;
} {
	if (
		typeof HTMLVideoElement !== "undefined" &&
		source instanceof HTMLVideoElement
	) {
		return { width: source.videoWidth, height: source.videoHeight };
	}
	if (
		typeof HTMLImageElement !== "undefined" &&
		source instanceof HTMLImageElement
	) {
		return { width: source.naturalWidth, height: source.naturalHeight };
	}
	if (typeof VideoFrame !== "undefined" && source instanceof VideoFrame) {
		return { width: source.codedWidth, height: source.codedHeight };
	}
	const s = source as { width: number; height: number };
	return { width: s.width, height: s.height };
}

export function createLetterboxCapturer(
	options: LetterboxCapturerOptions,
): LetterboxCapturer {
	const { inputSize, padColor = DEFAULT_PAD_COLOR } = options;
	if (!Number.isFinite(inputSize) || inputSize <= 0) {
		throw new Error(
			`createLetterboxCapturer: inputSize must be a positive finite number (got ${inputSize})`,
		);
	}

	const canvas = document.createElement("canvas");
	canvas.width = inputSize;
	canvas.height = inputSize;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) {
		throw new Error(
			"createLetterboxCapturer: failed to acquire a 2D rendering context",
		);
	}

	return {
		canvas,
		inputSize,
		capture(source: CaptureSource): LetterboxCaptureResult {
			const { width: srcW, height: srcH } = resolveSourceSize(source);
			if (
				!Number.isFinite(srcW) ||
				!Number.isFinite(srcH) ||
				srcW <= 0 ||
				srcH <= 0
			) {
				throw new Error(
					`createLetterboxCapturer.capture: source dimensions must be positive finite numbers (got width=${srcW}, height=${srcH}). For HTMLVideoElement, ensure metadata has loaded.`,
				);
			}

			const params = computeLetterboxParams(srcW, srcH, inputSize);

			ctx.fillStyle = padColor;
			ctx.fillRect(0, 0, inputSize, inputSize);
			ctx.drawImage(
				source,
				params.padX,
				params.padY,
				params.contentWidth,
				params.contentHeight,
			);
			const imageData = ctx.getImageData(0, 0, inputSize, inputSize);
			return { imageData, params };
		},
	};
}

export function reverseLetterboxBox<B extends Box>(
	box: B,
	params: LetterboxParams,
): B {
	const inv = 1 / params.scale;
	return {
		...box,
		x1: (box.x1 - params.padX) * inv,
		y1: (box.y1 - params.padY) * inv,
		x2: (box.x2 - params.padX) * inv,
		y2: (box.y2 - params.padY) * inv,
	};
}

export function reverseLetterboxBoxes<B extends Box>(
	boxes: readonly B[],
	params: LetterboxParams,
): B[] {
	return boxes.map((b) => reverseLetterboxBox(b, params));
}

export function reverseStretchBox<B extends Box>(
	box: B,
	sourceWidth: number,
	sourceHeight: number,
	inputSize: number,
): B {
	const sx = sourceWidth / inputSize;
	const sy = sourceHeight / inputSize;
	return {
		...box,
		x1: box.x1 * sx,
		y1: box.y1 * sy,
		x2: box.x2 * sx,
		y2: box.y2 * sy,
	};
}

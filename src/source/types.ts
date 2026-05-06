export type CaptureSource = CanvasImageSource;

export interface CanvasFrameCapturerOptions {
	width: number;
	height: number;
}

export interface CanvasFrameCapturer {
	capture(source: CaptureSource): ImageData;
	readonly width: number;
	readonly height: number;
	readonly canvas: HTMLCanvasElement;
}

export interface Box {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface LetterboxParams {
	inputSize: number;
	sourceWidth: number;
	sourceHeight: number;
	scale: number;
	padX: number;
	padY: number;
	contentWidth: number;
	contentHeight: number;
}

export interface LetterboxCapturerOptions {
	inputSize: number;
	padColor?: string;
}

export interface LetterboxCaptureResult {
	imageData: ImageData;
	params: LetterboxParams;
}

export interface LetterboxCapturer {
	capture(source: CaptureSource): LetterboxCaptureResult;
	readonly inputSize: number;
	readonly canvas: HTMLCanvasElement;
}

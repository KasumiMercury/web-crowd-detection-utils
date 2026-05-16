import type * as ort from "onnxruntime-web/webgpu";

/**
 * ONNX Runtime Web execution provider to use for inference.
 *
 * - `"webgpu"` — GPU-accelerated via the WebGPU API. Requires `navigator.gpu`.
 * - `"wasm"` — CPU execution via WebAssembly. Available in any modern browser.
 */
export type ExecutionProvider = "webgpu" | "wasm";

/**
 * Result of a successful {@link InitSessionOptions | session initialization}.
 */
export interface SessionResult {
	/** The initialized ONNX Runtime inference session. */
	session: ort.InferenceSession;
	/** The execution provider the session was created with. Mirrors the requested provider. */
	backend: ExecutionProvider;
}

/**
 * Graph optimization level passed through to ONNX Runtime Web.
 * See ONNX Runtime documentation for the semantics of each level.
 */
export type GraphOptimizationLevel = NonNullable<
	ort.InferenceSession.SessionOptions["graphOptimizationLevel"]
>;

/**
 * Options for initializing an ONNX Runtime session.
 */
export interface InitSessionOptions {
	/** Execution provider to request. No automatic fallback is performed. */
	executionProvider: ExecutionProvider;
	/** Graph optimization level. Defaults to `"all"` when omitted. */
	graphOptimizationLevel?: GraphOptimizationLevel;
	/**
	 * Additional `InferenceSession.SessionOptions` to merge in.
	 * `executionProviders` is intentionally omitted — it is set from
	 * {@link InitSessionOptions.executionProvider} and cannot be overridden here.
	 */
	sessionOptions?: Omit<
		ort.InferenceSession.SessionOptions,
		"executionProviders"
	>;
}

/**
 * Options for RGBA → CHW Float32 preprocessing.
 */
export interface PreprocessOptions {
	/** Expected square edge length of the input image, in pixels. Defaults to 640. */
	inputSize?: number;
	/**
	 * Caller-owned destination buffer. Must have length `3 * inputSize * inputSize`.
	 *
	 * When omitted, a module-level cached buffer keyed by `inputSize` is used and
	 * returned; that cached buffer is overwritten by subsequent calls with the same
	 * `inputSize`. Pass an owned buffer here when you need to retain the result
	 * beyond the next call.
	 */
	buffer?: Float32Array;
}

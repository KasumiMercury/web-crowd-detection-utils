import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { startDetection } from "./detection";

const MODEL_URL = `${import.meta.env.BASE_URL}models/yolo26n.onnx`;

type Phase = "idle" | "preparing" | "running" | "finished" | "error";

function App() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const abortRef = useRef<AbortController | null>(null);

	const [videoFile, setVideoFile] = useState<File | null>(null);
	const [videoUrl, setVideoUrl] = useState<string | null>(null);
	const [phase, setPhase] = useState<Phase>("idle");
	const [status, setStatus] = useState(
		"Place your YOLO ONNX model at public/models/yolo26n.onnx, choose a video file, then press Start.",
	);
	const [currentCount, setCurrentCount] = useState(0);
	const [uniqueCount, setUniqueCount] = useState(0);

	useEffect(() => {
		if (!videoFile) {
			setVideoUrl(null);
			return;
		}
		const url = URL.createObjectURL(videoFile);
		setVideoUrl(url);
		return () => {
			URL.revokeObjectURL(url);
		};
	}, [videoFile]);

	const stop = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		const video = videoRef.current;
		if (video) {
			video.pause();
		}
	}, []);

	useEffect(() => stop, [stop]);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0] ?? null;
			stop();
			setVideoFile(file);
			setPhase("idle");
			setCurrentCount(0);
			setUniqueCount(0);
			setStatus(
				file
					? `Selected: ${file.name}. Press Start to begin detection.`
					: "No file selected.",
			);
		},
		[stop],
	);

	const handleStart = useCallback(async () => {
		if (!videoRef.current || !canvasRef.current) {
			return;
		}
		if (!videoFile) {
			setPhase("error");
			setStatus("Error: choose a video file first.");
			return;
		}
		setPhase("preparing");
		setStatus("Fetching model…");
		setCurrentCount(0);
		setUniqueCount(0);

		const video = videoRef.current;
		const canvas = canvasRef.current;
		const controller = new AbortController();
		abortRef.current = controller;

		const handleEnded = () => {
			controller.abort();
		};
		video.addEventListener("ended", handleEnded);

		try {
			const response = await fetch(MODEL_URL);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch ${MODEL_URL}: ${response.status} ${response.statusText}`,
				);
			}
			const buffer = await response.arrayBuffer();

			setStatus("Starting playback…");
			video.currentTime = 0;
			await video.play();

			setPhase("running");

			await startDetection({
				modelBuffer: buffer,
				video,
				canvas,
				signal: controller.signal,
				onStatus: setStatus,
				onCount: (current, unique) => {
					setCurrentCount(current);
					setUniqueCount(unique);
				},
			});
		} catch (err) {
			if (controller.signal.aborted) {
				return;
			}
			setPhase("error");
			setStatus(`Error: ${(err as Error).message}`);
			console.error(err);
		} finally {
			video.removeEventListener("ended", handleEnded);
			if (controller.signal.aborted) {
				if (video.ended) {
					setPhase("finished");
					setStatus("Finished.");
				} else {
					setPhase("idle");
					setStatus("Stopped.");
				}
			}
		}
	}, [videoFile]);

	const handleStop = useCallback(() => {
		stop();
		setPhase("idle");
		setStatus("Stopped.");
	}, [stop]);

	const running = phase === "running" || phase === "preparing";
	const canStart = !running && videoFile !== null;

	return (
		<div className="app">
			<header>
				<h1>YOLO + ByteTrack Person Counting</h1>
				<p className="subtitle">
					Extension of the <code>yolo-webcam</code> example: YOLO person
					detection on a <strong>video file</strong>, with{" "}
					<code>BYTETracker</code> assigning stable IDs and a running count of
					unique persons seen so far.
				</p>
			</header>

			<div className="controls">
				<input
					type="file"
					accept="video/*"
					onChange={handleFileChange}
					disabled={running}
				/>
				{running ? (
					<button type="button" onClick={handleStop}>
						Stop
					</button>
				) : (
					<button type="button" onClick={handleStart} disabled={!canStart}>
						Start
					</button>
				)}
				<code className="model-path">{MODEL_URL}</code>
			</div>

			<p className="status" data-phase={phase}>
				{status}
			</p>

			<div className="counts">
				<span className="count">
					<span className="count-label">Current</span>
					<span className="count-value">{currentCount}</span>
				</span>
				<span className="count">
					<span className="count-label">Unique total</span>
					<span className="count-value">{uniqueCount}</span>
				</span>
			</div>

			<div className="stage">
				<video
					ref={videoRef}
					src={videoUrl ?? undefined}
					playsInline
					muted
					controls
				/>
				<canvas ref={canvasRef} />
			</div>
		</div>
	);
}

export default App;

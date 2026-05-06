import type { KalmanFilter } from "./kalman";
import type { Observation } from "./types";
import { TrackState } from "./types";

function detToXyah(obs: Observation): number[] {
	const cx = (obs.x1 + obs.x2) / 2;
	const cy = (obs.y1 + obs.y2) / 2;
	const w = obs.x2 - obs.x1;
	const h = obs.y2 - obs.y1;
	return [cx, cy, w / (h || 1), h];
}

function xyahToXyxy(mean: number[]): [number, number, number, number] {
	const cx = mean[0] as number;
	const cy = mean[1] as number;
	const a = mean[2] as number;
	const h = mean[3] as number;
	const w = a * h;
	return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
}

export class STrack {
	trackId = 0;
	isActivated = false;
	state: TrackState = TrackState.New;

	mean: number[] = [];
	covariance: number[][] = [];

	score: number;
	startFrame = 0;
	endFrame = 0;
	trackletLen = 0;

	lastObs: Observation;

	constructor(obs: Observation) {
		this.lastObs = obs;
		this.score = obs.score;
	}

	get bbox(): [number, number, number, number] {
		if (this.mean.length > 0) {
			return xyahToXyxy(this.mean);
		}
		return [this.lastObs.x1, this.lastObs.y1, this.lastObs.x2, this.lastObs.y2];
	}

	activate(kf: KalmanFilter, frameId: number, trackId: number): void {
		this.trackId = trackId;
		const m = detToXyah(this.lastObs);
		const { mean, covariance } = kf.initiate(m);
		this.mean = mean;
		this.covariance = covariance;
		this.trackletLen = 0;
		this.state = TrackState.Tracked;
		this.isActivated = frameId === 1;
		this.startFrame = frameId;
		this.endFrame = frameId;
	}

	reActivate(kf: KalmanFilter, obs: Observation, frameId: number): void {
		const m = detToXyah(obs);
		const { mean, covariance } = kf.update(this.mean, this.covariance, m);
		this.mean = mean;
		this.covariance = covariance;
		this.lastObs = obs;
		this.score = obs.score;
		this.trackletLen = 0;
		this.state = TrackState.Tracked;
		this.isActivated = true;
		this.endFrame = frameId;
	}

	update(kf: KalmanFilter, obs: Observation, frameId: number): void {
		const m = detToXyah(obs);
		const { mean, covariance } = kf.update(this.mean, this.covariance, m);
		this.mean = mean;
		this.covariance = covariance;
		this.lastObs = obs;
		this.score = obs.score;
		this.trackletLen++;
		this.state = TrackState.Tracked;
		this.isActivated = true;
		this.endFrame = frameId;
	}

	predict(kf: KalmanFilter): void {
		const { mean, covariance } = kf.predict(this.mean, this.covariance);
		this.mean = mean;
		this.covariance = covariance;
	}

	markLost(): void {
		this.state = TrackState.Lost;
	}

	markRemoved(): void {
		this.state = TrackState.Removed;
	}
}

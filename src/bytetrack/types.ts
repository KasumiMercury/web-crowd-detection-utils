export const TrackState = {
	New: 0,
	Tracked: 1,
	Lost: 2,
	Removed: 3,
} as const;
export type TrackState = (typeof TrackState)[keyof typeof TrackState];

/**
 * 1検出 = 1観測
 * {x1, y1, x2, y2, score}を持つ任意のオブジェクトが構造的に互換
 * classId等，BYTETracker.update<T>に渡した型Tの追加フィールドは戻り値にも保持
 */
export interface Observation {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	score: number;
}

export interface TrackedBox {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	score: number;
	trackId: number;
}

export interface BYTETrackerOptions {
	/** Score threshold separating high vs. low confidence observations. */
	highThresh?: number;
	/** Stage 1 IoU-distance threshold (high-conf det × tracked + lost tracks). */
	matchThresh?: number;
	/** Stage 2 IoU-distance threshold (low-conf det × remaining tracked tracks). */
	secondMatchThresh?: number;
	/** Stage 3 IoU-distance threshold (remaining high-conf det × unconfirmed tracks). */
	unconfirmedMatchThresh?: number;
	/** Minimum score required for an unmatched observation to spawn a new track. */
	newTrackThresh?: number;
	/**
	 * IoU-distance below which two tracks are considered duplicates and
	 * the shorter-lived one is dropped. Lower = stricter (closer boxes
	 * required to be considered duplicates).
	 */
	duplicateIouThresh?: number;
	/** Number of frames a lost track is kept before removal. */
	trackBuffer?: number;
}

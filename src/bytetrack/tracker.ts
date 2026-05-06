/**
 * ByteTrack multi-object tracker.
 *
 * Reference:
 * FoundationVision/ByteTrack: [ECCV 2022] ByteTrack: Multi-Object Tracking by Associating Every Detection Box
 * https://github.com/FoundationVision/ByteTrack
 */

import {
	iouDistance,
	jointStracks,
	removeDuplicateStracks,
	subStracks,
} from "./association";
import {
	DEFAULT_DUPLICATE_IOU_THRESH,
	DEFAULT_HIGH_THRESH,
	DEFAULT_MATCH_THRESH,
	DEFAULT_NEW_TRACK_THRESH,
	DEFAULT_SECOND_MATCH_THRESH,
	DEFAULT_TRACK_BUFFER,
	DEFAULT_UNCONFIRMED_MATCH_THRESH,
} from "./constants";
import { linearAssignment } from "./hungarian";
import { KalmanFilter } from "./kalman";
import { STrack } from "./strack";
import type { BYTETrackerOptions, Observation, TrackedBox } from "./types";
import { TrackState } from "./types";

export class BYTETracker {
	private trackedStracks: STrack[] = [];
	private lostStracks: STrack[] = [];
	private removedStracks: STrack[] = [];
	private frameId = 0;
	private kf = new KalmanFilter();
	private nextId = 1;

	highThresh: number;
	matchThresh: number;
	secondMatchThresh: number;
	unconfirmedMatchThresh: number;
	newTrackThresh: number;
	duplicateIouThresh: number;
	trackBuffer: number;

	/** Total unique track IDs assigned so far. */
	get totalCount(): number {
		return this.nextId - 1;
	}

	constructor(opts?: BYTETrackerOptions) {
		this.highThresh = opts?.highThresh ?? DEFAULT_HIGH_THRESH;
		this.matchThresh = opts?.matchThresh ?? DEFAULT_MATCH_THRESH;
		this.secondMatchThresh =
			opts?.secondMatchThresh ?? DEFAULT_SECOND_MATCH_THRESH;
		this.unconfirmedMatchThresh =
			opts?.unconfirmedMatchThresh ?? DEFAULT_UNCONFIRMED_MATCH_THRESH;
		this.newTrackThresh = opts?.newTrackThresh ?? DEFAULT_NEW_TRACK_THRESH;
		this.duplicateIouThresh =
			opts?.duplicateIouThresh ?? DEFAULT_DUPLICATE_IOU_THRESH;
		this.trackBuffer = opts?.trackBuffer ?? DEFAULT_TRACK_BUFFER;
	}

	reset(): void {
		this.trackedStracks = [];
		this.lostStracks = [];
		this.removedStracks = [];
		this.frameId = 0;
		this.nextId = 1;
	}

	/**
	 * 1 フレーム分の観測結果を処理して、現在追跡中のトラックを返す。
	 *
	 * 入力 `T` は `Observation` のフィールドを満たす任意の型。`T` の追加
	 * フィールド (例: YOLO の `classId`) は最後にマッチした観測値から
	 * 戻り値にコピーされる。`x1,y1,x2,y2,score,trackId` は ByteTrack
	 * 側で確定するため、追加フィールドの同名キーは上書きされる。
	 *
	 * 処理フロー:
	 *   Stage 1: 高信頼度観測 × 全トラック (tracked ∪ lost) の IoU マッチング
	 *   Stage 2: 低信頼度観測 × Stage 1 でマッチしなかった tracked トラック
	 *            (遮蔽から復帰した対象を拾う — ByteTrack の肝)
	 *   Stage 3: Stage 1 でマッチしなかった高信頼度観測 × unconfirmed トラック
	 *   後処理: 新トラック生成, lost 期限切れ削除, duplicate 除去
	 */
	update<T extends Observation>(
		observations: T[],
	): (TrackedBox & Omit<T, keyof Observation>)[] {
		this.frameId++;

		const activated: STrack[] = [];
		const refound: STrack[] = [];
		const lost: STrack[] = [];
		const removed: STrack[] = [];

		const highDets = observations.filter((d) => d.score >= this.highThresh);
		const lowDets = observations.filter((d) => d.score < this.highThresh);

		const unconfirmed: STrack[] = [];
		const confirmed: STrack[] = [];
		for (const t of this.trackedStracks) {
			if (t.isActivated) confirmed.push(t);
			else unconfirmed.push(t);
		}

		// lost も候補に含める = 遮蔽後の re-ID を可能にする
		const pool = jointStracks([...confirmed], [...this.lostStracks]);

		for (const t of pool) t.predict(this.kf);
		for (const t of unconfirmed) t.predict(this.kf);

		/**
		 * Stage 1: 高信頼度観測 × 全トラックプール (tracked + lost)
		 * 安定した検出でトラックを更新し、lost トラックの再発見も同時に行う。
		 */
		const cost1 = iouDistance(pool, highDets);
		const {
			matches: m1,
			unmatchedA: uTracks1,
			unmatchedB: uDets1,
		} = linearAssignment(cost1, this.matchThresh, highDets.length);

		for (const [ti, di] of m1) {
			const track = pool[ti] as STrack;
			const obs = highDets[di] as T;
			if (track.state === TrackState.Tracked) {
				track.update(this.kf, obs, this.frameId);
				activated.push(track);
			} else {
				track.reActivate(this.kf, obs, this.frameId);
				refound.push(track);
			}
		}

		/**
		 * Stage 2: 低信頼度観測 × Stage 1 で余った tracked トラック
		 * スコアが低くても IoU が高ければマッチさせ、遮蔽/部分可視な対象を継続追跡する。
		 */
		const remainTracked = uTracks1
			.map((i) => pool[i] as STrack)
			.filter((t) => t.state === TrackState.Tracked);

		const cost2 = iouDistance(remainTracked, lowDets);
		const {
			matches: m2,
			unmatchedA: uTracks2,
			unmatchedB: uLowDets2,
		} = linearAssignment(cost2, this.secondMatchThresh, lowDets.length);

		for (const [ti, di] of m2) {
			const track = remainTracked[ti] as STrack;
			track.update(this.kf, lowDets[di] as T, this.frameId);
			activated.push(track);
		}

		for (const ti of uTracks2) {
			const track = remainTracked[ti] as STrack;
			if (track.state !== TrackState.Lost) {
				track.markLost();
				lost.push(track);
			}
		}

		/**
		 * Stage 3: Stage 1 で余った高信頼度観測 × unconfirmed トラック
		 * 直前フレームで初めて現れたトラック候補を確定させる。
		 */
		const remainDets = uDets1.map((i) => highDets[i] as T);
		const cost3 = iouDistance(unconfirmed, remainDets);
		const {
			matches: m3,
			unmatchedA: uUnconf,
			unmatchedB: uNewDets,
		} = linearAssignment(cost3, this.unconfirmedMatchThresh, remainDets.length);

		for (const [ti, di] of m3) {
			const track = unconfirmed[ti] as STrack;
			track.update(this.kf, remainDets[di] as T, this.frameId);
			activated.push(track);
		}

		for (const ti of uUnconf) {
			const track = unconfirmed[ti] as STrack;
			track.markRemoved();
			removed.push(track);
		}

		// ── Create new tracks from unmatched detections ──
		for (const di of uNewDets) {
			const obs = remainDets[di] as T;
			if (obs.score < this.newTrackThresh) continue;
			const track = new STrack(obs);
			track.activate(this.kf, this.frameId, this.nextId++);
			activated.push(track);
		}

		for (const i of uLowDets2) {
			const obs = lowDets[i] as T;
			if (obs.score < this.newTrackThresh) continue;
			const track = new STrack(obs);
			track.activate(this.kf, this.frameId, this.nextId++);
			activated.push(track);
		}

		// ── Expire lost tracks ──
		for (const t of this.lostStracks) {
			if (this.frameId - t.endFrame > this.trackBuffer) {
				t.markRemoved();
				removed.push(t);
			}
		}

		// ── Update track lists ──
		this.trackedStracks = this.trackedStracks.filter(
			(t) => t.state === TrackState.Tracked,
		);
		this.trackedStracks = jointStracks(this.trackedStracks, activated);
		this.trackedStracks = jointStracks(this.trackedStracks, refound);
		this.lostStracks = subStracks(this.lostStracks, this.trackedStracks);
		this.lostStracks.push(...lost);
		this.lostStracks = subStracks(this.lostStracks, this.removedStracks);
		this.removedStracks.push(...removed);

		const [dedupTracked, dedupLost] = removeDuplicateStracks(
			this.trackedStracks,
			this.lostStracks,
			this.duplicateIouThresh,
		);
		this.trackedStracks = dedupTracked;
		this.lostStracks = dedupLost;

		return this.trackedStracks
			.filter((t) => t.isActivated)
			.map((t) => {
				const [x1, y1, x2, y2] = t.bbox;
				return {
					...(t.lastObs as T),
					x1,
					y1,
					x2,
					y2,
					score: t.score,
					trackId: t.trackId,
				} as TrackedBox & Omit<T, keyof Observation>;
			});
	}
}

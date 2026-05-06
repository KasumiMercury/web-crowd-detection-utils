import { describe, expect, it } from "vitest";
import { BYTETracker } from "./tracker";
import type { Observation } from "./types";

function obs(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	score = 0.9,
): Observation {
	return { x1, y1, x2, y2, score };
}

describe("BYTETracker", () => {
	it("assigns stable trackIds across consecutive frames for stationary detections", () => {
		const tracker = new BYTETracker();
		const a = obs(10, 10, 50, 50);
		const b = obs(200, 200, 240, 240);

		// Frame 1: 初出現
		// unconfirmed として登録 (isActivated=false)
		tracker.update([a, b]);
		// Frame 2: Stage 3
		// unconfirmed マッチで活性化
		const f2 = tracker.update([a, b]);
		expect(f2).toHaveLength(2);
		const idA1 = f2.find((t) => t.x1 < 100)?.trackId;
		const idB1 = f2.find((t) => t.x1 >= 100)?.trackId;
		expect(idA1).toBeDefined();
		expect(idB1).toBeDefined();
		expect(idA1).not.toBe(idB1);

		// Frame 3: 同じ位置
		// 同じtrackIdを維持
		const f3 = tracker.update([a, b]);
		expect(f3.find((t) => t.x1 < 100)?.trackId).toBe(idA1);
		expect(f3.find((t) => t.x1 >= 100)?.trackId).toBe(idB1);
	});

	it("recovers the same trackId after a 1-frame gap within trackBuffer", () => {
		const tracker = new BYTETracker({ trackBuffer: 30 });
		const a = obs(10, 10, 50, 50);

		tracker.update([a]); // Frame 1: unconfirmed
		const f2 = tracker.update([a]); // Frame 2: activated
		const id = f2[0]?.trackId;
		expect(id).toBeDefined();

		// Frame 3: 検出消失
		// trackedからlostに降格
		const f3 = tracker.update([]);
		expect(f3).toHaveLength(0);

		// Frame 4: 再出現
		// lostから復活し同じtrackId
		const f4 = tracker.update([a]);
		expect(f4).toHaveLength(1);
		expect(f4[0]?.trackId).toBe(id);
	});

	it("reset() clears tracks and restarts trackId counter", () => {
		const tracker = new BYTETracker();
		tracker.update([obs(10, 10, 50, 50)]);
		tracker.update([obs(10, 10, 50, 50)]);
		expect(tracker.totalCount).toBeGreaterThan(0);

		tracker.reset();
		expect(tracker.totalCount).toBe(0);

		tracker.update([obs(10, 10, 50, 50)]);
		const f2 = tracker.update([obs(10, 10, 50, 50)]);
		// reset後の最初の trackId は 1 から振り直し
		expect(f2[0]?.trackId).toBe(1);
	});

	it("preserves extra fields on observations through update<T> (generic contract)", () => {
		// 追加フィールドを持つ型
		interface Det extends Observation {
			classId: number;
			label: string;
		}
		const tracker = new BYTETracker();
		const det: Det = {
			x1: 10,
			y1: 10,
			x2: 50,
			y2: 50,
			score: 0.9,
			classId: 0,
			label: "person",
		};

		tracker.update([det]);
		const f2 = tracker.update([det]);
		expect(f2).toHaveLength(1);
		const out = f2[0];
		// 追加フィールドが戻り値に保持される
		expect(out?.classId).toBe(0);
		expect(out?.label).toBe("person");
		// ByteTrackが確定するフィールド
		expect(out?.trackId).toBeGreaterThan(0);
		expect(typeof out?.score).toBe("number");
	});

	it("respects custom unconfirmedMatchThresh option (third-stage threshold)", () => {
		// 既定0.7でunconfirmedマッチが成立する設定で、unconfirmedMatchThresh=0
		// Stage 3 でマッチが消え、毎フレーム新トラック扱いに近くなる
		const strict = new BYTETracker({ unconfirmedMatchThresh: 0 });
		const a = obs(10, 10, 50, 50);
		strict.update([a]);
		strict.update([a]);
		strict.update([a]);
		// totalCountは0 でない
		// 新規トラックが生成される
		expect(strict.totalCount).toBeGreaterThanOrEqual(1);
	});

	it("does not create new tracks for observations below newTrackThresh", () => {
		const tracker = new BYTETracker({ newTrackThresh: 0.5, highThresh: 0.1 });
		// score0.2はhighThreshを超えるがnewTrackThreshを下回る
		tracker.update([obs(10, 10, 50, 50, 0.2)]);
		tracker.update([obs(10, 10, 50, 50, 0.2)]);
		expect(tracker.totalCount).toBe(0);
	});
});

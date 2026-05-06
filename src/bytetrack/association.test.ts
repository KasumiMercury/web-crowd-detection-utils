import { describe, expect, it } from "vitest";
import {
	iouDistance,
	jointStracks,
	removeDuplicateStracks,
	subStracks,
} from "./association";
import { STrack } from "./strack";
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

function makeTrack(
	o: Observation,
	opts?: { startFrame?: number; endFrame?: number; trackId?: number },
): STrack {
	const t = new STrack(o);
	t.trackId = opts?.trackId ?? 0;
	t.startFrame = opts?.startFrame ?? 0;
	t.endFrame = opts?.endFrame ?? 0;
	return t;
}

describe("iouDistance", () => {
	it("returns 0 distance for identical boxes (full overlap)", () => {
		const t = makeTrack(obs(0, 0, 10, 10), { trackId: 1 });
		const d = iouDistance([t], [obs(0, 0, 10, 10)]);
		expect(d[0]?.[0]).toBeCloseTo(0, 5);
	});

	it("returns ~1 distance for fully disjoint boxes", () => {
		const t = makeTrack(obs(0, 0, 10, 10), { trackId: 1 });
		const d = iouDistance([t], [obs(100, 100, 110, 110)]);
		expect(d[0]?.[0]).toBeCloseTo(1, 5);
	});

	it("yields a matrix with shape [tracks][observations]", () => {
		const t1 = makeTrack(obs(0, 0, 10, 10), { trackId: 1 });
		const t2 = makeTrack(obs(50, 50, 60, 60), { trackId: 2 });
		const d = iouDistance([t1, t2], [obs(0, 0, 10, 10), obs(50, 50, 60, 60)]);
		expect(d).toHaveLength(2);
		expect(d[0]).toHaveLength(2);

		// 対角: 0
		// 非対角: 1
		expect(d[0]?.[0]).toBeCloseTo(0, 5);
		expect(d[0]?.[1]).toBeCloseTo(1, 5);
		expect(d[1]?.[0]).toBeCloseTo(1, 5);
		expect(d[1]?.[1]).toBeCloseTo(0, 5);
	});
});

describe("jointStracks", () => {
	it("merges two arrays deduplicating by trackId", () => {
		const a = makeTrack(obs(0, 0, 1, 1), { trackId: 1 });
		const b = makeTrack(obs(0, 0, 1, 1), { trackId: 2 });
		const c = makeTrack(obs(0, 0, 1, 1), { trackId: 1 }); // duplicate id with a
		const result = jointStracks([a, b], [c]);
		expect(result).toHaveLength(2);
		expect(result.map((t) => t.trackId).sort()).toEqual([1, 2]);
		// 元の参照を優先
		expect(result.find((t) => t.trackId === 1)).toBe(a);
	});
});

describe("subStracks", () => {
	it("removes from a all tracks whose trackId appears in b", () => {
		const a1 = makeTrack(obs(0, 0, 1, 1), { trackId: 1 });
		const a2 = makeTrack(obs(0, 0, 1, 1), { trackId: 2 });
		const a3 = makeTrack(obs(0, 0, 1, 1), { trackId: 3 });
		const b = [makeTrack(obs(0, 0, 1, 1), { trackId: 2 })];
		const result = subStracks([a1, a2, a3], b);
		expect(result.map((t) => t.trackId)).toEqual([1, 3]);
	});
});

describe("removeDuplicateStracks", () => {
	it("keeps the longer-lived track when two are within duplicateIouThresh", () => {
		// 同じ位置の2トラック
		const a = makeTrack(obs(0, 0, 10, 10), {
			startFrame: 0,
			endFrame: 10,
			trackId: 1,
		});
		const b = makeTrack(obs(0, 0, 10, 10), {
			startFrame: 5,
			endFrame: 6,
			trackId: 2,
		});
		const [keptA, keptB] = removeDuplicateStracks([a], [b], 0.15);
		expect(keptA).toEqual([a]);
		expect(keptB).toEqual([]);
	});

	it("keeps both tracks when they are far apart", () => {
		const a = makeTrack(obs(0, 0, 10, 10), { trackId: 1 });
		const b = makeTrack(obs(100, 100, 110, 110), { trackId: 2 });
		const [keptA, keptB] = removeDuplicateStracks([a], [b], 0.15);
		expect(keptA).toEqual([a]);
		expect(keptB).toEqual([b]);
	});

	it("returns inputs unchanged when either array is empty", () => {
		const a = makeTrack(obs(0, 0, 10, 10), { trackId: 1 });
		const [keptA, keptB] = removeDuplicateStracks([a], [], 0.15);
		expect(keptA).toEqual([a]);
		expect(keptB).toEqual([]);
	});

	it("respects the duplicateIouThresh parameter", () => {
		// IoU = 1
		// → 距離 0
		// duplicate判定
		const a = makeTrack(obs(0, 0, 10, 10), {
			startFrame: 0,
			endFrame: 10,
			trackId: 1,
		});
		const b = makeTrack(obs(0, 0, 10, 10), {
			startFrame: 5,
			endFrame: 6,
			trackId: 2,
		});
		const [keptA1, keptB1] = removeDuplicateStracks([a], [b], 0.0001);
		expect(keptA1).toEqual([a]);
		expect(keptB1).toEqual([]);

		// IoU ~= 0.68
		// → 距離 ~= 0.32
		// 閾値0.15ではduplicateと判定されない
		const c = makeTrack(obs(0, 0, 10, 10), {
			startFrame: 0,
			endFrame: 10,
			trackId: 1,
		});
		const d = makeTrack(obs(1, 1, 11, 11), {
			startFrame: 5,
			endFrame: 6,
			trackId: 2,
		});
		const [keptC, keptD] = removeDuplicateStracks([c], [d], 0.15);
		expect(keptC).toEqual([c]);
		expect(keptD).toEqual([d]);
	});
});

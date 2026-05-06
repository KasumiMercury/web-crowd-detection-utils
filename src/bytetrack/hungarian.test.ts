import { describe, expect, it } from "vitest";
import { linearAssignment } from "./hungarian";

describe("linearAssignment", () => {
	it("returns empty result for empty cost matrix", () => {
		const r = linearAssignment([], 0.5);
		expect(r.matches).toEqual([]);
		expect(r.unmatchedA).toEqual([]);
		expect(r.unmatchedB).toEqual([]);
	});

	it("solves a 3x3 known-optimal assignment", () => {
		const cost = [
			[4, 1, 7],
			[8, 5, 2],
			[3, 9, 6],
		];
		const { matches, unmatchedA, unmatchedB } = linearAssignment(cost, 10);
		const map = new Map(matches);
		expect(map.get(0)).toBe(1);
		expect(map.get(1)).toBe(2);
		expect(map.get(2)).toBe(0);
		expect(unmatchedA).toEqual([]);
		expect(unmatchedB).toEqual([]);
	});

	it("filters out matches whose cost exceeds the threshold", () => {
		const cost = [
			[0.1, 0.9],
			[0.9, 0.2],
		];
		const { matches, unmatchedA, unmatchedB } = linearAssignment(cost, 0.5);
		expect(matches).toHaveLength(2);
		expect(matches.find(([a]) => a === 0)?.[1]).toBe(0);
		expect(matches.find(([a]) => a === 1)?.[1]).toBe(1);
		expect(unmatchedA).toEqual([]);
		expect(unmatchedB).toEqual([]);

		// 厳しい閾値だと両マッチとも閾値超え
		const cost2 = [
			[0.9, 0.1],
			[0.2, 0.9],
		];
		const r2 = linearAssignment(cost2, 0.05);
		expect(r2.matches).toEqual([]);
		expect(r2.unmatchedA.sort()).toEqual([0, 1]);
		expect(r2.unmatchedB.sort()).toEqual([0, 1]);
	});

	it("handles rectangular matrix where rows > cols", () => {
		const cost = [
			[0.1, 0.9],
			[0.9, 0.2],
			[0.5, 0.5],
		];
		const { matches, unmatchedA, unmatchedB } = linearAssignment(cost, 1.0);
		expect(matches).toHaveLength(2);
		expect(unmatchedA).toEqual([2]);
		expect(unmatchedB).toEqual([]);
	});

	it("handles rectangular matrix where cols > rows", () => {
		const cost = [
			[0.1, 0.9, 0.5],
			[0.9, 0.2, 0.6],
		];
		const { matches, unmatchedA, unmatchedB } = linearAssignment(cost, 1.0);
		expect(matches).toHaveLength(2);
		expect(unmatchedA).toEqual([]);
		expect(unmatchedB).toEqual([2]);
	});

	it("respects numCols when provided (used to track unmatched detections)", () => {
		// 空のコスト行列 + 引数で2列の検出を指定
		// unmatchedBが[0, 1]になる
		// BYTETrackerのlowDets/highDetsハンドリング相当
		const r = linearAssignment([], 0.5, 2);
		expect(r.matches).toEqual([]);
		expect(r.unmatchedA).toEqual([]);
		expect(r.unmatchedB).toEqual([0, 1]);
	});
});

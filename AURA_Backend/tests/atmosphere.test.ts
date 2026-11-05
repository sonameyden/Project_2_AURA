import { describe, expect, it } from "vitest";
import { sanitizeAtmosphereProfile } from "../src/lib/atmosphere/profileSchema";
import { estimateStructure, estimatedTimeline, shade, validateTimeline } from "../src/lib/atmosphere/sections";
import type { LyricLine } from "../src/types";

const base = sanitizeAtmosphereProfile(
  {
    emotion: "hopeful",
    energy: 0.8,
    valence: 0.7,
    environment: "Hopeful",
    primaryColorHex: "#336699",
    secondaryColorHexes: ["#FFAA00", "#00AAFF"],
    lightingStyle: "Soft",
    particleStyle: "Stars",
    kaleidoscopeStyle: "Floral",
    catBehavior: "Idle",
    transitionStyle: "Gentle",
  },
  "song-1"
);

describe("sanitizeAtmosphereProfile", () => {
  it("replaces illegal enum values and colours with safe defaults", () => {
    const profile = sanitizeAtmosphereProfile(
      { environment: "Space", catBehavior: "Dancing", primaryColorHex: "blue", energy: 7, resonantLyricLineIds: ["1", "2"] },
      "x"
    );
    expect(profile.environment).toBe("Dream");
    // The top-level cat stays in the Kotlin app's enum.
    expect(profile.catBehavior).toBe("Idle");
    expect(profile.primaryColorHex).toMatch(/^#[0-9A-F]{6}$/);
    expect(profile.energy).toBe(1);
    expect(profile.resonantLyricLineIds).toEqual(["1"]);
    expect(profile.songId).toBe("x");
  });
});

describe("section timelines", () => {
  it("lays a standard structure over the duration without lyrics", () => {
    const spans = estimateStructure(240_000, []);
    expect(spans[0]).toMatchObject({ section: "Intro", start: 0 });
    expect(spans.at(-1)).toMatchObject({ section: "Outro", end: 240_000 });
    for (let i = 1; i < spans.length; i += 1) expect(spans[i].start).toBe(spans[i - 1].end);
  });

  it("detects the chorus from repeated lyric lines", () => {
    const verse = (n: number, at: number): LyricLine => ({ id: `v${n}`, text: `verse line ${n}`, startTimeMs: at, endTimeMs: at + 4_000 });
    const chorus = (n: number, at: number): LyricLine => ({ id: `c${n}`, text: `we rise again ${n % 2}`, startTimeMs: at, endTimeMs: at + 4_000 });
    const lyrics = [
      verse(1, 10_000), verse(2, 14_000), verse(3, 18_000),
      chorus(1, 22_000), chorus(2, 26_000), chorus(3, 30_000),
      verse(4, 34_000), verse(5, 38_000), verse(6, 42_000),
      chorus(4, 46_000), chorus(5, 50_000), chorus(6, 54_000),
    ];
    const sections = estimateStructure(80_000, lyrics).map((span) => span.section);
    expect(sections[0]).toBe("Intro");
    expect(sections).toContain("Chorus");
    expect(sections).toContain("FinalChorus");
  });

  it("styles choruses brighter and gives a high-energy chorus a dancing cat", () => {
    const timeline = estimatedTimeline(base, 240_000, []);
    const chorus = timeline.find((section) => section.section === "Chorus")!;
    expect(chorus.catBehavior).toBe("Dancing");
    expect(chorus.lightingStyle).toBe("Bright");
    expect(chorus.primaryColorHex).toBe("#FFAA00");
    expect(timeline.at(-1)?.lightingStyle).toBe("Fading");
  });

  it("validates AI timelines: sorts, clamps and rejects junk", () => {
    const valid = validateTimeline(
      {
        sections: [
          { section: "Chorus", startTimeMs: 60_000, environment: "Ocean", catBehavior: "Dancing", primaryColorHex: "#112233" },
          { section: "Intro", startTimeMs: 500, environment: "Nowhere", primaryColorHex: "red" },
          { section: "Verse", startTimeMs: 20_000 },
          { section: "Outro", startTimeMs: 999_999 },
        ],
      },
      base,
      200_000
    )!;
    expect(valid.map((section) => section.section)).toEqual(["Intro", "Verse", "Chorus"]);
    expect(valid[0].startTimeMs).toBe(0);
    expect(valid[0].environment).toBe("Hopeful");
    expect(valid[0].primaryColorHex).toBe(base.primaryColorHex);
    expect(valid[2]).toMatchObject({ environment: "Ocean", catBehavior: "Dancing", endTimeMs: 200_000 });
    expect(validateTimeline({ sections: [{ section: "Intro", startTimeMs: 0 }] }, base, 200_000)).toBeNull();
  });

  it("shades colours towards white or black", () => {
    expect(shade("#808080", 1)).toBe("#FFFFFF");
    expect(shade("#808080", -1)).toBe("#000000");
  });
});

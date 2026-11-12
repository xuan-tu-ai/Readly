import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatAvatar } from "@/components/art/avatars";
import { BadgeArt } from "@/components/art/badge";
import { Confetti } from "@/components/art/celebration";
import { LevelEmblem } from "@/components/art/level";
import { DiscussionIcon, NotificationIcon } from "@/components/art/notification-icons";
import { MASCOT_POSES, Mascot } from "@/components/mascot/mascot";
import {
  AVATARS,
  BADGE_EMBLEMS,
  BADGE_TIERS,
  DISCUSSION_MARKERS,
  LEVELS,
  NOTIFICATION_KINDS,
} from "@/lib/art";

const html = (element: ReactElement) => renderToStaticMarkup(element);

function expectUnique(keys: readonly (string | number)[]) {
  expect(new Set(keys).size).toBe(keys.length);
}

describe("art registry", () => {
  it("has unique keys in every list (keys are stored in the database)", () => {
    expectUnique(BADGE_EMBLEMS.map((e) => e.key));
    expectUnique(BADGE_TIERS.map((t) => t.key));
    expectUnique(AVATARS.map((a) => a.key));
    expectUnique(NOTIFICATION_KINDS.map((n) => n.key));
    expectUnique(DISCUSSION_MARKERS.map((d) => d.key));
    expectUnique(MASCOT_POSES.map((p) => p.pose));
  });

  it("has increasing level thresholds starting at 0", () => {
    expect(LEVELS[0].minPoints).toBe(0);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minPoints).toBeGreaterThan(LEVELS[i - 1].minPoints);
      expect(LEVELS[i].level).toBe(i + 1);
    }
  });
});

describe("art components render for every key", () => {
  it("badges: every emblem × tier, locked and with a ribbon", () => {
    for (const { key } of BADGE_EMBLEMS) {
      for (const { key: tier } of BADGE_TIERS) {
        const out = html(createElement(BadgeArt, { emblem: key, tier, label: `${key} ${tier}` }));
        expect(out).toMatch(/^<svg[^>]*role="img"[^>]*aria-label="[^"]+"/);
        expect(out).toContain("<path");
      }
      const locked = html(createElement(BadgeArt, { emblem: key, tier: "gold", locked: true, caption: "7 NGÀY" }));
      expect(locked).toContain("grayscale(1)");
      expect(locked).toContain("7 NGÀY");
    }
  });

  it("levels, avatars, mascot poses and notification tiles", () => {
    for (const { level } of LEVELS) {
      expect(html(createElement(LevelEmblem, { level }))).toContain(`aria-label="Cấp ${level}:`);
    }
    for (const { key } of AVATARS) {
      expect(html(createElement(CatAvatar, { avatar: key }))).toMatch(/^<svg/);
    }
    for (const { pose } of MASCOT_POSES) {
      expect(html(createElement(Mascot, { pose }))).toContain(`data-pose="${pose}"`);
    }
    for (const { key } of NOTIFICATION_KINDS) {
      expect(html(createElement(NotificationIcon, { kind: key }))).toContain("<svg");
    }
    for (const { key } of DISCUSSION_MARKERS) {
      expect(html(createElement(DiscussionIcon, { marker: key }))).toContain("<svg");
    }
  });

  it("decorative art is hidden from screen readers", () => {
    expect(html(createElement(BadgeArt, { emblem: "books", tier: "gold", label: "" }))).toContain('aria-hidden="true"');
    expect(html(createElement(CatAvatar, { avatar: "muop", label: "" }))).toContain('aria-hidden="true"');
  });

  it("confetti is deterministic, so server and client markup match", () => {
    expect(html(createElement(Confetti, { count: 12 }))).toBe(html(createElement(Confetti, { count: 12 })));
  });
});

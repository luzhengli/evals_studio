import { beforeEach, describe, expect, test } from "bun:test";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLocale,
  setI18nStorage,
  setLocale,
  t,
  tv,
} from "../src/web/i18n.ts";

function fakeStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    dump: () => Object.fromEntries(m),
  };
}

describe("i18n", () => {
  beforeEach(() => {
    setI18nStorage(fakeStorage());
  });

  test("default locale is zh-CN", () => {
    expect(DEFAULT_LOCALE).toBe("zh-CN");
    expect(getLocale()).toBe("zh-CN");
    expect(t("nav.dashboard")).toBe("仪表盘");
    expect(t("targets.title")).toBe("评测目标");
  });

  test("switching to en-US changes key copy", () => {
    setLocale("en-US");
    expect(getLocale()).toBe("en-US");
    expect(t("nav.dashboard")).toBe("dashboard");
    expect(t("targets.title")).toBe("eval targets");
    setLocale("zh-CN");
    expect(t("nav.dashboard")).toBe("仪表盘");
  });

  test("setLocale persists to storage and is restored on re-init", () => {
    const storage = fakeStorage();
    setI18nStorage(storage);
    setLocale("en-US");
    expect(storage.dump()[LOCALE_STORAGE_KEY]).toBe("en-US");
    // simulate a page reload: re-init from the same storage
    setI18nStorage(storage);
    expect(getLocale()).toBe("en-US");
    expect(t("nav.settings")).toBe("settings");
  });

  test("invalid stored locale falls back to zh-CN", () => {
    setI18nStorage(fakeStorage({ [LOCALE_STORAGE_KEY]: "fr-FR" }));
    expect(getLocale()).toBe("zh-CN");
  });

  test("throwing storage falls back to default and never crashes", () => {
    setI18nStorage({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(getLocale()).toBe("zh-CN");
    expect(() => setLocale("en-US")).not.toThrow();
    expect(getLocale()).toBe("en-US"); // in-memory switch still works
  });

  test("params interpolation", () => {
    expect(t("dashboard.statTargetsSub", { prompts: 2, skills: 3 })).toBe("2 个提示词 · 3 个技能");
    setLocale("en-US");
    expect(t("dashboard.statTargetsSub", { prompts: 2, skills: 3 })).toBe("2 prompt · 3 skill");
    expect(t("samples.listTitle", { count: 7 })).toBe("samples (7)");
  });

  test("missing param leaves the placeholder intact (diagnosable)", () => {
    expect(t("dashboard.statTargetsSub", { prompts: 1 })).toContain("{skills}");
  });

  test("missing key renders the key itself instead of crashing", () => {
    expect(t("no.such.key" as any)).toBe("no.such.key");
  });

  test("tv translates known dynamic values and passes unknown values through", () => {
    expect(tv("status", "done")).toBe("已完成");
    expect(tv("cause", "prompt-instruction-defect")).toBe("提示词指令缺陷");
    expect(tv("status", "some-new-backend-status")).toBe("some-new-backend-status");
    setLocale("en-US");
    expect(tv("status", "done")).toBe("done");
  });
});

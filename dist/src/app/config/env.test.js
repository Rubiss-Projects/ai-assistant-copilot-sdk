import { describe, it, expect } from "vitest";
import { env } from "./env.js";
describe("env", () => {
    it("env() returns value when present", () => {
        process.env.__TEST_VAR__ = "hello";
        expect(env("__TEST_VAR__")).toBe("hello");
        delete process.env.__TEST_VAR__;
    });
    it("env() returns undefined for missing non-required var", () => {
        delete process.env.__MISSING_VAR__;
        expect(env("__MISSING_VAR__")).toBeUndefined();
    });
    it("env() throws for missing required var", () => {
        delete process.env.__MISSING_VAR__;
        expect(() => env("__MISSING_VAR__", true)).toThrow("Missing required environment variable: __MISSING_VAR__");
    });
});

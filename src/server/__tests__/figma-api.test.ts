import { describe, it, expect, vi, beforeEach } from "vitest";
import { FigmaApiClient } from "../figma-api.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("FigmaApiClient", () => {
  let client: FigmaApiClient;

  beforeEach(() => {
    client = new FigmaApiClient("figd_test_token");
    mockFetch.mockReset();
  });

  describe("verifyToken", () => {
    it("should return user info on valid token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "123", handle: "hassan", email: "h@test.com" }),
      });
      const user = await client.verifyToken();
      expect(user).toEqual({ id: "123", handle: "hassan", email: "h@test.com" });
      expect(mockFetch).toHaveBeenCalledWith("https://api.figma.com/v1/me", {
        headers: { "X-Figma-Token": "figd_test_token" },
      });
    });

    it("should return null on invalid token", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
      const user = await client.verifyToken();
      expect(user).toBeNull();
    });
  });

  describe("getFile", () => {
    it("should fetch and return file document", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "Test File",
          lastModified: "2026-02-27",
          document: { id: "0:0", type: "DOCUMENT", children: [
            { id: "0:1", name: "Page 1", type: "CANVAS", children: [
              { id: "1:2", name: "Frame", type: "FRAME", absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 200 }, children: [] },
            ]},
          ]},
          styles: {},
          components: {},
        }),
      });
      const file = await client.getFile("abc123");
      expect(file).not.toBeNull();
      expect(file!.name).toBe("Test File");
      expect(file!.document.children).toHaveLength(1);
    });

    it("should return null on 404", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const file = await client.getFile("invalid");
      expect(file).toBeNull();
    });
  });

  describe("getNodes", () => {
    it("should fetch specific nodes by ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nodes: {
            "1:2": { document: { id: "1:2", name: "Frame", type: "FRAME" } },
          },
        }),
      });
      const nodes = await client.getNodes("abc123", ["1:2"]);
      expect(nodes).toHaveProperty("1:2");
      expect(nodes!["1:2"].document.name).toBe("Frame");
    });
  });

  describe("getImage", () => {
    it("should return image URL for node", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: { "1:2": "https://figma-cdn.com/image.png" },
        }),
      });
      const url = await client.getImage("abc123", "1:2", { format: "png", scale: 2 });
      expect(url).toBe("https://figma-cdn.com/image.png");
    });
  });

  describe("extractFileKey", () => {
    it("should extract key from design URL", () => {
      expect(FigmaApiClient.extractFileKey("https://www.figma.com/design/abc123XYZ/My-File")).toBe("abc123XYZ");
    });

    it("should extract key from file URL", () => {
      expect(FigmaApiClient.extractFileKey("https://www.figma.com/file/abc123XYZ/My-File")).toBe("abc123XYZ");
    });

    it("should return raw key if not a URL", () => {
      expect(FigmaApiClient.extractFileKey("abc123XYZ")).toBe("abc123XYZ");
    });

    it("should return null for invalid URL", () => {
      expect(FigmaApiClient.extractFileKey("https://www.google.com")).toBeNull();
    });
  });
});

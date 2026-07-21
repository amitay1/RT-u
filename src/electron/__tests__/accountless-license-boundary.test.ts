import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readWorkspaceFile = (relativePath: string): string => (
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
);

describe("accountless RT-PT runtime boundary", () => {
  const app = readWorkspaceFile("src/App.tsx");
  const index = readWorkspaceFile("src/pages/Index.tsx");
  const menuBar = readWorkspaceFile("src/components/MenuBar.tsx");

  it("gates the active workspace with the independent RT-PT license provider", () => {
    expect(app).toContain("RtPtLicenseProvider");
    expect(app).toContain("RtPtLicenseGate");
    expect(app).not.toMatch(/from ["'].+pages\/Auth["']/);
    expect(app).not.toContain('path="/auth"');
  });

  it("does not expose a username, password, sign-in, or sign-out runtime path", () => {
    expect(index).not.toMatch(/useAuth|useNavigate|signOut|\/auth/);
    expect(menuBar).not.toMatch(/onSignOut|Sign Out|LogOut/);
  });

  it("preserves the existing local document owner identity independently of licensing", () => {
    expect(index).toContain('id: "00000000-0000-0000-0000-000000000000"');
    expect(index).toContain("user: RT_PT_LOCAL_OWNER");
  });
});

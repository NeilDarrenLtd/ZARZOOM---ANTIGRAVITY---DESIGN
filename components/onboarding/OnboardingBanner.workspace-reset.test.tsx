/**
 * Tests that banner visibility is workspace-specific: dismissing in one workspace
 * must not hide the banner in another. When workspaceSwitchKey changes, dismissed
 * state is reset so the banner can show for the new workspace.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import OnboardingBanner from "./OnboardingBanner";

let workspaceSwitchKey = 1;
let needsBanner = true;
let isLoading = false;
let status = "in_progress";

jest.mock("@/lib/workspace/context", () => ({
  useWorkspaceSwitchKey: () => workspaceSwitchKey,
}));
jest.mock("@/lib/onboarding/useOnboarding", () => ({
  useOnboarding: () => ({ needsBanner, status, isLoading }),
}));
jest.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

function getBannerElement(container: HTMLElement): Element | null {
  return container.querySelector(".bg-amber-50");
}

function getDismissButton(container: HTMLElement): Element | null {
  return container.querySelector('button[aria-label]');
}

describe("OnboardingBanner workspace-specific visibility", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    workspaceSwitchKey = 1;
    needsBanner = true;
    isLoading = false;
    status = "in_progress";
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("shows banner when needsBanner is true and not dismissed", () => {
    act(() => {
      root.render(<OnboardingBanner />);
    });
    expect(getBannerElement(container)).not.toBeNull();
  });

  it("hides banner after dismiss click", () => {
    act(() => {
      root.render(<OnboardingBanner />);
    });
    expect(getBannerElement(container)).not.toBeNull();
    const dismissBtn = getDismissButton(container);
    expect(dismissBtn).not.toBeNull();
    act(() => {
      (dismissBtn as HTMLButtonElement).click();
    });
    expect(getBannerElement(container)).toBeNull();
  });

  it("resets dismissed when workspaceSwitchKey changes (banner visible again for new workspace)", () => {
    act(() => {
      root.render(<OnboardingBanner />);
    });
    expect(getBannerElement(container)).not.toBeNull();
    const dismissBtn = getDismissButton(container);
    act(() => {
      (dismissBtn as HTMLButtonElement).click();
    });
    expect(getBannerElement(container)).toBeNull();
    // Simulate workspace switch: key changes so effect runs and setDismissed(false)
    workspaceSwitchKey = 2;
    act(() => {
      root.render(<OnboardingBanner />);
    });
    expect(getBannerElement(container)).not.toBeNull();
  });

  it("does not show banner when needsBanner is false (onboarding complete for workspace)", () => {
    needsBanner = false;
    act(() => {
      root.render(<OnboardingBanner />);
    });
    expect(getBannerElement(container)).toBeNull();
  });
});

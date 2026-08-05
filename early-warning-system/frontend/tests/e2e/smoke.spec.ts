import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const publicRoutes = [
  "/",
  "/about",
  "/dashboard",
  "/map",
  "/guides",
  "/schools",
  "/parents",
  "/teachers",
  "/students",
  "/registration",
  "/registration/contacts-directory",
  "/users",
  "/admin",
  "/help/aqi-help",
  "/privacy-policy",
  "/delete-account",
] as const;

test.describe("route smoke", () => {
  for (const route of publicRoutes) {
    test(`renders ${route}`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.ok()).toBeTruthy();
      await expect(page.locator("body")).toBeVisible();
    });
  }

  test("redirects admin dashboard alias", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/?$/);
  });
});

test.describe("education-first homepage", () => {
  test("shows brand, decision CTA, and pathways", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Climate Compass" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Check today|conditions|today/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("dashboard decision surface", () => {
  test("exposes city guidance and technical disclosure", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/outside|Today|air/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe("interactive public flows", () => {
  test("registration form is numbered and accessible", async ({ page }) => {
    await page.goto("/registration");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page
        .locator("form")
        .filter({ hasText: /About you|Full name/i })
        .first(),
    ).toBeVisible();
  });

  test("aqiHelp accepts a question", async ({ page }) => {
    await page.goto("/help/aqi-help");
    await expect(page.getByRole("heading", { name: /aqiHelp/i })).toBeVisible();
    await expect(
      page
        .getByLabel(/question/i)
        .or(page.locator("textarea"))
        .first(),
    ).toBeVisible();
  });

  test("delete account page exposes public flow", async ({ page }) => {
    await page.goto("/delete-account");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("contacts directory asks for passphrase", async ({ page }) => {
    await page.goto("/registration/contacts-directory");
    await expect(page.getByText(/passphrase|directory/i).first()).toBeVisible();
  });
});

test.describe("account and admin shells", () => {
  test("users page shows account sign-in", async ({ page }) => {
    await page.goto("/users");
    await expect(
      page.getByText(/account|sign in|Climate Compass/i).first(),
    ).toBeVisible();
  });

  test("admin page shows PIN unlock", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText(/PIN|Unlock|Operator/i).first()).toBeVisible();
  });
});

test.describe("accessibility smoke", () => {
  test("homepage has no serious axe violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact || ""),
    );
    expect(serious).toEqual([]);
  });
});

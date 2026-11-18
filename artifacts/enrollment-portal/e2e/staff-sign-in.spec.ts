import { expect, test } from "@playwright/test";

test("admin and staff sign-in routes render the protected sign-in page", async ({
  page,
}) => {
  for (const route of ["/admin/sign-in", "/staff/sign-in"]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", {
        name: "Sign in to M-soft Account Protection",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Welcome back! Please sign in to continue"),
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`${route.replaceAll("/", "\\/")}(\\?|$)`),
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/admin/sign-in", "/staff/sign-in"]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", {
        name: "Sign in to M-soft Account Protection",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    const card = await page.locator("main").boundingBox();
    expect(card).not.toBeNull();
    expect(card!.x).toBeGreaterThanOrEqual(0);
    expect(card!.x + card!.width).toBeLessThanOrEqual(390);
  }
});

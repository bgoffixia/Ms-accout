import { expect, test } from "@playwright/test";

test("admin and staff sign-in routes render the protected sign-in page", async ({
  page,
}) => {
  for (const route of ["/admin/sign-in", "/staff/sign-in"]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Welcome back." }),
    ).toBeVisible();
    await expect(
      page.getByText("Protected access for your enrollment journey"),
    ).toBeVisible();
    await expect(page.locator(".cl-card")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/admin/sign-in", "/staff/sign-in"]) {
    await page.goto(route);
    await expect(page.locator(".cl-card")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    const card = await page.locator(".cl-card").boundingBox();
    expect(card).not.toBeNull();
    expect(card!.x).toBeGreaterThanOrEqual(0);
    expect(card!.x + card!.width).toBeLessThanOrEqual(390);
  }
});

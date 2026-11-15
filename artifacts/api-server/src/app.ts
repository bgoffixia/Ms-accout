import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes/index.js";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware.js";

const app = express();

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use("/api/admin/settings", express.json({ limit: "40mb" }));
app.use(
  express.json({
    limit: "4mb",
    verify(request: any, _response: any, body: Uint8Array) {
      if (request.originalUrl?.split("?")[0] === "/api/webhooks/infobip/sms") {
        // Preserve the raw webhook bytes without depending on Node Buffer
        // declarations in this package's browser-oriented TypeScript config.
        request.rawBody = new Uint8Array(body);
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req: any) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req as { headers: Record<string, string | string[] | undefined> }) ?? "",
      (globalThis as any)["process"]?.["env"]?.["CLERK_PUBLISHABLE_KEY"],
    ),
  })),
);

app.use("/api", router);

export default app;

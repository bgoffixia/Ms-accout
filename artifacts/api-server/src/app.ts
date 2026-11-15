import express, { type Request, type Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware.js";

const app = express();

// Keep structured request logging without relying on pino-http's CommonJS
// callable export, which is not typed consistently across ESM/NodeNext builds.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        req: { method: req.method, url: req.originalUrl.split("?")[0] },
        res: { statusCode: res.statusCode },
        responseTime: Date.now() - startedAt,
      },
      "request completed",
    );
  });
  next();
});

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use("/api/admin/settings", express.json({ limit: "40mb" }));
app.use(
  express.json({
    limit: "4mb",
    verify(request: Request, _response: Response, body: Buffer) {
      if (request.url?.split("?")[0] === "/api/webhooks/infobip/sms") {
        (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(body);
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;

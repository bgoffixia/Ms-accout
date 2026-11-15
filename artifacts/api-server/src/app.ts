import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { Buffer } from "node:buffer";
import process from "node:process";
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
// callable export, which is not typed consistently across ESM builds.
app.use((req: Request, res: Response, next: NextFunction) => {
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
      if (request.originalUrl.split("?")[0] === "/api/webhooks/infobip/sms") {
        (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(body);
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req: Request) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;

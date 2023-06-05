import express, { NextFunction, Request, Response } from "express";
import LogService from "../services/logService";
import { decode } from "next-auth/jwt";

const router = express.Router();

router.use("/", async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (token?.toString() == "undefined" || !token)
    return res.status(401).send("Unauthorized");

  const decodedToken = await decode({
    token,
    secret: "klajsdflksjdflkdvdssdq231e1w",
  });

  if (!decodedToken) {
    return res.status(401).send("Unauthorized");
  } else {
    const logServiceInstance = new LogService(decodedToken);
    req.logServiceInstance = logServiceInstance;
    next();
  }
});

router.route("/score").get(async (req, res, next) => {
  const { logServiceInstance } = req;
  if (!logServiceInstance) throw new Error();

  const logs = await logServiceInstance.getLog("score");

  return res.status(200).json(logs);
});

router.route("/point").get(async (req, res, next) => {
  const { logServiceInstance } = req;
  if (!logServiceInstance) throw new Error();

  const logs = await logServiceInstance.getLog("point");
  return res.status(200).json(logs);
});

router.route("/deposit").get(async (req, res, next) => {
  const { logServiceInstance } = req;
  if (!logServiceInstance) throw new Error();

  const logs = await logServiceInstance.getLog("deposit");

  return res.status(200).json(logs);
});

module.exports = router;
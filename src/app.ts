const dotenv = require("dotenv");
dotenv.config();

import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import ErrorHandler from "./middlewares/ErrorHandler";
import helmet from "helmet";
import compression from "compression";
import dbConnect from "./db/conn";
import { config } from "./config/config";
import { dbSet } from "./middlewares/dbSet";

//router
const user = require("./routes/user");
const vote = require("./routes/vote");
const plaza = require("./routes/plaza");
const place = require("./routes/place");
const book = require("./routes/book");
const admin = require("./routes/admin/admin");

class App {
  private app: express.Application;
  private port: number;

  constructor() {
    this.port = parseInt(config.server.port.toString());
    this.app = express();
    this.setupMiddlewares();
    this.setupRoutes();
  }

  setupMiddlewares() {
    // middleware 설정
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cors({}));
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(dbSet);
  }

  setupRoutes() {
    // 라우터 설정
    this.app.get("/", (req, res, next) => res.send("hello world"));
    this.app.use("/user", user);
    this.app.use("/vote", vote);
    this.app.use("/plaza", plaza);
    this.app.use("/place", place);
    this.app.use("/book", book);
    this.app.use("/admin", admin);

    this.app.use(ErrorHandler);
  }

  listen() {
    // 서버 실행
    this.app.listen(this.port, async () => {
      await dbConnect();
      console.log(`Server is listening on port ${this.port}`);
    });
  }
}

const app = new App();
app.listen();

import { JWT } from "next-auth/jwt";
import { Log } from "../db/models/log";

export default class LogService {
  private token: JWT;
  constructor(token?: JWT) {
    this.token = token as JWT;
  }

  async getLog(type: string) {
    const logs = await Log.find(
      {
        $and: [{ "meta.type": type }, { "meta.uid": this.token.uid }],
      },
      "-_id timestamp message meta"
    );

    return logs;
  }

  async getAllLog(type: string) {
    const logs = await Log.find(
      { "meta.type": type },
      "-_id timestamp message meta"
    );

    return logs;
  }
}

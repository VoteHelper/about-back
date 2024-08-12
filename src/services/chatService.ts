import dayjs from "dayjs";
import { JWT } from "next-auth/jwt";
import { Chat } from "../db/models/chat";
import { IUser, User } from "../db/models/user";
import FcmService from "./fcmService";
import WebPushService from "./webPushService";

export default class ChatService {
  private token: JWT;
  private fcmServiceInstance: FcmService;
  private webPushServiceInstance: WebPushService;

  constructor(token?: JWT) {
    this.token = token as JWT;
    this.fcmServiceInstance = new FcmService();
    this.webPushServiceInstance = new WebPushService();
  }

  async getChat(userId: string) {
    const user1 = this.token.id > userId ? userId : this.token.id;
    const user2 = this.token.id < userId ? userId : this.token.id;
    try {
      const chat = await Chat.findOne({ user1, user2 }).populate([
        "user1",
        "user2",
      ]);
      if (!chat) return;
      const opponent =
        (chat.user1 as IUser).id == this.token.id
          ? (chat.user2 as IUser)
          : (chat.user1 as IUser);
      return { opponent, contents: chat?.contents };
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async getChats() {
    try {
      const chats = await Chat.find({
        $or: [{ user1: this.token.id }, { user2: this.token.id }],
      });

      const chatWithUsers = await Promise.all(
        chats.map(async (chat) => {
          const opponentUid =
            chat.user1 == this.token.id ? chat.user2 : chat.user1;
          const opponent = await User.findById(opponentUid);

          return {
            user: opponent,
            content: chat.contents.length
              ? chat.contents[chat.contents.length - 1]
              : null,
          };
        }),
      );

      return chatWithUsers.sort((a, b) => {
        if (!a.content || !b.content) {
          return 1;
        }
        const dateA = dayjs(a.content.createdAt);
        const dateB = dayjs(b.content.createdAt);
        return dateA.isAfter(dateB) ? -1 : 1;
      });
    } catch (err: any) {
      throw new Error(err);
    }
  }
  async getRecentChat() {
    try {
      const chat = await Chat.find({
        $or: [{ user1: this.token.id }, { user2: this.token.id }],
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (chat.length) {
        return chat?.[0]._id;
      } else {
        return "no chat";
      }
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async createChat(toUserId: string, message: string) {
    const user1 = this.token.id > toUserId ? toUserId : this.token.id;
    const user2 = this.token.id < toUserId ? toUserId : this.token.id;

    try {
      const chat = await Chat.findOne({ user1, user2 });

      const contentFill = {
        content: message,
        userId: this.token.id,
      };

      if (chat) {
        await chat.updateOne({ $push: { contents: contentFill } });
        await chat.save();
      } else {
        await Chat.create({
          user1,
          user2,
          contents: [contentFill],
        });
      }
    } catch (err: any) {
      throw new Error(err);
    }

    const toUser = await User.findById(toUserId);
    if (toUser) {
      await this.fcmServiceInstance.sendNotificationToX(
        toUser.uid,
        "쪽지를 받았어요!",
        message,
      );
      await this.webPushServiceInstance.sendNotificationToX(
        toUser.uid,
        "쪽지를 받았어요!",
        message,
      );
    }
  }
}

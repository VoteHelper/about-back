import { JWT } from "next-auth/jwt";
import { NotificationSub } from "../db/models/notificationSub";
import { IUser } from "../db/models/user";
import dayjs from "dayjs";
import { findOneVote } from "../utils/voteUtils";
import { GroupStudy } from "../db/models/groupStudy";
const webPush = require("web-push");
const PushNotifications = require("node-pushnotifications");

export default class WebPushService {
  private token: JWT;
  private basePayload: Object;
  private settings: any;

  constructor(token?: JWT) {
    this.token = token as JWT;
    this.settings = {
      web: {
        vapidDetails: {
          subject: "mailto:alsrhks0503@gmail.com",
          publicKey: process.env.PUBLIC_KEY,
          privateKey: process.env.PRIVATE_KEY,
        },
        gcmAPIKey: "gcmkey",
        TTL: 2419200,
        contentEncoding: "aes128gcm",
        headers: {},
      },
      android: {
        priority: "high", // 우선 순위 설정
      },
      isAlwaysUseFCM: true,
    };

    // Send 201 - resource created
    this.basePayload = {
      title: "스터디 투표",
      body: "스터디 마감이 얼마 남지 않았어요. 지금 신청하세요!",
      badge:
        "https://studyabout.s3.ap-northeast-2.amazonaws.com/%EB%8F%99%EC%95%84%EB%A6%AC/ALogo.png",
      icon: "https://studyabout.s3.ap-northeast-2.amazonaws.com/%EB%8F%99%EC%95%84%EB%A6%AC/144.png",

      data: {
        url: "https://studyabout.herokuapp.com/",
        notificationType: "studyReminder",
      },
      tag: "unique_tag_for_this_notification",
      requireInteraction: true,
      silent: false,
      renotify: true,
      timestamp: Date.now(),
      vibrate: [100, 50, 100],
      priority: "high",
    };
  }

  async subscribe(subscription: any) {
    try {
      const data = await NotificationSub.findOne({
        uid: this.token.uid,
        endpoint: subscription.endpoint,
      });

      if (!data) {
        const newSubscription = new NotificationSub({
          ...subscription,
          uid: this.token?.uid,
        });

        await newSubscription.save();
      }

      return;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async sendNotificationAllUser() {
    try {
      const subscriptions = await NotificationSub.find();

      subscriptions.forEach((subscription) => {
        const push = new PushNotifications(this.settings);

        // Create payload
        push.send(subscription, this.basePayload, (err: any, result: any) => {
          if (err) {
            console.log(err);
          } else {
          }
        });
      });
      return;
    } catch (err) {
      return;
    }
  }

  async sendNotificationToX(uid: string, title?: string, description?: string) {
    const payload = JSON.stringify({
      ...this.basePayload,
      title: title || "테스트 알림이에요",
      body: description || "테스트 알림이에요",
    });

    try {
      const subscriptions = await NotificationSub.find({ uid });

      subscriptions.forEach((subscription) => {
        const push = new PushNotifications(this.settings);

        push.send(subscription, payload, (err: any, result: any) => {
          console.log(result);
          if (err) throw new Error(err);
        });
      });
      return;
    } catch (err) {
      return;
    }
  }
  async sendNotificationGroupStudy(id: string) {
    const payload = JSON.stringify({
      ...this.basePayload,
      title: "소모임에 누군가 가입했어요!",
      body: "소모임을 확인해보세요.",
    });

    const members = new Set();
    const groupStudy = await GroupStudy.findOne({ id }).populate([
      "participants.user",
    ]);

    groupStudy?.participants.forEach((participant) => {
      members.add((participant.user as IUser).uid);
    });

    const memberArray = Array.from(members);
    const subscriptions = await NotificationSub.find({
      uid: { $in: memberArray },
    });

    subscriptions.forEach((subscription) => {
      const push = new PushNotifications(this.settings);
      push.send(subscription, payload, (err: any, result: any) => {
        if (err) throw new Error(err);
      });
    });
    return;
  }

  async sendNotificationVoteResult() {
    const failure = new Set();
    const success = new Set();

    const date = dayjs().startOf("day").toDate();
    const vote = await findOneVote(date);

    vote?.participations.forEach((participation) => {
      if (participation.status == "dismissed") {
        participation.attendences?.forEach((attendence) => {
          failure.add((attendence.user as IUser).uid.toString());
        });
      } else if (participation.status == "open") {
        participation.attendences?.forEach((attendence) => {
          success.add((attendence.user as IUser).uid.toString());
        });
      }
    });

    const successPayload = JSON.stringify({
      ...this.basePayload,
      title: "스터디가 오픈했어요!",
      body: "스터디 투표 결과를 확인해보세요.",
    });

    const failPayload = JSON.stringify({
      ...this.basePayload,
      title: "오늘은 스터디가 열리지 않았어요.",
      body: "내일 스터디 투표를 참여해보세요",
    });

    try {
      const subscriptions = await NotificationSub.find();

      subscriptions.forEach((subscription) => {
        const push = new PushNotifications(this.settings);

        if (failure.has(subscription.uid)) {
          push.send(subscription, failPayload, (err: any, result: any) => {
            if (err) throw new Error(err);
          });
        } else if (success.has(subscription.uid)) {
          push.send(subscription, successPayload, (err: any, result: any) => {
            if (err) throw new Error(err);
          });
        }
      });
      return;
    } catch (err) {
      return;
    }
  }
}

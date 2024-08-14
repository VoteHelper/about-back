import { Types } from "mongoose";
import { JWT } from "next-auth/jwt";
import { commentType, Feed, subCommentType } from "../db/models/feed";
import { IUser, User } from "../db/models/user";
import { convertUsersToSummary } from "../utils/convertUtils";
import ImageService from "./imageService";
import { C_simpleUser } from "../utils/constants";

export default class FeedService {
  private token: JWT;
  private imageServiceInstance: ImageService;

  constructor(token?: JWT) {
    this.token = token as JWT;
    this.imageServiceInstance = new ImageService(token);
  }

  async findFeedByType(
    type?: string,
    typeId?: string,
    cursor?: number | null,
    isRecent?: boolean,
  ) {
    try {
      const gap = 12;
      let start = gap * (cursor || 0);

      const query: any = { type };
      if (typeId && typeId.trim() !== "") {
        query.typeId = typeId;
      }

      const feeds = await Feed.find(query)
        .populate(["writer", "like", "comments.user"])
        .populate({
          path: "comments.subComments.user",
          select: C_simpleUser,
        })
        .sort({ createdAt: isRecent ? -1 : 1 })
        .skip(start)
        .limit(gap);

      if (isRecent === false) {
        feeds.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
      }

      return feeds?.map((feed) => {
        const myLike = (feed?.like as IUser[])?.find(
          (who) => who.uid === this.token.uid,
        );
        let modifiedLike;
        if (myLike) {
          modifiedLike = [
            myLike,
            ...(feed.like as IUser[])
              .filter((who) => who.uid !== myLike.uid)
              .slice(0, 7),
          ];
        } else {
          modifiedLike = feed.like.slice(0, 8);
        }
        return {
          ...feed.toObject(),
          like: modifiedLike,
          likeCnt: feed?.like?.length,
        };
      });
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async findFeedById(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        console.log("objectId type error");
      }

      const feed = await Feed.findById(id)
        .populate(["writer", "like", "comments.user"])
        .populate({
          path: "comments.subComments.user",
          select: C_simpleUser,
        });
      const myLike = (feed?.like as IUser[])?.find(
        (who) => who.uid === this.token.uid,
      );
      let modifiedLike;
      if (myLike) {
        modifiedLike = [
          myLike,
          ...(feed?.like as IUser[])
            .filter((who) => who.uid !== myLike.uid)
            .slice(0, 7),
        ];
      } else {
        modifiedLike = feed?.like.slice(0, 8);
      }
      return {
        ...feed?.toObject(),
        like: modifiedLike,
        likeCnt: feed?.like?.length,
      };
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async findFeedLikeById(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        console.log("ObjectId type error");
      }
      const feed = await Feed.findById(id).populate(["like"]);
      return convertUsersToSummary(feed?.like as IUser[]);
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async findAllFeeds(cursor: number | null, isRecent?: boolean) {
    try {
      const gap = 12;
      let start = gap * (cursor || 0);

      const feeds = await Feed.find()
        .populate(["writer", "like", "comments.user"])
        .populate({
          path: "comments.subComments.user",
          select: C_simpleUser,
        })
        .sort({ createdAt: isRecent ? -1 : 1 })
        .skip(start)
        .limit(gap);

      return feeds?.map((feed) => {
        const myLike = (feed?.like as IUser[])?.find(
          (who) => who.uid === this.token.uid,
        );
        let modifiedLike;
        if (myLike) {
          modifiedLike = [
            myLike,
            ...(feed.like as IUser[])
              .filter((who) => who.uid !== myLike.uid)
              .slice(0, 7),
          ];
        } else {
          modifiedLike = feed.like.slice(0, 8);
        }
        return {
          ...feed.toObject(),
          like: modifiedLike,
          likeCnt: feed?.like?.length,
        };
      });
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async createFeed({
    title,
    text,
    type,
    buffers,
    typeId,
    isAnonymous,
    subCategory,
  }: any) {
    try {
      const images = await this.imageServiceInstance.uploadImgCom(
        "feed",
        buffers,
      );
      await Feed.create({
        title,
        text,
        writer: this.token.id,
        type,
        typeId,
        images,
        isAnonymous,
        subCategory,
      });
      return;
    } catch (err: any) {
      throw new Error(err);
    }
  }
  async createComment(feedId: string, content: string) {
    try {
      const feed = await Feed.findById(feedId);

      const message: commentType = {
        user: this.token.id,
        comment: content,
      };
      await feed?.updateOne({ $push: { comments: message } });
      await feed?.save();

      const user = await User.findOne({ uid: this.token.uid });
      if (user) user.point += 2;
      await user?.save();

      return;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async deleteComment(feedId: string, commentId: string) {
    try {
      const feed = await Feed.findById(feedId);

      await feed?.updateOne({ $pull: { comments: { _id: commentId } } });
      await feed?.save();
      return;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async updateComment(feedId: string, commentId: string, comment: string) {
    try {
      const result = await Feed.findOneAndUpdate(
        { _id: feedId, "comments._id": commentId },
        {
          $set: {
            "comments.$.comment": comment,
          },
        },
      );

      return result;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async createCommentLike(feedId: string, commentId: string) {
    try {
      const feed = await Feed.findOneAndUpdate(
        {
          _id: feedId,
          "comments._id": commentId,
        },
        {
          $addToSet: { "comments.$.likeList": this.token.id },
        },
        { new: true }, // 업데이트된 도큐먼트를 반환
      );

      if (!feed) {
        throw new Error("해당 feedId 또는 commentId를 찾을 수 없습니다.");
      }
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async createSubCommentLike(
    feedId: string,
    commentId: string,
    subCommentId: string,
  ) {
    try {
      const feed = await Feed.findOneAndUpdate(
        {
          _id: feedId,
          "comments._id": commentId,
          "comments.subComments._id": subCommentId,
        },
        {
          $addToSet: {
            "comments.$[comment].subComments.$[subComment].likeList":
              this.token.id,
          },
        },
        {
          arrayFilters: [
            { "comment._id": commentId },
            { "subComment._id": subCommentId },
          ],
          new: true, // 업데이트된 도큐먼트를 반환
        },
      );

      if (!feed) {
        throw new Error("해당 feedId 또는 commentId를 찾을 수 없습니다.");
      }
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async createSubComment(feedId: string, commentId: string, content: string) {
    try {
      const message: subCommentType = {
        user: this.token.id,
        comment: content,
      };

      await Feed.updateOne(
        {
          _id: feedId,
          "comments._id": commentId,
        },
        { $push: { "comments.$.subComments": message } },
      );

      return;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async deleteSubComment(
    feedId: string,
    commentId: string,
    subCommentId: string,
  ) {
    try {
      await Feed.updateOne(
        {
          _id: feedId,
          "comments._id": commentId,
        },
        { $pull: { "comments.$.subComments": { _id: subCommentId } } },
      );
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async updateSubComment(
    feedId: string,
    commentId: string,
    subCommentId: string,
    comment: string,
  ) {
    try {
      await Feed.updateOne(
        {
          _id: feedId,
          "comments._id": commentId,
          "comments.subComments._id": subCommentId,
        },
        { $set: { "comments.$[].subComments.$[sub].comment": comment } },
        {
          arrayFilters: [{ "sub._id": subCommentId }],
        },
      );

      return;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async toggleLike(feedId: string) {
    try {
      const feed = await Feed.findById(feedId);
      const isLikePush = await feed?.addLike(
        this.token.id as unknown as string,
      );

      const user = await User.findOne({ uid: this.token.uid });
      if (!user) return;
      if (isLikePush) user.point += 2;
      else user.point -= 1;
      await user.save();
      return;
    } catch (err: any) {
      throw new Error(err);
    }
  }
}

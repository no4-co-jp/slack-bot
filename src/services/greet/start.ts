import type {
  Block,
  CustomRoute,
  KnownBlock,
  Middleware,
  SlackEventMiddlewareArgs,
} from "@slack/bolt";
import type { Reaction } from "@slack/web-api/dist/response/ReactionsGetResponse";
import type { Member } from "@slack/web-api/dist/response/UsersListResponse";
import type { ParamsIncomingMessage } from "@slack/bolt/dist/receivers/ParamsIncomingMessage";
import type { ServerResponse } from "http";
import { client } from "~/client";
import { format } from "date-fns";
import type { StringIndexed } from "@slack/bolt/dist/types/helpers";
import { utcToZonedTime } from "date-fns-tz";
import { fetchReactions, fetchUsers } from "~/apis/slack";
import {
  fetchWFOUsers,
  fetchLeaveUsers,
  fetchHiddenUsers,
  fetchAMLeaveUsers,
} from "~/apis/sheet";
import { isHoliday } from "~/apis/holiday";

const trigger = ":ohayou:";

const toTitle = (date: Date): string => {
  return `${trigger} ${format(
    utcToZonedTime(date, "Asia/Tokyo"),
    "yyyy/MM/dd (E)"
  )}`;
};

const toUserNames = (users: Member[]): string[] => {
  return (
    users.map((user: Member): string => {
      return user.profile?.display_name || user.real_name || "unknown";
    }) ?? []
  );
};

type ReactionRecord = {
  name: string;
  users: Member[];
};

const toReactionRecords = async (
  date: Date,
  reactions: Reaction[] = []
): Promise<ReactionRecord[]> => {
  const users = await fetchUsers();

  const reactedUserIds = reactions.flatMap(({ users }: Reaction): string[] => {
    return users ?? [];
  });
  const reactedUserIdSet = new Set<string>(reactedUserIds);

  const wfoUserIds = (await fetchWFOUsers(date)).filter(
    (id: string): boolean => {
      return !reactedUserIdSet.has(id);
    }
  );
  const wfoUserIdSet = new Set<string>(wfoUserIds);

  const leaveUserIds = (await fetchLeaveUsers(date)).filter(
    (id: string): boolean => {
      return !reactedUserIdSet.has(id);
    }
  );
  const leaveUserIdSet = new Set<string>(leaveUserIds);

  const amLeaveUserIds = (await fetchAMLeaveUsers(date)).filter(
    (id: string): boolean => {
      return !reactedUserIdSet.has(id);
    }
  );
  const amLeaveUserIdSet = new Set<string>(amLeaveUserIds);

  const reactedAllUserIdSet = new Set<string>([
    ...reactedUserIds,
    ...wfoUserIds,
    ...leaveUserIds,
    ...amLeaveUserIds,
  ]);

  const hiddenUserIds = (await fetchHiddenUsers(date)).filter(
    (id: string): boolean => {
      return !reactedUserIdSet.has(id);
    }
  );
  const hiddenUserIdSet = new Set<string>(hiddenUserIds);

  const noReactedUsers: Member[] = users.filter(({ id }: Member): boolean => {
    return (
      id !== undefined &&
      !reactedAllUserIdSet.has(id) &&
      !hiddenUserIdSet.has(id)
    );
  });

  return [
    ...reactions.map((reaction: Reaction): ReactionRecord => {
      return {
        name: reaction.name ?? "-",
        users:
          reaction.users?.reduce((prev: Member[], id: string): Member[] => {
            const user = users.find((user: Member): boolean => {
              return id === user.id;
            });

            return user ? [...prev, user] : prev;
          }, []) ?? [],
      };
    }),
    ...(wfoUserIdSet.size > 0
      ? [
          {
            name: "zisya",
            users: users.filter(({ id }: Member): boolean => {
              return !!id && wfoUserIdSet.has(id);
            }),
          },
        ]
      : []),
    ...(leaveUserIdSet.size > 0
      ? [
          {
            name: "oyasumi",
            users: users.filter(({ id }: Member): boolean => {
              return !!id && leaveUserIdSet.has(id);
            }),
          },
        ]
      : []),
    ...(amLeaveUserIdSet.size > 0
      ? [
          {
            name: "午前半休",
            users: users.filter(({ id }: Member): boolean => {
              return !!id && amLeaveUserIdSet.has(id);
            }),
          },
        ]
      : []),
    {
      name: "no-ria",
      users: noReactedUsers,
    },
  ];
};

const toBlocks = (
  title: string,
  reactionRecords: ReactionRecord[]
): (KnownBlock | Block)[] => {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: title,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Reactions*",
      },
    },
    {
      type: "divider",
    },
    ...reactionRecords.map((reactionRecord: ReactionRecord) => {
      return {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `:${reactionRecord.name}: (${reactionRecord.users.length})` +
            (reactionRecord.users.length > 0
              ? `\n\`\`\`${toUserNames(reactionRecord.users).join(", ")}\`\`\``
              : ``),
        },
      };
    }),
    {
      type: "divider",
    },
  ];
};

export const postChannelGreetStartHandler: CustomRoute["handler"] = (
  req: ParamsIncomingMessage,
  res: ServerResponse
): void => {
  const handler = async (): Promise<void> => {
    const params = req.params;

    if (!params) {
      throw new Error("Invalid Params.");
    }

    const date = new Date();

    if (await isHoliday(date)) {
      console.log("Holiday!");
      res.writeHead(200);
      res.end("Holiday!");
      return;
    }

    const response = client.chat.postMessage({
      channel: params["id"],
      text: toTitle(date),
      blocks: toBlocks(toTitle(date), await toReactionRecords(date)),
    });

    res.writeHead(200);
    res.end(JSON.stringify(response));
  };

  handler().catch((error) => {
    console.error(error);
    res.writeHead(500);
    res.end(error instanceof Error ? error.message : "Internal Server Error");
  });
};

const reactionEventHandler: Middleware<
  SlackEventMiddlewareArgs<"reaction_added" | "reaction_removed">,
  StringIndexed
> = async ({ event, client, context: { botUserId } }): Promise<void> => {
  const {
    item: { channel, ts },
    item_user: itemUser,
  } = event;

  if (itemUser !== botUserId) {
    return;
  }

  const response = await fetchReactions(event);

  if (!response.message) {
    return;
  }

  if (!response.message.text?.startsWith(trigger)) {
    console.log("ignore response.message.text", response.message.text);
    return;
  }

  const date = new Date(Number(ts) * 1000);

  const reactions = await toReactionRecords(
    date,
    response.message?.reactions ?? []
  );

  await client.chat.update({
    channel,
    ts,
    text: toTitle(date),
    blocks: toBlocks(toTitle(date), reactions),
  });
};

export const reactionAddedEventHandler: Middleware<
  SlackEventMiddlewareArgs<"reaction_added">,
  StringIndexed
> = async (params): Promise<void> => {
  return reactionEventHandler(params);
};

export const reactionRemovedEventHandler: Middleware<
  SlackEventMiddlewareArgs<"reaction_removed">,
  StringIndexed
> = async (params): Promise<void> => {
  return reactionEventHandler(params);
};

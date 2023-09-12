import {
  Block,
  CustomRoute,
  KnownBlock,
  Middleware,
  SectionBlock,
  SlackEventMiddlewareArgs,
} from "@slack/bolt";
import { ChatPostMessageResponse } from "@slack/web-api";
import { Reaction } from "@slack/web-api/dist/response/ReactionsGetResponse";
import { Member } from "@slack/web-api/dist/response/UsersListResponse";
import { ParamsIncomingMessage } from "@slack/bolt/dist/receivers/ParamsIncomingMessage";
import { ServerResponse } from "http";
import { client } from "~/client";
import { format } from "date-fns";
import { StringIndexed } from "@slack/bolt/dist/types/helpers";
import { utcToZonedTime } from "date-fns-tz";
import { fetchReactions, fetchUsers } from "~/apis/slack";
import { fetchWFOUsers, fetchLeaveUsers } from "~/apis/sheet";
import { isHoliday } from "~/apis/holiday";

const trigger = ":ohayou:";

const title = (date: Date): string => {
  return `${trigger} ${format(
    utcToZonedTime(date, "Asia/Tokyo"),
    "yyyy/MM/dd (E)"
  )}`;
};

const blocks = (
  date: Date,
  users: Member[],
  wfoUserIds: string[],
  leaveUserIds: string[],
  reactions: Reaction[] = []
): (KnownBlock | Block)[] => {
  const wfoUserIdSet = new Set<string>(wfoUserIds);

  const wfoUsers: Member[] = users.filter(({ id }: Member): boolean => {
    return !!id && wfoUserIdSet.has(id);
  });

  const leaveUserIdSet = new Set<string>(leaveUserIds);

  const leaveUsers: Member[] = users.filter(({ id }: Member): boolean => {
    return !!id && leaveUserIdSet.has(id);
  });

  const reactedUserIdSet = new Set<string>([
    ...reactions.flatMap(({ users }: Reaction): string[] => {
      return users ?? [];
    }),
    ...wfoUserIds,
    ...leaveUserIds,
  ]);

  const noReactedUsers: Member[] = users.filter(({ id }: Member): boolean => {
    return !id || !reactedUserIdSet.has(id);
  });

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: title(date),
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
    ...reactions.map((reaction: Reaction): SectionBlock => {
      return {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `:${reaction.name ?? "-"}: (${reaction.count ?? 0})` +
            `\n\`\`\`${(
              reaction.users?.map((id: string): string => {
                const user = users.find((user: Member): boolean => {
                  return id === user.id;
                });

                return (
                  user?.profile?.display_name || user?.real_name || "unknown"
                );
              }) ?? []
            ).join(", ")}\`\`\``,
        },
      };
    }),
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `:zisya: (${wfoUsers.length ?? 0})` +
          (wfoUsers.length > 0
            ? `\n\`\`\`${(
                wfoUsers.map((user: Member): string => {
                  return (
                    user.profile?.display_name || user.real_name || "unknown"
                  );
                }) ?? []
              ).join(", ")}\`\`\``
            : ""),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `:oyasumi: (${leaveUsers.length ?? 0})` +
          (leaveUsers.length > 0
            ? `\n\`\`\`${(
                leaveUsers.map((user: Member): string => {
                  return (
                    user.profile?.display_name || user.real_name || "unknown"
                  );
                }) ?? []
              ).join(", ")}\`\`\``
            : ""),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `:no-ria: (${noReactedUsers.length})` +
          (noReactedUsers.length > 0
            ? `\n\`\`\`${(
                noReactedUsers.map((user: Member): string => {
                  return (
                    user.profile?.display_name || user.real_name || "unknown"
                  );
                }) ?? []
              ).join(", ")}\`\`\``
            : ""),
      },
    },
  ];
};

export const postChannelGreetStartHandler: CustomRoute["handler"] = (
  req: ParamsIncomingMessage,
  res: ServerResponse
): void => {
  const handler = async (): Promise<ChatPostMessageResponse> => {
    const params = req.params;

    if (!params) {
      throw new Error("Invalid Params.");
    }

    const date = new Date();

    if (await isHoliday(date)) {
      console.log("Holiday!");
      res.writeHead(200);
      res.end("Holiday!");
    }

    return client.chat.postMessage({
      channel: params["id"],
      text: title(date),
      blocks: blocks(
        date,
        await fetchUsers(),
        await fetchWFOUsers(date),
        await fetchLeaveUsers(date)
      ),
    });
  };

  handler()
    .then((response: ChatPostMessageResponse): void => {
      res.writeHead(200);
      res.end(JSON.stringify(response));
    })
    .catch((error) => {
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

  await client.chat.update({
    channel,
    ts,
    text: title(date),
    blocks: blocks(
      date,
      await fetchUsers(),
      await fetchWFOUsers(date),
      await fetchLeaveUsers(date),
      response.message?.reactions ?? []
    ),
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

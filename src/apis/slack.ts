import {
  Member,
  UsersListResponse,
} from "@slack/web-api/dist/response/UsersListResponse";
import {
  Reaction,
  ReactionsGetResponse,
} from "@slack/web-api/dist/response/ReactionsGetResponse";
import { client } from "~/client";
import { cache } from "~/cache";
import { ReactionAddedEvent, ReactionRemovedEvent } from "@slack/bolt";

export const fetchUsers = async (): Promise<Member[]> => {
  const key = "slack.users.list";
  const cached = cache.get<UsersListResponse>(key);

  if (cached) {
    console.log(`[Cache Hit]${key}`);
    return (
      cached.members?.filter((user: Member): boolean => {
        return (
          !user.is_bot &&
          !user.is_app_user &&
          !user.deleted &&
          user.id !== "USLACKBOT"
        );
      }) ?? []
    );
  }

  const response = await client.users.list({ presence: true });

  if (response.ok) {
    cache.set<UsersListResponse>(key, response, 60 * 60 * 24);
  }

  return (
    response.members?.filter((user: Member): boolean => {
      return (
        !user.is_bot &&
        !user.is_app_user &&
        !user.deleted &&
        user.id !== "USLACKBOT"
      );
    }) ?? []
  );
};

export const fetchReactions = async ({
  type,
  user,
  reaction,
  item: { channel, ts },
}:
  | ReactionAddedEvent
  | ReactionRemovedEvent): Promise<ReactionsGetResponse> => {
  const responseKey = `slack.reactions.${channel}.${ts}`;
  const dataKey = `slack.reactions.${channel}.${ts}.data`;

  type DATA = Map<
    string,
    {
      url?: string;
      users: Set<string>;
    }
  >;

  const cached = cache.get<ReactionsGetResponse>(responseKey);

  if (!cached) {
    const response = await client.reactions.get({
      channel,
      timestamp: ts,
      full: true,
    });

    const reactions = response.message?.reactions;

    if (!response.ok || !reactions) {
      return response;
    }

    cache.set<ReactionsGetResponse>(responseKey, response, 2);
    cache.set(
      dataKey,
      reactions.reduce<DATA>(
        (prev: DATA, { name, url, users }: Reaction): DATA => {
          if (name) {
            prev.set(name, { url, users: new Set<string>(users) });
          }

          return prev;
        },
        new Map<
          string,
          {
            url?: string;
            users: Set<string>;
          }
        >()
      ),
      5
    );

    return response;
  }

  console.log(`[Cache Hit]${responseKey}`);

  const data = cache.get<DATA>(dataKey);

  if (!cached.ok || !cached.message?.reactions || !data) {
    return cached;
  }

  if (type === "reaction_added") {
    if (data.has(reaction)) {
      data.get(reaction)?.users.add(user);
    } else {
      data.set(reaction, {
        users: new Set<string>([user]),
      });
    }
  }

  if (type === "reaction_removed") {
    data.get(reaction)?.users?.delete(user);
    if (!data.get(reaction)?.users.size) {
      data.delete(reaction);
    }
  }

  cache.set(dataKey, data, 5);

  cached.message.reactions = Array.from(data.entries()).map<Reaction>(
    ([name, { url, users }]: [
      string,
      {
        url?: string;
        users: Set<string>;
      },
    ]): Reaction => {
      return {
        name,
        url,
        users: Array.from(users),
        count: users.size,
      };
    }
  );

  return cached;
};

import type { Block, CustomRoute, KnownBlock } from "@slack/bolt";
import type { ChatPostMessageResponse } from "@slack/web-api";
import type { ParamsIncomingMessage } from "@slack/bolt/dist/receivers/ParamsIncomingMessage";
import type { ServerResponse } from "http";
import { client } from "~/client";
import { format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { isHoliday } from "~/apis/holiday";

const trigger = ":otsukaresama:";

const toTitle = (date: Date): string => {
  return `${trigger} ${format(
    utcToZonedTime(date, "Asia/Tokyo"),
    "yyyy/MM/dd (E)"
  )}`;
};

const toBlocks = (date: Date): (KnownBlock | Block)[] => {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: toTitle(date),
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "在宅ワークの皆さん、お疲れ様です。",
          format(utcToZonedTime(date, "Asia/Tokyo"), "H:00") +
            "を過ぎました。そろそろ皆さん終了の時間かと思います。",
          "本日も1日、お疲れ様でした。:chatwork_ありがとう:",
        ].join("\n"),
      },
    },
  ];
};

export const postChannelGreetEndHandler: CustomRoute["handler"] = (
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
      text: toTitle(date),
      blocks: toBlocks(date),
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

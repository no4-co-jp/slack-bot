import type { CustomRoute } from "@slack/bolt";
import type { ParamsIncomingMessage } from "@slack/bolt/dist/receivers/ParamsIncomingMessage";
import type { ServerResponse } from "http";

export const getHealthzHandler: CustomRoute["handler"] = (
  req: ParamsIncomingMessage,
  res: ServerResponse
): void => {
  res.writeHead(200);
  res.end("Health check information goes here!");
};

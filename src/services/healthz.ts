import { CustomRoute } from "@slack/bolt";
import { ParamsIncomingMessage } from "@slack/bolt/dist/receivers/ParamsIncomingMessage";
import { ServerResponse } from "http";

export const getHealthzHandler: CustomRoute["handler"] = (
  req: ParamsIncomingMessage,
  res: ServerResponse
): void => {
  res.writeHead(200);
  res.end("Health check information goes here!");
};

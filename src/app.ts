import { App } from "@slack/bolt";
import { config } from "~/config";
import {
  postChannelGreetStartHandler,
  reactionAddedEventHandler,
  reactionRemovedEventHandler,
} from "~/services/greet/start";
import { getHealthzHandler } from "~/services/healthz";
import { postChannelGreetEndHandler } from "~/services/greet/end";

export const app = new App({
  ...config,
  customRoutes: [
    {
      path: "/",
      method: ["GET"],
      handler: getHealthzHandler,
    },
    {
      path: "/healthz",
      method: ["GET"],
      handler: getHealthzHandler,
    },
    {
      path: "/channel/:id/greet/start",
      method: ["POST"],
      handler: postChannelGreetStartHandler,
    },
    {
      path: "/channel/:id/greet/end",
      method: ["POST"],
      handler: postChannelGreetEndHandler,
    },
  ],
});

app.event<"reaction_added">("reaction_added", reactionAddedEventHandler);

app.event<"reaction_removed">("reaction_removed", reactionRemovedEventHandler);

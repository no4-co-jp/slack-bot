import { App } from "@slack/bolt";
import { config } from "~/config";
import {
  postChannelGreetStartHandler,
  reactionAddedEventHandler,
  reactionRemovedEventHandler,
} from "~/services/greet";
import { getHealthzHandler } from "~/services/healthz";

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
  ],
});

app.event<"reaction_added">("reaction_added", reactionAddedEventHandler);

app.event<"reaction_removed">("reaction_removed", reactionRemovedEventHandler);

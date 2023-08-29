import { App } from "@slack/bolt";

type Config = ConstructorParameters<typeof App>[0];

export const config: Config = {
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: Number(process.env.PORT || 3000),
};

console.log(config);

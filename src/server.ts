import { app } from "~/app";

// アプリを起動します
void app.start().then(() => {
  console.info("⚡️ Bolt app is running!");
});

import * as path from "node:path";
import * as dotenv from "dotenv-flow";

// dotenv-flow automatically loads in order:
// .env -> .env.local -> .env.{APP_ENV} -> .env.{APP_ENV}.local
// Note: .env.local is skipped in test environment for reproducibility
dotenv.config({
  node_env: process.env.APP_ENV,
  default_node_env: "test",
  path: path.resolve(__dirname, "../"),
});

import { clearGlobalTestDb } from "./utils/global";

export default async function globalTeardown() {
  await clearGlobalTestDb();
}

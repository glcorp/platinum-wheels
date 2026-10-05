/* Photo stand-in as its own process, for `run.mjs up`. */
import { startPhotoServer } from "./fixture.mjs";

await startPhotoServer();

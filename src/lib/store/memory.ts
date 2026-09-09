import { FileStore } from "./file";
import type { Shape } from "./file";

// Everything one instance has seen, and nothing more.
let held: Shape | null = null;

// The same store as the JSON one, with the disk taken out.
//
// It exists so a deployment with no database is demonstrable instead of broken: a
// serverless filesystem is read only, so the file store cannot even start there. What it
// buys is a working demo, not persistence. Every instance has its own copy and a cold start
// begins from nothing, so a run can vanish between two clicks. The banner on the shaft says
// so, and it should stay said until DATABASE_URL is set.
export class MemoryStore extends FileStore {
  constructor() {
    super("(memory)");
  }

  protected read(): Shape {
    if (!held) held = this.empty();
    return held;
  }

  protected write(data: Shape): void {
    held = data;
  }

  private empty(): Shape {
    return { players: {}, digs: [], seams: {}, shields: [], entries: {}, votes: [], claims: [] };
  }
}

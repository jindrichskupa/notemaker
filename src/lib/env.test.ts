import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("parses dotenv lines", () => {
    expect(
      parseEnv(`# comment
API_TOKEN=abc=123
export BASE_URL = "https://x.test"
QUOTED='a b'

bad line
1BAD=x
API_TOKEN=override`)
    ).toEqual({ API_TOKEN: "override", BASE_URL: "https://x.test", QUOTED: "a b" });
  });
});

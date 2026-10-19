import { describe, it, expect } from "vitest";
import { StringStream } from "@codemirror/language";
import { hurl } from "./hurl";

function tokens(line: string): [string, string][] {
  const stream = new StringStream(line, 2, 2);
  const out: [string, string][] = [];
  while (!stream.eol()) {
    const style = hurl.token(stream, null);
    if (style) out.push([stream.current(), style]);
    stream.start = stream.pos;
  }
  return out;
}

describe("hurl mode", () => {
  it("tokenizes request, headers, sections and asserts", () => {
    expect(tokens("GET https://api.test/{{id}} # get")).toEqual([
      ["GET", "keyword"],
      ["https://api.test/{{id}}", "string"],
      ["# get", "comment"],
    ]);
    expect(tokens("Authorization: Bearer {{token}}")).toEqual([
      ["Authorization", "propertyName"],
      ["{{token}}", "variableName"],
    ]);
    expect(tokens("HTTP 200")).toEqual([["HTTP", "keyword"], ["200", "number"]]);
    expect(tokens("[Asserts]")).toEqual([["[Asserts]", "meta"]]);
    expect(tokens('jsonpath "$.ok" == true')).toEqual([
      ["jsonpath", "builtin"],
      ['"$.ok"', "string"],
      ["==", "operator"],
      ["true", "atom"],
    ]);
  });
});

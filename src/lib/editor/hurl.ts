import type { StreamParser } from "@codemirror/language";

/**
 * Minimal Hurl (https://hurl.dev) stream mode: requests, headers, sections,
 * asserts/captures, templates. Bodies get generic string/number highlighting.
 */
const METHOD = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\b/;
const QUERY =
  /^(status|version|url|header|cookie|body|bytes|xpath|jsonpath|regex|sha256|md5|variable|duration|certificate|count|nth|toInt|toFloat|split|replace|decode|format|urlDecode|urlEncode|htmlEscape|htmlUnescape)\b/;
const PREDICATE =
  /^(not|contains|startsWith|endsWith|matches|exists|includes|isBoolean|isCollection|isDate|isEmpty|isFloat|isInteger|isIsoDate|isNumber|isString)\b/;

export const hurl: StreamParser<unknown> = {
  name: "hurl",
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match("#")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("{{")) {
      if (stream.skipTo("}}")) stream.match("}}");
      else stream.skipToEnd();
      return "variableName";
    }
    if (stream.sol()) {
      if (stream.match(METHOD)) return "keyword";
      if (stream.match(/^HTTP(\/[\d.]+)?\b/)) return "keyword";
      if (stream.match(/^\[[A-Za-z]+\]/)) return "meta";
      if (stream.match(/^[\w-]+(?=\s*:)/)) return "propertyName";
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
    if (stream.match(/^`[^`]*`?/)) return "string";
    if (stream.match(/^https?:\/\/\S+/)) return "string";
    if (stream.match(/^-?\d+(\.\d+)?/)) return "number";
    if (stream.match(/^(true|false|null)\b/)) return "atom";
    if (stream.match(QUERY)) return "builtin";
    if (stream.match(PREDICATE)) return "operator";
    if (stream.match(/^(==|!=|>=|<=|>|<)/)) return "operator";
    stream.next();
    return null;
  },
};

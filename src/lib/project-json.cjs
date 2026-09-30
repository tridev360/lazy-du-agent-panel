// Only selected metadata is materialized. Unselected values, including message
// content, are skipped without decoding or retaining their strings.
function projectJSON(text, paths) {
  const trie = Object.create(null);
  for (const name of paths) {
    let n = trie;
    for (const key of name.split("."))
      n = n[key] || (n[key] = Object.create(null));
    n.$ = name;
  }
  let i = 0;
  const out = {};
  const space = () => {
    while (/\s/.test(text[i] || "") && i < text.length) i++;
  };
  function string(decode) {
    const start = i++;
    if (text[start] !== '"') throw Error("Invalid JSON");
    while (i < text.length) {
      const c = text[i++];
      if (c === '"')
        return decode ? JSON.parse(text.slice(start, i)) : undefined;
      if (c === "\\") {
        if (i >= text.length) throw Error("Invalid JSON");
        i++;
      } else if (c.charCodeAt(0) < 32) throw Error("Invalid JSON");
    }
    throw Error("Incomplete JSON");
  }
  function primitive(keep) {
    const start = i;
    while (i < text.length && !/[\s,}\]]/.test(text[i])) i++;
    const raw = text.slice(start, i);
    if (
      !/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(
        raw,
      )
    )
      throw Error("Invalid JSON");
    return keep ? JSON.parse(raw) : undefined;
  }
  function value(node, depth = 0) {
    if (depth > 80) throw Error("Too deeply nested");
    space();
    const c = text[i];
    if (c === '"') {
      const v = string(!!node?.$);
      if (node?.$) out[node.$] = v;
      return;
    }
    if (c === "{" || c === "[") {
      const obj = c === "{",
        end = obj ? "}" : "]";
      i++;
      space();
      if (text[i] === end) {
        i++;
        return;
      }
      while (i < text.length) {
        let child;
        if (obj) {
          const key = string(!!node);
          space();
          if (text[i++] !== ":") throw Error("Invalid JSON");
          child = node && Object.hasOwn(node, key) ? node[key] : undefined;
        }
        value(child, depth + 1);
        space();
        if (text[i] === end) {
          i++;
          return;
        }
        if (text[i++] !== ",") throw Error("Invalid JSON");
        space();
      }
      throw Error("Incomplete JSON");
    }
    const v = primitive(!!node?.$);
    if (node?.$) out[node.$] = v;
  }
  value(trie);
  space();
  if (i !== text.length) throw Error("Invalid JSON");
  return out;
}
module.exports = { projectJSON };

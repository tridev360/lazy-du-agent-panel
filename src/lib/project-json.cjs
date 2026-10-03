// Only selected metadata is materialized. Unselected values, including message
// content, are skipped without decoding or retaining their strings.
const tries = new WeakMap();
const objectPaths=new WeakMap();
function projectJSON(text, paths, { prefix = 0 } = {}) {
  if(text&&typeof text==='object'){
    if(!objectPaths.has(paths))objectPaths.set(paths,paths.map(name=>[name,name.split('.')]));
    const out={};for(const [name,parts] of objectPaths.get(paths)){let value=text;for(const part of parts){value=value?.[part];if(value===undefined||value===null)break;}if(value!==undefined&&value!==null&&typeof value!=='object')out[name]=typeof value==='string'&&prefix?value.slice(0,prefix):value;}return out;
  }
  let trie = tries.get(paths);
  if (!trie) {
  trie = Object.create(null);
  for (const name of paths) {
    let n = trie;
    for (const key of name.split("."))
      n = n[key] || (n[key] = Object.create(null));
    n.$ = name;
  }
  tries.set(paths, trie);
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
      if (c === '"') {
        if (!decode) return undefined;
        if (!prefix || i - start <= prefix) return JSON.parse(text.slice(start, i));
        let raw = text.slice(start + 1, start + 1 + prefix);
        while (raw.length) { try { return JSON.parse('"' + raw + '"'); } catch { raw = raw.slice(0, -1); } }
        return '';
      }
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
      let arrayIndex = 0;
      while (i < text.length) {
        let child;
        if (obj) {
          const key = string(!!node);
          space();
          if (text[i++] !== ":") throw Error("Invalid JSON");
          child = node && Object.hasOwn(node, key) ? node[key] : undefined;
        }
        if (!obj) {
          child = node?.[String(arrayIndex++)];
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

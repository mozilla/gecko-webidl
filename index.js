import { promises as fs } from "fs";
import webidl2 from "webidl2";

/**
 * @param {string} text
 */
function commentPreprocessorDirectives(text) {
  return text
    .split("\n")
    .map((l) => (l.startsWith("#") ? `//${l}` : l))
    .join("\n");
}

/**
 * @param {string} text
 */
function uncommentPreprocessorDirectives(text) {
  return text
    .split("\n")
    .map((l) => (l.startsWith("//#") ? l.slice(2) : l))
    .join("\n");
}

const bodylessInterface = (tokeniser) => {
  const { position } = tokeniser;
  const base = tokeniser.consume("interface");
  if (!base) {
    return;
  }
  const tokens = { base };
  tokens.name = tokeniser.consume("identifier");
  tokens.termination = tokeniser.consume(";");
  if (!tokens.name || !tokens.termination) {
    tokeniser.unconsume(position);
    return;
  }
  return {
    type: "bodyless interface",
    tokens,
    write(w) {
      return [
        w.token(tokens.base),
        w.token(tokens.name),
        w.token(tokens.termination),
      ].join("");
    },
  };
};

/**
 * @param {import("../lib/tokeniser").Tokeniser} tokeniser
 */
const legacycallerInterface = (tokeniser) => {
  function legacycaller(tokeniser) {
    const { position } = tokeniser;
    const base = tokeniser.consume("identifier");
    if (!base || base.value !== "legacycaller") {
      tokeniser.unconsume(position);
      return;
    }
    const tokens = { base };
    const ret = new webidl2.Operation({ source: tokeniser.source, tokens });
    const { position: position2 } = tokeniser;
    try {
      ret.idlType = webidl2.return_type(tokeniser);
    } catch {
      tokeniser.unconsume(position2);
    }
    tokens.open =
      tokeniser.consume("(") || tokeniser.error("Invalid operation");
    ret.arguments = webidl2.argument_list(tokeniser);
    tokens.close =
      tokeniser.consume(")") || tokeniser.error("Unterminated operation");
    tokens.termination =
      tokeniser.consume(";") ||
      tokeniser.error("Unterminated operation, expected `;`");
    ret.write = (w) => {
      return [
        w.token(tokens.base),
        ret.idlType?.write(w) ?? "",
        w.token(tokens.open),
        ret.arguments.map(arg => arg.write(w)).join(""),
        w.token(tokens.close),
        w.token(tokens.termination),
      ].join("");
    };
    return ret;
  }
  const { position } = tokeniser;
  const base = tokeniser.consume("interface");
  if (!base) {
    return;
  }
  const tokens = { base };
  try {
    return webidl2.Container.parse(
      tokeniser,
      new webidl2.Interface({ source: tokeniser.source, tokens }),
      {
        type: "legacycaller interface",
        allowedMembers: [
          [legacycaller],
          [webidl2.Constant.parse],
          [webidl2.Constructor.parse],
          [webidl2.static_member],
          [webidl2.stringifier],
          [webidl2.IterableLike.parse],
          [webidl2.Attribute.parse],
          [webidl2.Operation.parse],
        ],
      }
    );
  } catch (err) {
    if (!err.message.includes("Bodyless") && !err.message.includes("mixin")) {
      throw err;
    }
    tokeniser.unconsume(position);
  }
};

const callbackAttrInterface = (tokeniser) => {
  const { position } = tokeniser;
  const callback = tokeniser.consume("callback");
  const base = tokeniser.consume("interface");
  if (!callback || !base) {
    tokeniser.unconsume(position);
    return;
  }
  const tokens = { callback, base };
  return webidl2.Container.parse(
    tokeniser,
    new webidl2.CallbackInterface({ source: tokeniser.source, tokens }),
    {
      type: "callback attr interface",
      allowedMembers: [
        [webidl2.Attribute.parse],
        [webidl2.Constant.parse],
        [webidl2.Operation.parse, { regular: true }],
      ],
    }
  );
};

const customNamespace = (tokeniser) => {
  const base = tokeniser.consume("namespace");
  if (!base) {
    return;
  }
  const tokens = { base };
  return webidl2.Container.parse(
    tokeniser,
    new webidl2.Namespace({ source: tokeniser.source, tokens }),
    {
      type: "custom namespace",
      allowedMembers: [
        [webidl2.Constant.parse],
        [webidl2.Attribute.parse, { noInherit: true }],
        [webidl2.Operation.parse, { regular: true }],
      ],
    }
  );
};

const callbackConstructor = (tokeniser) => {
  const { position } = tokeniser;
  const base = tokeniser.consume("callback");
  if (!base) {
    return;
  }
  const tokens = { base };
  tokens.constructor = tokeniser.consume("constructor");
  if (!tokens.constructor) {
    tokeniser.unconsume(position);
    return;
  }
  tokens.name = tokeniser.consume("identifier") || tokeniser.error("No name");
  tokens.equalSign = tokeniser.consume("=") || tokeniser.error("No =");
  const returnType =
    webidl2.return_type(tokeniser) || tokeniser.error("No return type");
  tokens.open = tokeniser.consume("(") || tokeniser.error("No open brace");
  const args = webidl2.argument_list(tokeniser);
  tokens.close = tokeniser.consume(")") || tokeniser.error("No close brace");
  tokens.termination =
    tokeniser.consume(";") || tokeniser.error("No termination");
  return {
    type: "callback constructor",
    tokens,
    returnType,
    args,
    write(w) {
      return [
        w.token(this.tokens.base),
        w.token(this.tokens.constructor),
        w.token(this.tokens.name),
        w.token(this.tokens.equalSign),
        this.returnType.write(w),
        w.token(this.tokens.open),
        this.args.map((arg) => arg.write(w)).join(""),
        w.token(this.tokens.close),
        w.token(this.tokens.termination),
      ].join("");
    },
  };
};

function utf8stringRecord(tokeniser) {
  const { position } = tokeniser;
  const base = tokeniser.consume("record");
  if (!base) {
    return;
  }
  const tokens = { base };
  tokens.open = tokeniser.consume("<");
  tokens.key = tokeniser.consume("identifier");
  if (!tokens.open || !tokens.key || tokens.key.value !== "UTF8String") {
    tokeniser.unconsume(position);
    return;
  }
  tokens.comma = tokeniser.consume(",") || tokeniser.error("No comma");
  const value = webidl2.return_type(tokeniser);
  tokens.close =
    tokeniser.consume(">") || tokeniser.error("Unclosed record<UTF8String>");
  tokens.nullable = tokeniser.consume("?");
  return {
    type: "utf8string record",
    tokens,
    value,
    write(w) {
      return [
        w.token(this.tokens.base),
        w.token(this.tokens.open),
        w.token(this.tokens.key),
        w.token(this.tokens.comma),
        this.value.write(w),
        w.token(this.tokens.close),
        w.token(this.tokens.nullable),
      ].join("");
    },
    *validate() {},
  };
}

function utf8stringField(tokeniser) {
  const { position } = tokeniser;
  const tokens = {};
  const ret = new webidl2.Field({ source: tokeniser.source, tokens });
  tokens.required = tokeniser.consume("required");
  ret.idlType = utf8stringRecord(tokeniser);
  if (!ret.idlType) {
    tokeniser.unconsume(position);
    return;
  }
  tokens.name =
    tokeniser.consume("identifier") ||
    tokeniser.error("Dictionary member lacks a name");
  ret.default = webidl2.Default.parse(tokeniser);
  tokens.termination =
    tokeniser.consume(";") ||
    tokeniser.error("Unterminated dictionary member, expected `;`");
  ret.write = function (w) {
    return [
      w.token(this.tokens.required),
      this.idlType.write(w),
      w.token(this.tokens.name),
      this.default?.write(w) ?? "",
      w.token(this.tokens.termination),
    ].join("");
  };
  return ret;
}

function utf8stringDictionary(tokeniser) {
  const { position } = tokeniser;
  const base = tokeniser.consume("dictionary");
  if (!base) {
    return;
  }
  const tokens = { base };
  try {
    return webidl2.Container.parse(
      tokeniser,
      new webidl2.Dictionary({ source: tokeniser.source, tokens }),
      {
        type: "utf8string dictioanry",
        inheritable: true,
        allowedMembers: [[utf8stringField], [webidl2.Field.parse]],
      }
    );
  } catch (err) {
    throw err;
    tokeniser.unconsume(position);
  }
}

function utf8stringTypedef(tokeniser) {
  const { position } = tokeniser;
  const base = tokeniser.consume("typedef");
  if (!base) {
    return;
  }
  const tokens = { base };
  const idlType = utf8stringRecord(tokeniser);
  if (!idlType) {
    tokeniser.unconsume(position);
    return;
  }
  tokens.identifier =
    tokeniser.consume("identifier") || tokeniser.error("No name");
  tokens.terminator = tokeniser.consume(";") || tokeniser.error("No semicolon");
  return {
    type: "utf8string typedef",
    tokens,
    idlType,
    write(w) {
      return [
        w.token(this.tokens.base),
        this.idlType.write(w),
        w.token(this.tokens.identifier),
        w.token(this.tokens.terminator),
      ].join("");
    },
  };
}

const directories = [
  new URL("../gecko-dev/dom/webidl/", import.meta.url),
  new URL("../gecko-dev/dom/chrome-webidl/", import.meta.url),
  new URL("../gecko-dev/dom/bindings/", import.meta.url),
  new URL("../gecko-dev/dom/bindings/test/", import.meta.url),
  new URL("../gecko-dev/dom/bindings/mozwebidlcodegen/test/", import.meta.url),
];
for (const dir of directories) {
  for (const filename of await fs.readdir(dir)) {
    if (!filename.endsWith(".webidl")) {
      continue;
    }
    let content = await fs.readFile(new URL(filename, dir), "utf-8");
    content = commentPreprocessorDirectives(content);
    const ast = webidl2.parse(content, {
      sourceName: filename,
      productions: [
        bodylessInterface,
        customNamespace,
        callbackConstructor,
        legacycallerInterface,
        utf8stringDictionary,
        utf8stringTypedef,
        callbackAttrInterface,
      ],
      concrete: true,
    });
    const validations = webidl2.validate(ast);
    if (!validations.length) {
      continue;
    }
    let autofixed = false;
    for (const validation of validations) {
      // if (validation.ruleName === "replace-void") {
      if (validation.autofix && validation.ruleName !== "require-exposed") {
        validation.autofix();
        autofixed = true;
      }
    }
    if (!autofixed) {
      continue;
    }
    let written = webidl2.write(ast);
    written = uncommentPreprocessorDirectives(written);
    await fs.writeFile(new URL(filename, dir), written);
  }
}

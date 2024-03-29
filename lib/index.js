import * as webidl2 from "webidl2";

import {
  Attribute,
  Base,
  Operation,
  Type,
  argument_list,
  autoParenter,
  unescape,
} from "webidl2/productions";

/** Class for representing interfaces that lack a body. */
class BodylessInterface extends Base {
  /**
   * @param {import("webidl2/tokeniser.js").Tokeniser} tokeniser
   * @param {import("webidl2/tokeniser.js").Token} base
   */
  static parse(tokeniser) {
    const { position } = tokeniser;
    const base = tokeniser.consume("interface");
    if (!base) {
      return;
    }

    const tokens = { base };
    const ret = autoParenter(
      new BodylessInterface({ source: tokeniser.source, tokens })
    );
    tokens.name = tokeniser.consumeKind("identifier");
    if (!tokens.name) {
      tokeniser.unconsume(position);
      return;
    }

    tokeniser.current = ret.this;
    tokens.termination = tokeniser.consume(";");
    if (!tokens.termination) {
      tokeniser.unconsume(position);
      return;
    }
    return ret.this;
  }

  get name() {
    return unescape(this.tokens.name.value);
  }

  get type() {
    return "bodyless interface";
  }

  /** @param {import('../writer.js').Writer} w */
  write(w) {
    return w.ts.definition(
      w.ts.wrap([
        w.token(this.tokens.base),
        w.token(this.tokens.name),
        w.token(this.tokens.termination),
      ]),
      { data: this }
    );
  }
}

/** Class for representing `callback constructor`. */
class CallbackConstructor extends Base {
  /**
   * @param {import("webidl2/tokeniser.js").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const { position } = tokeniser;
    const base = tokeniser.consume("callback");
    if (!base) {
      return;
    }
    const tokens = { base };
    tokens.constructor_ = tokeniser.consume("constructor");
    if (!tokens.constructor_) {
      tokeniser.unconsume(position);
      return;
    }
    const ret = autoParenter(
      new CallbackConstructor({ source: tokeniser.source, tokens })
    );
    tokens.name =
      tokeniser.consumeKind("identifier") ||
      tokeniser.error("Callback lacks a name");
    tokeniser.current = ret.this;
    tokens.assign =
      tokeniser.consume("=") ||
      tokeniser.error("Callback constructor lacks an assignment");
    ret.idlType =
      Type.parse(tokeniser, "return-type") ||
      tokeniser.error("Callback constructor lacks a return type");
    tokens.open =
      tokeniser.consume("(") ||
      tokeniser.error("Callback constructor lacks parentheses for arguments");
    ret.arguments = argument_list(tokeniser);
    tokens.close =
      tokeniser.consume(")") ||
      tokeniser.error("Unterminated callback constructor");
    tokens.termination =
      tokeniser.consume(";") ||
      tokeniser.error("Unterminated callback constructor, expected `;`");
    return ret.this;
  }

  get name() {
    return unescape(this.tokens.name.value);
  }

  get type() {
    return "callback constructor";
  }

  /** @param {import('../writer.js').Writer} w */
  write(w) {
    return w.ts.definition(
      w.ts.wrap([
        this.extAttrs.write(w),
        w.token(this.tokens.base),
        w.token(this.tokens.constructor_),
        w.name_token(this.tokens.name),
        w.token(this.tokens.assign),
        w.ts.type(this.idlType.write(w)),
        w.token(this.tokens.open),
        ...this.arguments.map((arg) => arg.write(w)),
        w.token(this.tokens.close),
        w.token(this.tokens.termination),
      ]),
      { data: this }
    );
  }
}

/**
 * Extension for parsing legacycaller.
 * @param {import('../lib/tokeniser').Tokeniser} tokeniser
 */
function legacyCaller(tokeniser) {
  const { position } = tokeniser;
  const special = tokeniser.consumeKind("identifier");
  if (!special || special.value !== "legacycaller") {
    tokeniser.unconsume(position);
    return;
  }

  return Operation.parse(tokeniser, { special });
}

/**
 * Comment out preprocessor`#` directives.
 * @param {string} text
 */
function commentPreprocessorDirectives(text) {
  return text
    .split("\n")
    .map((l) => (l.startsWith("#") ? `//${l}` : l))
    .join("\n");
}

/**
 * Uncomment preprocessor directives.
 * @param {string} text
 */
function uncommentPreprocessorDirectives(text) {
  return text
    .split("\n")
    .map((l) => (l.startsWith("//#") ? l.slice(2) : l))
    .join("\n");
}

/**
 * Wrapper around webidl2.js parse function that applies the necessary gecko options.
 * @param {string} content
 * @param {string} filename
 */
export function parse(content, filename) {
  content = commentPreprocessorDirectives(content);
  if (filename === "Window.webidl") {
    content = content.replace("SharedArrayBuffer", "// SharedArrayBuffer");
  }
  return webidl2.parse(content, {
    sourceName: filename,
    concrete: true,
    extensions: {
      callbackInterface: { extMembers: [[Attribute.parse]] },
      interface: { extMembers: [[legacyCaller]] },
      namespace: { extMembers: [[Attribute.parse]] },
    },
    productions: [BodylessInterface.parse, CallbackConstructor.parse],
  });
}

/**
 * Wrapper around webidl2.js write function that removes comments around  preprocessor directives.
 * @param {string} content
 */
export function write(content) {
  return uncommentPreprocessorDirectives(webidl2.write(content));
}

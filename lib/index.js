import {
  Base,
  Operation,
  argument_list,
  autoParenter,
  return_type,
  unescape,
  Attribute,
} from "webidl2/productions";
import * as webidl2 from "webidl2";

/** Class for representing interfaces that lack a body. */
class BodylessInterface extends Base {
  static parse(tokeniser, base) {
    const tokens = { base };
    const ret = autoParenter(
      new BodylessInterface({ source: tokeniser.source, tokens })
    );
    tokens.name =
      tokeniser.consumeKind("identifier") ||
      tokeniser.error("Missing name in interface");
    tokeniser.current = ret.this;
    tokens.termination =
      tokeniser.consume(";") ||
      tokeniser.error(`Missing semicolon after interface`);
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
   * @param {import('webidl2/tokeniser.js').Tokeniser} tokeniser
   * @param {*} tokens
   */
  static parse(tokeniser, tokens) {
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
      return_type(tokeniser) ||
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

class LegacyCaller extends Base {
  static parse(tokeniser, { base } = {}) {
    const tokens = { base };
    const ret = autoParenter(
      new LegacyCaller({ source: tokeniser.source, tokens })
    );
    ret.idlType =
      return_type(tokeniser) || tokeniser.error("Missing return type");
    tokens.name =
      tokeniser.consumeKind("identifier") || tokeniser.consume("includes");
    tokens.open =
      tokeniser.consume("(") || tokeniser.error("Invalid operation");
    ret.arguments = argument_list(tokeniser);
    tokens.close =
      tokeniser.consume(")") || tokeniser.error("Unterminated operation");
    tokens.termination =
      tokeniser.consume(";") ||
      tokeniser.error("Unterminated operation, expected `;`");
    return ret.this;
  }
}

/**
 * Custom production for parsing bodyless interfaces.
 * @param {import('../lib/tokeniser').Tokeniser} tokeniser
 */
function bodylessInterface(tokeniser) {
  const { position } = tokeniser;
  const base = tokeniser.consume("interface");
  if (base) {
    try {
      return BodylessInterface.parse(tokeniser, base);
    } catch (e) {
      tokeniser.unconsume(position);
    }
  }
}

/**
 * Custom production for parsing callback constructors.
 * @param {import('../lib/tokeniser').Tokeniser} tokeniser
 */
function callbackConstructor(tokeniser) {
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

  return CallbackConstructor.parse(tokeniser, tokens);
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
  return webidl2.parse(content, {
    sourceName: filename,
    concrete: true,
    extensions: {
      callbackInterface: { extMembers: [[Attribute.parse]] },
      interface: { extMembers: [[legacyCaller]] },
      namespace: { extMembers: [[Attribute.parse]] },
    },
    productions: [bodylessInterface, callbackConstructor],
  });
}

/**
 * Wrapper around webidl2.js write function that uncomments preprocessor directives.
 * @param {string} content
 */
export function write(content) {
  return uncommentPreprocessorDirectives(webidl2.write(ast));
}

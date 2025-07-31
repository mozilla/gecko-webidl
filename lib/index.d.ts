/** Re-export types. */
export * from "webidl2"

/**
 * Parses WebIDL content with Gecko-specific modifications.
 * @param content The WebIDL content to parse.
 * @param filename The filename (used for conditional tweaks).
 */
export function parse(content: string, filename: string): import("webidl2").IDLRootType[];

/**
 * Writes WebIDL content from AST and restores preprocessor directives.
 * @param content The AST to write.
 */
export function write(content: import("webidl2").IDLRootType[]): string;

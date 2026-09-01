import { parse } from "lossless-json";

export class JsonNumberLexeme {
  public readonly lexicalValue: string;

  public constructor(lexicalValue: string) {
    this.lexicalValue = lexicalValue;
    Object.freeze(this);
  }
}

export function parseLosslessJson(source: string): unknown {
  return parse(source, null, {
    parseNumber: (lexicalValue) => new JsonNumberLexeme(lexicalValue),
  });
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof JsonNumberLexeme)
  );
}

export function describeJsonValue(value: unknown): string {
  if (value instanceof JsonNumberLexeme) {
    return value.lexicalValue;
  }

  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (typeof value === "object") {
    return "object";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function describeJsonType(value: unknown): string {
  if (value instanceof JsonNumberLexeme) {
    return "number";
  }

  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

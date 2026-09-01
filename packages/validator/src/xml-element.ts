import type { ParsedXmlElement } from "@planaxis/parser";

export function getParsedAttribute(
  element: ParsedXmlElement,
  qualifiedName: string,
): string | undefined {
  return element.attributes.find((attribute) => attribute.name.qualifiedName === qualifiedName)
    ?.value;
}

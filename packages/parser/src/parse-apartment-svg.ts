import {
  CDATASection,
  Comment,
  DOMParser,
  Element,
  ParseError,
  ProcessingInstruction,
  Text,
} from "@xmldom/xmldom";
import type { Attr, Document, Node } from "@xmldom/xmldom";

import type {
  ApartmentSvgParseErrorKind,
  ApartmentSvgParseFailure,
  ApartmentSvgParseResult,
  ParsedApartmentSvgDocument,
  ParsedTopLevelGroup,
  ParsedXmlAttribute,
  ParsedXmlChildNode,
  ParsedXmlElement,
  ParsedXmlName,
  ParsedXmlNamespaceDeclaration,
  ParsedXmlProcessingInstruction,
  XmlSourceLocation,
} from "./parsed-apartment-svg.js";

const XMLNS_NAMESPACE_URI = "http://www.w3.org/2000/xmlns/";

interface XmlDiagnostic {
  readonly message: string;
  readonly location?: XmlSourceLocation;
}

export function parseApartmentSvg(source: string): ApartmentSvgParseResult {
  const diagnostics: XmlDiagnostic[] = [];
  const parser = new DOMParser({
    onError: (_level, message, context: unknown) => {
      const location = readSourceLocation(context);
      diagnostics.push(location === undefined ? { message } : { message, location });
    },
  });

  let xmlDocument: Document;

  try {
    // application/xml avoids supplying an implicit SVG namespace when the source omitted it.
    xmlDocument = parser.parseFromString(source, "application/xml");
  } catch (error: unknown) {
    if (error instanceof ParseError) {
      const locator: unknown = error.locator;

      return createFailure("malformed-xml", error.message, readSourceLocation(locator));
    }

    throw error;
  }

  if (xmlDocument.doctype !== null) {
    return createFailure(
      "prohibited-doctype",
      "DOCTYPE declarations are not allowed when parsing Apartment SVG input.",
      readSourceLocation(xmlDocument.doctype),
    );
  }

  const firstDiagnostic = diagnostics[0];

  if (firstDiagnostic !== undefined) {
    return createFailure("malformed-xml", firstDiagnostic.message, firstDiagnostic.location);
  }

  if (xmlDocument.documentElement === null) {
    return createFailure("malformed-xml", "The XML document does not contain a root element.");
  }

  return Object.freeze({
    ok: true,
    document: mapDocument(xmlDocument, xmlDocument.documentElement),
  });
}

function mapDocument(xmlDocument: Document, documentElement: Element): ParsedApartmentSvgDocument {
  const rootElement = mapRootElement(documentElement);
  const rootElements = freezeArray(rootElement.children.filter(isParsedXmlElement));
  const metadataElements = freezeArray(
    rootElements.filter((element) => element.name.localName === "metadata"),
  );
  const topLevelGroups = freezeArray(
    rootElements.filter((element) => element.name.localName === "g").map(mapTopLevelGroup),
  );
  const semanticElements = freezeArray(topLevelGroups.flatMap((group) => group.semanticElements));

  return Object.freeze({
    rootElement,
    processingInstructions: mapDocumentProcessingInstructions(xmlDocument),
    rootElements,
    metadataElements,
    topLevelGroups,
    semanticElements,
  });
}

function mapRootElement(element: Element): ParsedXmlElement {
  const children: ParsedXmlChildNode[] = [];

  forEachChildNode(element, (child) => {
    if (child instanceof Element) {
      const isGroup = child.localName === "g";
      const isMetadata = child.localName === "metadata";
      const isAnnotations = isGroup && getAttributeValue(child, "id") === "annotations";
      const shouldMapDescendants = (isGroup || isMetadata) && !isAnnotations;

      children.push(mapElement(child, shouldMapDescendants));
      return;
    }

    const mappedChild = mapNonElementNode(child);
    if (mappedChild !== undefined) {
      children.push(mappedChild);
    }
  });

  return createParsedElement(element, freezeArray(children));
}

function mapElement(element: Element, includeDescendants: boolean): ParsedXmlElement {
  if (!includeDescendants) {
    return createParsedElement(element, freezeArray([]));
  }

  const children: ParsedXmlChildNode[] = [];

  forEachChildNode(element, (child) => {
    if (child instanceof Element) {
      children.push(mapElement(child, true));
      return;
    }

    const mappedChild = mapNonElementNode(child);
    if (mappedChild !== undefined) {
      children.push(mappedChild);
    }
  });

  return createParsedElement(element, freezeArray(children));
}

function createParsedElement(
  element: Element,
  children: readonly ParsedXmlChildNode[],
): ParsedXmlElement {
  return Object.freeze({
    kind: "element",
    name: mapName(element),
    attributes: mapAttributes(element),
    namespaceDeclarations: mapNamespaceDeclarations(element),
    children,
  });
}

function mapNonElementNode(node: Node): Exclude<ParsedXmlChildNode, ParsedXmlElement> | undefined {
  if (node instanceof CDATASection) {
    return Object.freeze({ kind: "cdata", value: node.data });
  }

  if (node instanceof Text) {
    return Object.freeze({ kind: "text", value: node.data });
  }

  if (node instanceof Comment) {
    return Object.freeze({ kind: "comment", value: node.data });
  }

  if (node instanceof ProcessingInstruction) {
    return mapProcessingInstruction(node);
  }

  return undefined;
}

function mapName(node: Element | Attr): ParsedXmlName {
  return Object.freeze({
    qualifiedName: node.nodeName,
    localName: node.localName,
    prefix: node.prefix,
    namespaceUri: node.namespaceURI,
  });
}

function mapAttributes(element: Element): readonly ParsedXmlAttribute[] {
  const attributes: ParsedXmlAttribute[] = [];

  for (const attribute of element.attributes) {
    attributes.push(
      Object.freeze({
        name: mapName(attribute),
        value: attribute.value,
      }),
    );
  }

  return freezeArray(attributes);
}

function mapNamespaceDeclarations(element: Element): readonly ParsedXmlNamespaceDeclaration[] {
  const declarations: ParsedXmlNamespaceDeclaration[] = [];

  for (const attribute of element.attributes) {
    if (attribute.namespaceURI !== XMLNS_NAMESPACE_URI) {
      continue;
    }

    declarations.push(
      Object.freeze({
        qualifiedName: attribute.nodeName,
        prefix: attribute.nodeName === "xmlns" ? null : attribute.localName,
        namespaceUri: attribute.value,
      }),
    );
  }

  return freezeArray(declarations);
}

function mapDocumentProcessingInstructions(
  xmlDocument: Document,
): readonly ParsedXmlProcessingInstruction[] {
  const processingInstructions: ParsedXmlProcessingInstruction[] = [];

  forEachChildNode(xmlDocument, (child) => {
    if (child instanceof ProcessingInstruction) {
      processingInstructions.push(mapProcessingInstruction(child));
    }
  });

  return freezeArray(processingInstructions);
}

function mapProcessingInstruction(
  instruction: ProcessingInstruction,
): ParsedXmlProcessingInstruction {
  return Object.freeze({
    kind: "processing-instruction",
    target: instruction.target,
    data: instruction.data,
  });
}

function mapTopLevelGroup(element: ParsedXmlElement): ParsedTopLevelGroup {
  const id = getParsedAttributeValue(element, "id");
  const contentKind = id === "annotations" ? "annotations" : "semantic";
  const semanticElements =
    contentKind === "annotations"
      ? freezeArray<ParsedXmlElement>([])
      : freezeArray(element.children.filter(isParsedXmlElement));

  return Object.freeze({
    element,
    id,
    contentKind,
    semanticElements,
  });
}

function getAttributeValue(element: Element, qualifiedName: string): string | null {
  return element.attributes.getNamedItem(qualifiedName)?.value ?? null;
}

function getParsedAttributeValue(element: ParsedXmlElement, qualifiedName: string): string | null {
  return (
    element.attributes.find((attribute) => attribute.name.qualifiedName === qualifiedName)?.value ??
    null
  );
}

function isParsedXmlElement(node: ParsedXmlChildNode): node is ParsedXmlElement {
  return node.kind === "element";
}

function forEachChildNode(node: Node, visitor: (child: Node) => void): void {
  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes.item(index);
    if (child !== null) {
      visitor(child);
    }
  }
}

function freezeArray<T>(values: T[]): readonly T[] {
  return Object.freeze(values);
}

function createFailure(
  kind: ApartmentSvgParseErrorKind,
  message: string,
  location?: XmlSourceLocation,
): ApartmentSvgParseFailure {
  const error =
    location === undefined
      ? Object.freeze({ kind, message })
      : Object.freeze({ kind, message, location });

  return Object.freeze({ ok: false, error });
}

function readSourceLocation(value: unknown): XmlSourceLocation | undefined {
  if (!isNonNullObject(value)) {
    return undefined;
  }

  const locator = isNonNullObject(value.locator) ? value.locator : value;
  const line = locator.lineNumber;
  const column = locator.columnNumber;

  if (typeof line !== "number" || typeof column !== "number") {
    return undefined;
  }

  return Object.freeze({ line, column });
}

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

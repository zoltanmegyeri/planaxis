export interface ParsedXmlName {
  readonly qualifiedName: string;
  readonly localName: string | null;
  readonly prefix: string | null;
  readonly namespaceUri: string | null;
}

export interface ParsedXmlAttribute {
  readonly name: ParsedXmlName;
  readonly value: string;
}

export interface ParsedXmlNamespaceDeclaration {
  readonly qualifiedName: string;
  readonly prefix: string | null;
  readonly namespaceUri: string;
}

export interface ParsedXmlElement {
  readonly kind: "element";
  readonly name: ParsedXmlName;
  readonly attributes: readonly ParsedXmlAttribute[];
  readonly namespaceDeclarations: readonly ParsedXmlNamespaceDeclaration[];
  readonly children: readonly ParsedXmlChildNode[];
}

export interface ParsedXmlText {
  readonly kind: "text";
  readonly value: string;
}

export interface ParsedXmlCdata {
  readonly kind: "cdata";
  readonly value: string;
}

export interface ParsedXmlComment {
  readonly kind: "comment";
  readonly value: string;
}

export interface ParsedXmlProcessingInstruction {
  readonly kind: "processing-instruction";
  readonly target: string;
  readonly data: string;
}

export type ParsedXmlChildNode =
  | ParsedXmlElement
  | ParsedXmlText
  | ParsedXmlCdata
  | ParsedXmlComment
  | ParsedXmlProcessingInstruction;

export interface ParsedTopLevelGroup {
  readonly element: ParsedXmlElement;
  readonly id: string | null;
  readonly contentKind: "semantic" | "annotations";
  readonly semanticElements: readonly ParsedXmlElement[];
}

export interface ParsedApartmentSvgDocument {
  readonly rootElement: ParsedXmlElement;
  readonly processingInstructions: readonly ParsedXmlProcessingInstruction[];
  readonly rootElements: readonly ParsedXmlElement[];
  readonly metadataElements: readonly ParsedXmlElement[];
  readonly topLevelGroups: readonly ParsedTopLevelGroup[];
  readonly semanticElements: readonly ParsedXmlElement[];
}

export interface XmlSourceLocation {
  readonly line: number;
  readonly column: number;
}

export type ApartmentSvgParseErrorKind = "malformed-xml" | "prohibited-doctype";

export interface ApartmentSvgParseError {
  readonly kind: ApartmentSvgParseErrorKind;
  readonly message: string;
  readonly location?: XmlSourceLocation;
}

export interface ApartmentSvgParseSuccess {
  readonly ok: true;
  readonly document: ParsedApartmentSvgDocument;
}

export interface ApartmentSvgParseFailure {
  readonly ok: false;
  readonly error: ApartmentSvgParseError;
}

export type ApartmentSvgParseResult = ApartmentSvgParseSuccess | ApartmentSvgParseFailure;

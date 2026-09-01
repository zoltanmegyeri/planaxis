import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { parseApartmentSvg } from "../src/index.js";
import type { ParsedApartmentSvgDocument, ParsedXmlElement } from "../src/index.js";

const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseApartmentSvg", () => {
  it("accepts source text and returns an owned parsed document", () => {
    expectTypeOf(parseApartmentSvg).parameter(0).toEqualTypeOf<string>();

    const document = parseSuccessfully(`
      <?xml-stylesheet type="text/css" href="apartment.css"?>
      <svg
        xmlns="${SVG_NAMESPACE_URI}"
        viewBox="0 0 500 400"
        data-schema="apartment-svg"
        data-schema-version="2.1"
        data-unit="cm"
      >
        <metadata><![CDATA[{"schema":"apartment-svg/2.1"}]]></metadata>
        <g id="walls">
          <rect id="wall-01" x="0" y="0" width="100" height="12" />
        </g>
      </svg>
    `);

    expect(document.rootElement.name).toEqual({
      qualifiedName: "svg",
      localName: "svg",
      prefix: null,
      namespaceUri: SVG_NAMESPACE_URI,
    });
    expect(getAttribute(document.rootElement, "viewBox")).toBe("0 0 500 400");
    expect(document.rootElement.namespaceDeclarations).toEqual([
      {
        qualifiedName: "xmlns",
        prefix: null,
        namespaceUri: SVG_NAMESPACE_URI,
      },
    ]);
    expect(document.processingInstructions).toEqual([
      {
        kind: "processing-instruction",
        target: "xml-stylesheet",
        data: 'type="text/css" href="apartment.css"',
      },
    ]);
    expect(document.metadataElements).toHaveLength(1);
    expect(document.metadataElements[0]?.children).toEqual([
      { kind: "cdata", value: '{"schema":"apartment-svg/2.1"}' },
    ]);
    expect(document.topLevelGroups.map((group) => group.id)).toEqual(["walls"]);
    expect(document.semanticElements.map((element) => getAttribute(element, "id"))).toEqual([
      "wall-01",
    ]);
    expect(Object.isFrozen(document)).toBe(true);
    expect(Object.isFrozen(document.rootElement.children)).toBe(true);
    expect("getAttribute" in document.rootElement).toBe(false);
  });

  it("returns a typed failure for malformed XML without exposing a partial document", () => {
    const result = parseApartmentSvg("<svg>\n  <g>\n</svg>");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected malformed XML to fail parsing.");
    }

    expect(result.error.kind).toBe("malformed-xml");
    expect(result.error.message.length).toBeGreaterThan(0);
    expect(result.error.location?.line).toBeGreaterThan(0);
    expect("document" in result).toBe(false);
  });

  it("preserves numeric-looking and XML-decoded attribute values as strings", () => {
    const longDecimal =
      "123456789012345678901234567890123456789012345678901234567890.00000000000000000001";
    const document = parseSuccessfully(`
      <svg xmlns="${SVG_NAMESPACE_URI}">
        <g id="walls">
          <rect
            id="lexical-values"
            data-one="0.1"
            data-two="12.01"
            data-exponent="1e3"
            data-nan="NaN"
            data-unit-value="12cm"
            data-long="${longDecimal}"
            data-decoded="A &amp; B"
          />
        </g>
      </svg>
    `);
    const element = requireSemanticElement(document, "lexical-values");

    expect(getAttribute(element, "data-one")).toBe("0.1");
    expect(getAttribute(element, "data-two")).toBe("12.01");
    expect(getAttribute(element, "data-exponent")).toBe("1e3");
    expect(getAttribute(element, "data-nan")).toBe("NaN");
    expect(getAttribute(element, "data-unit-value")).toBe("12cm");
    expect(getAttribute(element, "data-long")).toBe(longDecimal);
    expect(getAttribute(element, "data-decoded")).toBe("A & B");
    expect(typeof getAttribute(element, "data-one")).toBe("string");
  });

  it("keeps namespace-equivalent root forms structurally distinguishable", () => {
    const defaultNamespace = parseSuccessfully(`<svg xmlns="${SVG_NAMESPACE_URI}" />`);
    const prefixedNamespace = parseSuccessfully(`<svg:svg xmlns:svg="${SVG_NAMESPACE_URI}" />`);

    expect(defaultNamespace.rootElement.name).toEqual({
      qualifiedName: "svg",
      localName: "svg",
      prefix: null,
      namespaceUri: SVG_NAMESPACE_URI,
    });
    expect(prefixedNamespace.rootElement.name).toEqual({
      qualifiedName: "svg:svg",
      localName: "svg",
      prefix: "svg",
      namespaceUri: SVG_NAMESPACE_URI,
    });
    expect(defaultNamespace.rootElement.namespaceDeclarations[0]?.prefix).toBeNull();
    expect(prefixedNamespace.rootElement.namespaceDeclarations[0]?.prefix).toBe("svg");
  });

  it("preserves duplicate and unknown root structures without classifying them", () => {
    const document = parseSuccessfully(`
      <svg xmlns="${SVG_NAMESPACE_URI}" data-unknown-root="kept">
        <metadata><![CDATA[{}]]></metadata>
        <metadata>ordinary text</metadata>
        <style>.wall { fill: black; }</style>
        <defs><linearGradient id="visual-gradient" /></defs>
        <title>Apartment title</title>
        <desc>Apartment description</desc>
        <g id="walls"><path data-unknown="first" /></g>
        <g id="walls" data-duplicate="second" />
        <g id="mystery"><unknown-shape custom="kept" /></g>
        <unknown-root custom-root="kept" />
      </svg>
    `);

    expect(document.metadataElements).toHaveLength(2);
    expect(document.topLevelGroups.map((group) => group.id)).toEqual(["walls", "walls", "mystery"]);
    expect(document.rootElements.map((element) => element.name.localName)).toEqual([
      "metadata",
      "metadata",
      "style",
      "defs",
      "title",
      "desc",
      "g",
      "g",
      "g",
      "unknown-root",
    ]);
    expect(getAttribute(document.rootElement, "data-unknown-root")).toBe("kept");
    expect(
      getAttribute(document.topLevelGroups[1]?.element ?? document.rootElement, "data-duplicate"),
    ).toBe("second");
    expect(
      document.semanticElements.map((element) => [
        element.name.qualifiedName,
        getAttribute(element, "data-unknown") ?? getAttribute(element, "custom"),
      ]),
    ).toEqual([
      ["path", "first"],
      ["unknown-shape", "kept"],
    ]);
  });

  it("distinguishes metadata CDATA from text and does not parse malformed JSON", () => {
    const document = parseSuccessfully(`
      <svg xmlns="${SVG_NAMESPACE_URI}">
        <metadata>ordinary<![CDATA[{ definitely-not-json ]]></metadata>
      </svg>
    `);

    expect(document.metadataElements[0]?.children).toEqual([
      { kind: "text", value: "ordinary" },
      { kind: "cdata", value: "{ definitely-not-json " },
    ]);
  });

  it("preserves prohibited semantic nesting for later validation", () => {
    const document = parseSuccessfully(`
      <svg xmlns="${SVG_NAMESPACE_URI}">
        <g id="walls">
          <rect id="outer">
            <circle id="nested" data-kind="camera" />
          </rect>
        </g>
      </svg>
    `);
    const outer = requireSemanticElement(document, "outer");
    const nested = outer.children.find(
      (child): child is ParsedXmlElement => child.kind === "element",
    );

    expect(nested?.name.qualifiedName).toBe("circle");
    expect(nested === undefined ? null : getAttribute(nested, "id")).toBe("nested");
  });

  it("keeps annotation groups observable but omits their descendants from semantic data", () => {
    const document = parseSuccessfully(`
      <svg xmlns="${SVG_NAMESPACE_URI}">
        <g id="walls"><rect id="real-wall" data-kind="wall" /></g>
        <g id="annotations">
          <rect id="fake-wall" data-kind="wall" />
          <g><circle id="fake-camera" data-kind="camera" /></g>
        </g>
      </svg>
    `);
    const annotationGroup = document.topLevelGroups.find(
      (group) => group.contentKind === "annotations",
    );

    expect(annotationGroup?.id).toBe("annotations");
    expect(annotationGroup?.semanticElements).toEqual([]);
    expect(annotationGroup?.element.children).toEqual([]);
    expect(document.semanticElements.map((element) => getAttribute(element, "id"))).toEqual([
      "real-wall",
    ]);
  });

  it("preserves xml-stylesheet instructions without fetching their targets", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("The XML parser must not fetch processing-instruction targets.");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const document = parseSuccessfully(`
      <?xml-stylesheet type="text/css" href="https://example.invalid/apartment.css"?>
      <svg xmlns="${SVG_NAMESPACE_URI}" />
    `);

    expect(document.processingInstructions[0]).toEqual({
      kind: "processing-instruction",
      target: "xml-stylesheet",
      data: 'type="text/css" href="https://example.invalid/apartment.css"',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects external DTD and entity input at the parser security boundary", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("The XML parser must not fetch external entities.");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const remoteResult = parseApartmentSvg(`
      <!DOCTYPE svg [
        <!ENTITY external SYSTEM "https://example.invalid/external-entity">
      ]>
      <svg xmlns="${SVG_NAMESPACE_URI}">&external;</svg>
    `);
    const fileResult = parseApartmentSvg(`
      <!DOCTYPE svg SYSTEM "file:///definitely/not/read/by/planaxis">
      <svg xmlns="${SVG_NAMESPACE_URI}" />
    `);

    expect(remoteResult.ok).toBe(false);
    expect(fileResult.ok).toBe(false);
    if (remoteResult.ok || fileResult.ok) {
      throw new Error("Expected DTD-bearing XML to be rejected.");
    }

    expect(remoteResult.error.kind).toBe("prohibited-doctype");
    expect(fileResult.error.kind).toBe("prohibited-doctype");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function parseSuccessfully(source: string): ParsedApartmentSvgDocument {
  const result = parseApartmentSvg(source);

  if (!result.ok) {
    throw new Error(`Expected XML parsing to succeed: ${result.error.message}`);
  }

  return result.document;
}

function requireSemanticElement(
  document: ParsedApartmentSvgDocument,
  id: string,
): ParsedXmlElement {
  const element = document.semanticElements.find(
    (candidate) => getAttribute(candidate, "id") === id,
  );

  if (element === undefined) {
    throw new Error(`Expected semantic element ${id}.`);
  }

  return element;
}

function getAttribute(element: ParsedXmlElement, qualifiedName: string): string | null {
  return (
    element.attributes.find((attribute) => attribute.name.qualifiedName === qualifiedName)?.value ??
    null
  );
}

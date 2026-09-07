import type { ReactElement } from "react";
import type { DocumentState } from "./use-document.js";

export function ValidationDetails({ document }: { document: DocumentState }): ReactElement {
  if (document.status === "empty") return <p>Open a document to inspect its validation results.</p>;
  if (document.status === "processing") return <p>Reading and validating your document…</p>;
  if (document.status === "failure") return <p role="alert">{document.message}</p>;
  if (document.status === "valid")
    return (
      <>
        <h2>Apartment SVG is valid</h2>
        <p>
          Parsing, schema, references, and geometry passed. The trusted 2D apartment model is ready.
        </p>
      </>
    );
  return (
    <>
      <h2>{document.stage} validation failed</h2>
      {document.stage === "Parser" ? (
        <article className="diagnostic">
          <strong>{document.error.kind}</strong>
          <p>{document.error.message}</p>
          {document.error.location && (
            <p>
              Line {document.error.location.line}, column {document.error.location.column}
            </p>
          )}
        </article>
      ) : (
        <>
          <p>{document.errors.length} diagnostic(s)</p>
          <ol className="diagnostics">
            {document.errors.map((error, index) => (
              <li className="diagnostic" key={index}>
                <strong>{error.code}</strong>
                <p>{error.message}</p>
                <dl>
                  {Object.entries(error)
                    .filter(([key]) => key !== "code" && key !== "message")
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

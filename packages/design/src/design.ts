import type { FinishTargetId } from "@planaxis/model-3d";

export const DESIGN_SCHEMA = "planaxis-design/1.0";

export type DesignToneMapping = "agx" | "aces-filmic" | "neutral";

export interface DesignFinishAssignment {
  readonly target: FinishTargetId;
  /** An opaque resource location; Design 1.0 defines no material contents. */
  readonly material: string;
}

export interface DesignPresentation {
  readonly toneMapping?: DesignToneMapping;
  readonly exposureEv?: number;
}

/** Only the serialized Design 1.0 fields, without external descriptor identity. */
export interface DesignDocument {
  readonly schema: typeof DESIGN_SCHEMA;
  readonly name: string;
  readonly architecture: string;
  readonly finishes?: readonly DesignFinishAssignment[];
  readonly presentation?: DesignPresentation;
}

declare const validatedDesignBrand: unique symbol;

/** Format-conformant only: project access and architecture resolution remain separate. */
export interface ValidatedDesignDescriptor {
  readonly [validatedDesignBrand]: true;
  readonly path: string;
  readonly document: DesignDocument;
}

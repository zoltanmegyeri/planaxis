import type { FinishTargetId } from "@planaxis/model-3d";

export const DESIGN_SCHEMA = "planaxis-design/1.0";
export const DESIGN_SCHEMA_1_1 = "planaxis-design/1.1";

export type DesignToneMapping = "agx" | "aces-filmic" | "neutral";

export interface DesignFinishAssignment {
  readonly target: FinishTargetId;
  /** An opaque resource location; Design Format defines no material contents. */
  readonly material: string;
}

export interface DesignPresentation {
  readonly toneMapping?: DesignToneMapping;
  readonly exposureEv?: number;
}

interface DesignDocumentFields {
  readonly name: string;
  readonly architecture: string;
  readonly finishes?: readonly DesignFinishAssignment[];
  readonly presentation?: DesignPresentation;
}

/** Only serialized fields; the schema discriminates supported persistent semantics. */
export type DesignDocument = DesignDocumentFields &
  (
    | { readonly schema: typeof DESIGN_SCHEMA; readonly luminaires?: never }
    | {
        readonly schema: typeof DESIGN_SCHEMA_1_1;
        readonly luminaires?: readonly DesignLuminaire[];
      }
  );

/** Model-space centimeters, independent of level-local architectural heights. */
export interface DesignLuminairePosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Design 1.1 §16.6 frame: heading toward +Y from +X, positive pitch downward. */
export interface DesignLuminaireOrientation {
  readonly headingDegrees: number;
  readonly pitchDegrees: number;
  readonly rollDegrees: number;
}

interface DesignLuminaireFields {
  readonly id: string;
  readonly position: DesignLuminairePosition;
  readonly luminousFluxLumens: number;
  readonly colorTemperatureKelvin: number;
  readonly enabled: boolean;
  readonly dimming: number;
}

/** Idealized emitters, without renderer objects or implicit architectural attachment. */
export type DesignLuminaire = DesignLuminaireFields &
  (
    | { readonly type: "point" }
    | {
        readonly type: "spot";
        readonly orientation: DesignLuminaireOrientation;
        readonly beamAngleDegrees: number;
      }
    | {
        readonly type: "linear";
        readonly orientation: DesignLuminaireOrientation;
        readonly lengthCm: number;
      }
    | {
        readonly type: "area";
        readonly orientation: DesignLuminaireOrientation;
        readonly widthCm: number;
        readonly heightCm: number;
      }
  );

declare const validatedDesignBrand: unique symbol;

/** Format-conformant only: project access and architecture resolution remain separate. */
export interface ValidatedDesignDescriptor {
  readonly [validatedDesignBrand]: true;
  readonly path: string;
  readonly document: DesignDocument;
}

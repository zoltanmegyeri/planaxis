import type { FinishTarget, FinishTargetId } from "@planaxis/model-3d";
import type { ValidatedDesignDescriptor } from "./design.js";

/** The caller supplies targets derived from this exact, fully validated Apartment SVG. */
export interface DesignArchitecture {
  readonly path: string;
  readonly finishTargets: readonly Pick<FinishTarget, "id">[];
}

export type DesignResolutionError =
  | {
      readonly code: "DESIGN_ARCHITECTURE_MISMATCH";
      readonly expectedArchitecture: string;
      readonly actualArchitecture: string;
      readonly message: string;
    }
  | {
      readonly code: "DESIGN_UNRESOLVED_TARGET";
      readonly target: FinishTargetId;
      readonly assignmentIndex: number;
      readonly message: string;
    };

export type DesignResolutionResult =
  | { readonly ok: true; readonly value: ValidatedDesignDescriptor }
  | {
      readonly ok: false;
      readonly stage: "architecture";
      readonly errors: readonly DesignResolutionError[];
    };

/** Checks binding and target membership only; never establishes filesystem or SVG validity. */
export function resolveDesignArchitecture(
  design: ValidatedDesignDescriptor,
  architecture: DesignArchitecture,
): DesignResolutionResult {
  if (design.document.architecture !== architecture.path) {
    return {
      ok: false,
      stage: "architecture",
      errors: [
        {
          code: "DESIGN_ARCHITECTURE_MISMATCH",
          expectedArchitecture: design.document.architecture,
          actualArchitecture: architecture.path,
          message: "The design must resolve against its exact bound architecture.",
        },
      ],
    };
  }
  const targets = new Set(architecture.finishTargets.map((target) => target.id));
  const errors: DesignResolutionError[] = [];
  for (const [assignmentIndex, assignment] of (design.document.finishes ?? []).entries()) {
    if (!targets.has(assignment.target)) {
      errors.push({
        code: "DESIGN_UNRESOLVED_TARGET",
        target: assignment.target,
        assignmentIndex,
        message: `Finish target ${assignment.target} does not exist in the bound architecture.`,
      });
    }
  }
  return errors.length === 0
    ? { ok: true, value: design }
    : { ok: false, stage: "architecture", errors };
}

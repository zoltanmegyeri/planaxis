import { validateDesignDescriptor } from "@planaxis/design";
import type { DesignValidationResult, ValidatedDesignDescriptor } from "@planaxis/design";

export interface DesignDraft {
  name: string;
  toneMapping: string;
  exposureEv: string;
}

export function designDraft(descriptor: ValidatedDesignDescriptor): DesignDraft {
  return {
    name: descriptor.document.name,
    toneMapping: descriptor.document.presentation?.toneMapping ?? "",
    exposureEv: descriptor.document.presentation?.exposureEv?.toString() ?? "",
  };
}

export function editDesign(
  descriptor: ValidatedDesignDescriptor,
  draft: DesignDraft,
): DesignValidationResult<ValidatedDesignDescriptor> {
  const { schema, architecture, finishes } = descriptor.document;
  const presentation = {
    ...(draft.toneMapping === "" ? {} : { toneMapping: draft.toneMapping }),
    ...(draft.exposureEv.trim() === "" ? {} : { exposureEv: Number(draft.exposureEv) }),
  };
  return validateDesignDescriptor(
    {
      schema,
      name: draft.name,
      architecture,
      ...(finishes === undefined ? {} : { finishes }),
      ...(Object.keys(presentation).length === 0 ? {} : { presentation }),
    },
    descriptor.path,
  );
}

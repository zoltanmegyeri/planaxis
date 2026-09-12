/** Fixed names and identifiers defined by PlanAxis Project Format 1.0. */
export const PROJECT_SCHEMA = "planaxis-project/1.0";
export const PROJECT_MANIFEST_FILENAME = "planaxis.project.json";
export const PROJECT_ARCHITECTURE_DIRECTORY = "architecture";
export const PROJECT_ASSETS_DIRECTORY = "assets";
export const PROJECT_REFERENCES_DIRECTORY = "references";
export const PROJECT_DESIGNS_DIRECTORY = "designs";
export const PROJECT_OUTPUTS_DIRECTORY = "outputs";
export const PROJECT_INTERNAL_DIRECTORY = ".planaxis";
export const PROJECT_ARCHITECTURE_EXTENSION = ".svg";

export const OPTIONAL_PROJECT_DIRECTORIES = [
  PROJECT_ASSETS_DIRECTORY,
  PROJECT_REFERENCES_DIRECTORY,
  PROJECT_DESIGNS_DIRECTORY,
  PROJECT_OUTPUTS_DIRECTORY,
  PROJECT_INTERNAL_DIRECTORY,
] as const;

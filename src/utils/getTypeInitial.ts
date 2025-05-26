// This utility function retrieves the initial character for a given folder name
import typesConfig from "@/config/types.json";

export function getTypeInitial(folderName: string): string {
  const type = typesConfig.find(t => t.folderName === folderName);
  return type?.initial || '';
}

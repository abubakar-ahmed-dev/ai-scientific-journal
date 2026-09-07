/**
 * Neutralizes angle brackets in untrusted user text before it is embedded in a
 * delimited prompt context block (AI_ARCHITECTURE prompt-injection defense,
 * fixing-plan #19). Without this, observation or chat content can forge
 * closing `</context_data>` tags and break out of the untrusted-data
 * boundary. Content stays readable: `<`/`>` map to typographic guillemets.
 */
export function escapeContextText(text: string): string {
  if (!text) return text;
  return text.replace(/</g, "‹").replace(/>/g, "›");
}

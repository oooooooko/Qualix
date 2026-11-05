# Localization Maintenance

[简体中文](./README.md) | [English](./README.en.md)

## Unified setting

Choose **Settings → General → Interface Settings → Language**. The current browser stores the preference under `qualix:ui-language`. The main UI, Element Plus and Qualix AI use this setting.

## Layout

Each locale has its own directory, such as `zh-CN/` or `en/`:

- `ui.json`: main UI, buttons, dialogs, validation messages and node descriptions. Keys are Chinese source messages; dynamic values use `{0}`, `{1}`, and so on.
- `help.json`: in-app help paragraphs, headings and tables.
- `docs.json`: Markdown documentation translations with commands, code, links and formatting preserved.
- `llm.json`: Copy for LLM instructions, node reference and output rules. Exported flow JSON, script names, user notes and variable values remain unchanged.

`index.ts` registers locale names and catalogues. The main UI and Qualix AI share the Vue runtime in `src/i18n/index.ts`.

## Add a locale

1. Copy `en/` to a new locale directory. Translate the values while preserving keys and parameter placeholders.
2. Register the locale and its files in `index.ts`, using its native display name.
3. Add the matching Element Plus language pack in `src/main.ts`. The component library falls back to English if a pack is not registered.
4. Run `node bin/check-i18n.mjs`, then `node bin/sync-readme-docs.mjs` to regenerate documentation offline.
5. Build both applications and run localization tests. Check long labels and narrow layouts.

Keep script types, JSON fields, node IDs, variable names, selectors, package identifiers, command arguments and code examples unchanged. Use `t()` only for UI copy, passing dynamic content as parameters, for example `t('已导入 {0} 条测试用例', { 0: count })`. Do not translate user input, device-tree text, script names, execution logs or model output.

Published documentation is generated offline from `docs.json`. After editing a source Markdown file, add or update its translation entries before running the sync command. Keep the separate in-app `help.json` catalogue in sync too. Generation does not contact a translation service.

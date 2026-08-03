# Repository Guidelines

## Project Structure & Module Organization

LogoLens is a dependency-free Chrome Manifest V3 extension with a flat layout. `manifest.json` defines permissions, icons, the popup, and About page. `popup.html`, `popup.css`, and `popup.js` implement the UI and in-memory state. `extractor.js` contains the injected `extractAssets()` function, which discovers logos, favicons, inline SVGs, social images, and web-manifest icons. `options.html` and `privacy.html` reuse popup styles. Static icons live in `icons/`; documentation is in `README.md` and `PRIVACY.md`.

## Build, Test, and Development Commands

There is no package manager, build step, linter, or automated test command. Develop directly from the checked-out files.

- `python -m json.tool manifest.json > $null` validates manifest JSON in PowerShell.
- Open `chrome://extensions/`, enable Developer mode, choose **Load unpacked**, and select this repository root.
- After edits, click **Reload** on the extension card and reopen the popup. Browser refresh alone does not reload extension code.

Do not introduce an npm-based workflow unless the repository explicitly adopts one.

## Coding Style & Naming Conventions

Use two-space indentation in HTML, CSS, JavaScript, and JSON. Follow the existing JavaScript style: double quotes, semicolons, `camelCase` functions and variables, and `UPPER_SNAKE_CASE` limits. Use descriptive kebab-case CSS classes. Keep DOM selectors in `popup.js` synchronized with IDs, classes, and the card template in `popup.html`. `extractAssets()` must remain self-contained and return only values serializable by `chrome.scripting.executeScript()`.

## Testing Guidelines

Manually test on HTTP(S) pages after behavioral changes. Cover initial and repeated scans; all/logo/favicon filters; individual and bulk copy/download actions; inline SVG previews; web app manifest icons; and the expected error on Chrome internal pages. Check popup, About, and privacy layouts after shared CSS changes. There is no coverage requirement or test naming convention.

## Commit & Pull Request Guidelines

This checkout contains no Git history, so no project-specific commit convention can be inferred. Use short, imperative commits with a clear scope, for example `fix: preserve inline SVG dimensions`. Pull requests should explain the user-visible change, list manual test pages and results, link relevant issues, and include screenshots for UI changes. Call out any permission or data-handling change explicitly.

## Security & Release Notes

Keep permissions minimal and extraction local. If permissions, installation, or data handling changes, update `README.md`, `PRIVACY.md`, and `privacy.html` together. For releases, synchronize the version in `manifest.json` with the version displayed in `options.html`, and retain every icon size referenced by the manifest.

# 9TFox full-bleed A4 PDF print design

## Goal

Render 9TFox invoice templates as a dark, edge-to-edge A4 PDF without white
page gutters or an unnecessary trailing page when complete SWIFT details are
shown.

## Scope

- Apply only when the selected invoice template is a 9TFox design.
- Set the PDF page to A4 with zero page margin.
- Remove global print padding from the page container and invoice wrapper for
  9TFox templates.
- Make the template card exactly fill the A4 page area.
- Preserve the existing compact Ignition layout and full payment footer.
- Leave the default invoice print layout unchanged.

## Success criteria

- The PDF has no visible white border around a 9TFox invoice.
- A full SWIFT payment footer remains visible on the first A4 page.
- The 9TFox dark background reaches every PDF page edge.
- Existing screen layout and non-9TFox printing do not change.

## Verification

- Render the template regression fixtures and confirm they still compile.
- Add a print-layout assertion for the full-bleed A4 hooks.
- Run EJS compilation, JavaScript syntax checks, and whitespace validation.

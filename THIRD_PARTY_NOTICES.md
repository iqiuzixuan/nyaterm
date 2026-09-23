# Workbench UI sources

NyaTerm's workbench control styles adapt portions of Visual Studio Code's
`actionbar.css`, `button.css` and `inputBox.css` from tag **1.138.0**, commit
`7debcd0e2acdea1c52de81bf9ee1620444407dda`.

Copyright (c) 2015 - present Microsoft Corporation. Licensed under the MIT
License; the full text is in [licenses/vscode-MIT.txt](licenses/vscode-MIT.txt).
The adaptations use NyaTerm selectors, theme variables and React/Radix controls.
Source: <https://github.com/microsoft/vscode/tree/1.138.0/src/vs/base/browser/ui>.

Workbench action icons use **Codicons by Microsoft**, distributed as SVG React
components through the existing `react-icons/vsc` dependency. Codicons are
licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
Source: <https://github.com/microsoft/vscode-codicons>.
Full license: [licenses/codicons-CC-BY-4.0.txt](licenses/codicons-CC-BY-4.0.txt).
Icon paths are used without modification; their size and color inherit the UI.

This project is not affiliated with or endorsed by Microsoft or Visual Studio Code.

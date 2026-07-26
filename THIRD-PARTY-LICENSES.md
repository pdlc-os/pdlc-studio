# Third-party licences

Components redistributed inside this application and its released binaries.

## Bundled fonts

The conversation typeface picker (Settings → Conversation) ships these
families so every option renders on a machine that has none of them
installed. All are licensed under the **SIL Open Font License 1.1**, whose
full text is distributed with each upstream project and reproduced in
`frontend/node_modules/@fontsource/<family>/LICENSE`.

Four names the picker offers are proprietary and are **not** bundled:
Bookman Old Style, Helvetica, Proxima Nova and Georgia. Those entries use the
licensed font only when the machine already has it, and otherwise fall back to
the OFL family noted below.

| Family | Role in the app | Copyright |
| ------ | --------------- | --------- |
| Inter | Sans serif — the “Inter” option | Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) |
| Montserrat | Sans serif — the “Montserrat” option | Copyright 2011 The Montserrat Project Authors (https://github.com/JulietaUla/Montserrat) |
| Arimo | Fallback for “Helvetica” (metric-compatible with Arial/Helvetica) | Copyright 2020 The Arimo Project Authors (https://github.com/googlefonts/arimo) |
| Nunito Sans | Fallback for “Proxima Nova” | Copyright 2016 The Nunito Sans Project Authors (https://github.com/Fonthausen/NunitoSans) |
| EB Garamond | The “Garamond” option | Copyright 2017 The EB Garamond Project Authors (https://github.com/octaviopardo/EBGaramond12) |
| Gelasio | Fallback for “Georgia” (metric-compatible with Georgia) | Copyright 2022 The Gelasio Project Authors (https://github.com/SorkinType/Gelasio) |
| Bitter | Fallback for “Bookman” | Copyright 2011 The Bitter Project Authors (https://github.com/solmatas/BitterPro) |
| OpenDyslexic | The “Dyslexic friendly” option | Copyright (c) 2019-07-29, Abbie Gonzalez (https://abbiecod.es|support@abbiecod.es), |

Only the Latin subset at weights 400 and 700 is bundled; the legacy `.woff`
copies each package advertises are deliberately not shipped.

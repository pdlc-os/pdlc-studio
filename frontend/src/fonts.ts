/**
 * Fonts bundled for the conversation typeface picker.
 *
 * These ship with the app so every option in Settings → Conversation renders
 * the same on a machine that has none of them installed — including the
 * single-binary release, where Vite emits them into `dist/static` and
 * `deno compile --include` embeds that.
 *
 * **Every bundled family is SIL Open Font License 1.1**, which is what makes
 * redistribution legal. Four of the names the picker offers are *not*: Bookman
 * Old Style, Helvetica, Proxima Nova and Georgia are proprietary and cannot be
 * bundled. Those entries name the real font first — so a machine that has it
 * licensed uses it — and fall back to the closest OFL face:
 *
 *   Helvetica     -> Arimo        (metric-compatible with Arial/Helvetica)
 *   Georgia       -> Gelasio      (metric-compatible with Georgia)
 *   Proxima Nova  -> Nunito Sans  (style only; metrics differ)
 *   Bookman       -> Bitter       (nearest sturdy slab; not a true clone)
 *
 * The two metric-compatible substitutes fall back without reflowing the text.
 * The other two do not, so a machine with the licensed font and one without
 * will lay the same message out differently.
 *
 * The @font-face rules live in `fonts.css` rather than coming from each
 * package's stylesheet — see the note there on why the legacy `.woff` copies
 * are deliberately not shipped.
 */
import "./fonts.css";

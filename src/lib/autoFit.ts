/**
 * Deterministic text auto-fit helpers (BLOB auto-scaler parity).
 *
 * Why canvas measurement: measuring DOM scrollWidth silently breaks when the
 * "available" box is itself sized by its content (flex `min-width: auto`) or
 * when the webfont swaps in after measure — the scale then never leaves 1.
 * `measureText` uses the element's computed font directly, so the number is
 * correct regardless of layout/transform state.
 */

const measureCanvas: HTMLCanvasElement | null =
  typeof document !== 'undefined' ? document.createElement('canvas') : null

/** Width of `text` as it would visually render on `el` (applies the element's
    text-transform, computed font and letter-spacing). */
export function measureTextWidth(text: string, el: HTMLElement): number {
  if (!measureCanvas || !text) return 0
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return 0
  const cs = getComputedStyle(el)
  // canvas measureText ignores CSS text-transform — mirror it manually so
  // uppercase team names measure at their REAL rendered width.
  let t = text
  if (cs.textTransform === 'uppercase') t = t.toUpperCase()
  else if (cs.textTransform === 'lowercase') t = t.toLowerCase()
  else if (cs.textTransform === 'capitalize') t = t.replace(/\b\p{L}/gu, c => c.toUpperCase())
  const weight = cs.fontWeight === '400' ? '' : cs.fontWeight
  ctx.font = `${cs.fontStyle === 'italic' ? 'italic ' : ''}${weight} ${cs.fontSize} ${cs.fontFamily}`
  let w = ctx.measureText(t).width
  const ls = parseFloat(cs.letterSpacing)
  if (Number.isFinite(ls) && ls !== 0) w += ls * t.length
  return w
}

/**
 * Scale in [minScale, 1] that fits `text` (as rendered on `el`) inside
 * `availContentWidth` CSS pixels. Returns 1 when it already fits.
 */
export function fitScaleFor(
  text: string,
  el: HTMLElement,
  availContentWidth: number,
  minScale = 0.35,
): number {
  if (availContentWidth <= 0) return 1
  const w = measureTextWidth(text, el)
  if (w <= 0) return 1
  return w > availContentWidth ? Math.max(minScale, availContentWidth / w) : 1
}

/** Available content width of `box` minus its horizontal padding. */
export function contentWidth(box: HTMLElement): number {
  const cs = getComputedStyle(box)
  return Math.max(
    0,
    box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0),
  )
}

/**
 * Re-run `fit` once the element's webfont has actually loaded (force-load the
 * exact face, then wait for `document.fonts.ready`). Always calls `fit` at
 * least once, even without FontFaceSet support.
 */
export function refitAfterFonts(el: HTMLElement | null, fit: () => void): void {
  const fonts: FontFaceSet | undefined = (document as any)?.fonts
  if (!fonts) { fit(); return }
  const p = el ? fonts.load(getComputedStyle(el).font).catch(() => {}) : Promise.resolve()
  Promise.all([p, fonts.ready.catch(() => {})])
    .then(() => fit())
    .catch(() => fit())
  // Safety net: a second pass after paint catches late layout settles.
  requestAnimationFrame(() => requestAnimationFrame(() => fit()))
}

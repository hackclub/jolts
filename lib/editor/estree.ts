/* MDX attribute expressions, both directions.

   Attributes like `pins={[{ pin: "GP0", ... }]}` arrive from
   mdast-util-mdx-jsx as an estree Program. The editor needs the plain JS
   value (to populate a form) and, on the way back out, a readable MDX
   expression string. Only JSON-shaped literals are supported - the content
   vocabulary never needs identifiers or calls, and refusing them keeps
   this a data decoder, not an eval. */

type EstreeNode = {
  type: string
  [key: string]: unknown
}

export class ExpressionError extends Error {}

/** estree literal AST → plain JS value. Throws on anything non-literal. */
export function evaluateEstree(node: EstreeNode): unknown {
  switch (node.type) {
    case "Program": {
      const body = node.body as EstreeNode[]
      const stmt = body.find((n) => n.type === "ExpressionStatement")
      if (!stmt) throw new ExpressionError("empty expression")
      return evaluateEstree(stmt.expression as EstreeNode)
    }
    case "ExpressionStatement":
      return evaluateEstree(node.expression as EstreeNode)
    case "Literal":
      return node.value
    case "TemplateLiteral": {
      const exprs = node.expressions as EstreeNode[]
      if (exprs.length > 0)
        throw new ExpressionError("template with interpolation")
      const quasis = node.quasis as { value: { cooked: string } }[]
      return quasis.map((q) => q.value.cooked).join("")
    }
    case "ArrayExpression":
      return (node.elements as (EstreeNode | null)[]).map((el) => {
        if (!el) throw new ExpressionError("array hole")
        return evaluateEstree(el)
      })
    case "ObjectExpression": {
      const out: Record<string, unknown> = {}
      for (const prop of node.properties as EstreeNode[]) {
        if (prop.type !== "Property" || prop.computed)
          throw new ExpressionError("unsupported object property")
        const key = prop.key as EstreeNode
        const name =
          key.type === "Identifier"
            ? (key.name as string)
            : key.type === "Literal"
              ? String(key.value)
              : null
        if (name === null) throw new ExpressionError("unsupported key")
        out[name] = evaluateEstree(prop.value as EstreeNode)
      }
      return out
    }
    case "UnaryExpression": {
      if (node.operator !== "-")
        throw new ExpressionError(`unary ${node.operator}`)
      const v = evaluateEstree(node.argument as EstreeNode)
      if (typeof v !== "number") throw new ExpressionError("negated non-number")
      return -v
    }
    default:
      throw new ExpressionError(`unsupported node ${node.type}`)
  }
}

/* ---------- value → MDX expression text ---------- */

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function printKey(key: string): string {
  return IDENT_RE.test(key) ? key : JSON.stringify(key)
}

function printInline(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(printInline).join(", ")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined
    )
    if (entries.length === 0) return "{}"
    return `{ ${entries
      .map(([k, v]) => `${printKey(k)}: ${printInline(v)}`)
      .join(", ")} }`
  }
  return JSON.stringify(value)
}

/** Plain value → the expression text used inside `attr={...}`. Formats the
    way content authors write it by hand: arrays of objects go one object
    per line, everything else stays inline. */
export function printExpression(value: unknown, indent = 2): string {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => v && typeof v === "object" && !Array.isArray(v))
  ) {
    const pad = " ".repeat(indent + 2)
    const items = value.map((v) => `${pad}${printInline(v)},`).join("\n")
    return `[\n${items}\n${" ".repeat(indent)}]`
  }
  return printInline(value)
}

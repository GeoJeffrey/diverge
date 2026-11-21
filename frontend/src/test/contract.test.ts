/**
 * The demo API must speak exactly the backend's contract. Every mock response is validated against
 * its 200/201 response schema in docs/openapi.json (the source of truth), so fixtures can't drift.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mockRequest } from "@/mocks/handler";
import { issueTokens } from "@/mocks/fixtures";

type Schema = Record<string, unknown>;
const spec = JSON.parse(readFileSync(resolve(__dirname, "../../../docs/openapi.json"), "utf-8"));

function deref(s: Schema): Schema {
  const ref = s.$ref as string | undefined;
  return ref ? deref(spec.components.schemas[ref.split("/").pop()!]) : s;
}

function validate(value: unknown, schema: Schema, path: string, errors: string[]) {
  const s = deref(schema);
  if (value === null && s.nullable === true) return; // OpenAPI 3.0 nullable
  const anyOf = (s.anyOf ?? s.oneOf) as Schema[] | undefined;
  if (anyOf) {
    const ok = anyOf.some((alt) => { const e: string[] = []; validate(value, alt, path, e); return e.length === 0; });
    if (!ok) errors.push(`${path}: matches none of anyOf`);
    return;
  }
  if (s.enum && !(s.enum as unknown[]).includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
  switch (s.type) {
    case "null": if (value !== null) errors.push(`${path}: expected null`); return;
    case "string": if (typeof value !== "string") errors.push(`${path}: expected string`); return;
    case "boolean": if (typeof value !== "boolean") errors.push(`${path}: expected boolean`); return;
    case "integer": if (!Number.isInteger(value)) errors.push(`${path}: expected integer`); return;
    case "number": if (typeof value !== "number") errors.push(`${path}: expected number`); return;
    case "array":
      if (!Array.isArray(value)) { errors.push(`${path}: expected array`); return; }
      value.forEach((v, i) => validate(v, (s.items ?? {}) as Schema, `${path}[${i}]`, errors));
      return;
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) { errors.push(`${path}: expected object`); return; }
      const props = (s.properties ?? {}) as Record<string, Schema>;
      const required = new Set((s.required ?? []) as string[]);
      for (const r of required) if (!(r in value)) errors.push(`${path}.${r}: required but missing`);
      for (const [k, v] of Object.entries(value)) {
        if (props[k]) validate(v, props[k], `${path}.${k}`, errors);
        else if (s.additionalProperties && typeof s.additionalProperties === "object") validate(v, s.additionalProperties as Schema, `${path}.${k}`, errors);
        else if (s.additionalProperties === false || Object.keys(props).length > 0) {
          if (s.additionalProperties !== true && !s.additionalProperties) errors.push(`${path}.${k}: not in the contract`);
        }
      }
    }
  }
}

function responseSchema(path: string, method: string, status: string): Schema {
  return spec.paths[path][method].responses[status].content["application/json"].schema;
}

const access = issueTokens("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d").access_token;

const cases: [string, string, string, string, unknown?][] = [
  ["/health", "/health", "get", "200"],
  ["/tickers", "/tickers", "get", "200"],
  ["/outlook", "/outlook", "get", "200"],
  ["/outlook/model", "/outlook/model", "get", "200"],
  ["/ticker/{symbol}/outlook", "/ticker/RELIANCE/outlook", "get", "200"],
  ["/ticker/{symbol}/outlook", "/ticker/SBIN/outlook", "get", "200"],
  ["/ticker/{symbol}/simple", "/ticker/INFY/simple", "get", "200"],
  ["/ticker/{symbol}/simple", "/ticker/SBIN/simple", "get", "200"],
  ["/ticker/{symbol}", "/ticker/HDFCBANK", "get", "200"],
  ["/ticker/{symbol}", "/ticker/SBIN", "get", "200"],
  ["/ticker/{symbol}/reasoning", "/ticker/HDFCBANK/reasoning", "get", "200"],
  ["/auth/me", "/auth/me", "get", "200"],
  ["/auth/login", "/auth/login", "post", "200", { email: "trader@example.com", password: "SecurePass123!" }],
];

describe("demo API matches docs/openapi.json", () => {
  it.each(cases)("%s (%s)", async (specPath, url, method, status, body) => {
    const res = await mockRequest(method.toUpperCase(), url, body, access);
    expect(String(res.status)).toBe(status);
    const errors: string[] = [];
    validate(res.body, responseSchema(specPath, method, status), "body", errors);
    expect(errors).toEqual([]);
  });

  it("covers every GET path in the contract", () => {
    const gets = Object.keys(spec.paths).filter((p) => spec.paths[p].get);
    const covered = new Set(cases.filter((c) => c[2] === "get").map((c) => c[0]));
    expect(gets.filter((p) => !covered.has(p))).toEqual([]);
  });
});

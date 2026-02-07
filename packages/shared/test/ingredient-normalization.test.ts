import { describe, expect, it } from "vitest";
import { normalizeIngredient } from "../src/ingredient-normalization";

describe("ingredient normalization", () => {
  it("maps noisy package prefixes to canonical ingredient names", () => {
    const gnocchi = normalizeIngredient("forp gnocchi");
    const ris = normalizeIngredient("port ris");

    expect(gnocchi.displayName).toBe("Gnocchi");
    expect(ris.displayName).toBe("Ris");
  });

  it("keeps swedish display names with correct characters", () => {
    const garlic = normalizeIngredient("2 klyftor vitlök, finhackad");
    expect(garlic.displayName).toBe("Vitlök");
  });

  it("normalizes mixed volume units into a shared base", () => {
    const a = normalizeIngredient("0.5 dl vatten");
    const b = normalizeIngredient("2 l vatten");

    expect(a.unit).toBe("ml");
    expect(a.amount).toBe(50);
    expect(b.unit).toBe("ml");
    expect(b.amount).toBe(2000);
  });
});

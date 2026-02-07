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

  it("maps citrus variants with peel/juice descriptions to same base item", () => {
    const a = normalizeIngredient("Citron");
    const b = normalizeIngredient("Citron finrivet skal");
    const c = normalizeIngredient("Citroner pressad saft och rivet skal");

    expect(a.displayName).toBe("Citron");
    expect(b.displayName).toBe("Citron");
    expect(c.displayName).toBe("Citron");
  });

  it("collapses descriptor and spacing variants to a shared canonical item", () => {
    const citronBase = normalizeIngredient("Citron - 2 st");
    const citronLite = normalizeIngredient("Citron lite - 1 st");
    const citronBroken = normalizeIngredient("Citron- ortris - 1 st");
    const dill = normalizeIngredient("Dill - 50 ml");
    const dillPlockad = normalizeIngredient("Dill plockad - 50 ml");
    const buljongA = normalizeIngredient("Gronsaksbuljong tarning - 1 st");
    const buljongB = normalizeIngredient("Gronsaksbuljongtarning - 1 st");
    const onionA = normalizeIngredient("Gul lök - 1 st");
    const onionB = normalizeIngredient("Gul lok stor - 1 st");

    expect(citronBase.displayName).toBe("Citron");
    expect(citronLite.displayName).toBe("Citron");
    expect(citronBroken.displayName).toBe("Citron");
    expect(dill.displayName).toBe("Dill");
    expect(dillPlockad.displayName).toBe("Dill");
    expect(buljongA.displayName).toBe("Grönsaksbuljong");
    expect(buljongB.displayName).toBe("Grönsaksbuljong");
    expect(onionA.displayName).toBe("Gul lök");
    expect(onionB.displayName).toBe("Gul lök");
  });
});

import { Dish } from "@middagsvalet/shared";
import { db } from "../src/db";

const cuisines = ["italienskt", "asiatiskt", "husman", "mexikanskt", "medelhav", "indiskt", "street"];
const proteins = ["kyckling", "fisk", "nötkött", "vegetariskt", "fläsk"];
const allergenPool = ["gluten", "laktos", "nötter", "ägg", "soja"];
const moodTags: Array<Dish["tags"][number]> = ["comfort", "fresh", "spicy", "budget"];
const ingredientCatalog = {
  "Frukt&Gront": ["tomat", "lök", "morot", "paprika", "spenat", "potatis", "broccoli", "vitlök", "gurka", "zucchini"],
  Mejeri: ["mjölk", "yoghurt", "smör", "ost", "creme fraiche"],
  Skafferi: ["ris", "pasta", "bulgur", "krossade tomater", "kokosmjölk", "bönor", "linser"],
  "Kott/Fisk": ["kycklingfilé", "lax", "nötfärs", "fläskfilé", "tofu"],
  Kryddor: ["salt", "peppar", "paprikapulver", "spiskummin", "oregano", "chili"],
} as const;

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]) => arr[randomInt(0, arr.length - 1)];

const buildDish = (index: number): Dish => {
  const cuisineA = pick(cuisines);
  const cuisineB = pick(cuisines.filter((c) => c !== cuisineA));
  const protein = pick(proteins);
  const name = `${cuisineA} ${protein} bowl ${index + 1}`;
  const timeMinutes = pick([15, 20, 25, 30, 35, 40, 45]);
  const difficulty = timeMinutes <= 20 ? "easy" : timeMinutes <= 35 ? "medium" : "hard";
  const kidFriendlyScore = randomInt(45, 95);

  const allergens = allergenPool.filter(() => Math.random() < 0.2);

  const ingredients: Dish["ingredients"] = [
    {
      name: pick(ingredientCatalog["Kott/Fisk"]),
      amount: randomInt(300, 900),
      unit: "g",
      category: "Kott/Fisk",
    },
    {
      name: pick(ingredientCatalog.Skafferi),
      amount: randomInt(200, 600),
      unit: "g",
      category: "Skafferi",
    },
    {
      name: pick(ingredientCatalog["Frukt&Gront"]),
      amount: randomInt(1, 4),
      unit: "st",
      category: "Frukt&Gront",
    },
    {
      name: pick(ingredientCatalog.Kryddor),
      amount: randomInt(1, 4),
      unit: "tsk",
      category: "Kryddor",
    },
    {
      name: pick(ingredientCatalog.Mejeri),
      amount: randomInt(1, 3),
      unit: "dl",
      category: "Mejeri",
    },
  ];

  return {
    id: `dish-${index + 1}`,
    title: name,
    cuisineTags: [cuisineA, cuisineB],
    proteinTag: protein,
    timeMinutes,
    difficulty,
    kidFriendlyScore,
    ingredients,
    instructionsShort: "Stek protein, koka bas, blanda med gronsaker och kryddor.",
    allergens,
    tags: [pick(moodTags), pick(moodTags.filter((tag) => tag !== moodTags[0]))],
    imageUrl: `https://picsum.photos/seed/dish-${index + 1}/640/480`,
  };
};

const dishes = Array.from({ length: 300 }, (_, index) => buildDish(index));

const removeAll = db.prepare("DELETE FROM dishes");
removeAll.run();

const insert = db.prepare(`
  INSERT INTO dishes (
    id, title, cuisineTags, proteinTag, timeMinutes, difficulty, kidFriendlyScore,
    ingredients, instructionsShort, allergens, tags, imageUrl, createdAt
  ) VALUES (
    @id, @title, @cuisineTags, @proteinTag, @timeMinutes, @difficulty, @kidFriendlyScore,
    @ingredients, @instructionsShort, @allergens, @tags, @imageUrl, @createdAt
  )
`);

const tx = db.transaction((entries: Dish[]) => {
  for (const dish of entries) {
    insert.run({
      ...dish,
      cuisineTags: JSON.stringify(dish.cuisineTags),
      ingredients: JSON.stringify(dish.ingredients),
      allergens: JSON.stringify(dish.allergens),
      tags: JSON.stringify(dish.tags),
      createdAt: new Date().toISOString(),
    });
  }
});

tx(dishes);
console.log(`Seeded ${dishes.length} dishes.`);

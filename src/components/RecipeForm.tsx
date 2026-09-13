import { createRecipe, updateRecipe } from "@/app/(app)/recipes/actions";
import { TagPicker } from "@/components/TagPicker";

type Category = { id: string; name: string };

type RecipeFormProps = {
  mode: "create" | "edit";
  recipeId?: string;
  categories: Category[];
  tagOptions?: string[];
  defaults?: {
    title?: string;
    description?: string | null;
    servings?: number;
    prepMinutes?: number | null;
    cookMinutes?: number | null;
    categoryId?: string | null;
    vegPortions?: number | null;
    allowWeeklyRepeat?: boolean;
    ingredientsText?: string;
    stepsText?: string;
    tags?: string[];
  };
};

export function RecipeForm({
  mode,
  recipeId,
  categories,
  tagOptions = [],
  defaults = {},
}: RecipeFormProps) {
  const action =
    mode === "create"
      ? createRecipe
      : updateRecipe.bind(null, recipeId as string);

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            className="field"
            id="title"
            name="title"
            required
            defaultValue={defaults.title || ""}
            placeholder="Sunday roast chicken"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">
            Short description
          </label>
          <textarea
            className="field min-h-24"
            id="description"
            name="description"
            defaultValue={defaults.description || ""}
            placeholder="Why this one’s a keeper…"
          />
        </div>
        <div>
          <label className="label" htmlFor="servings">
            Servings
          </label>
          <input
            className="field"
            id="servings"
            name="servings"
            type="number"
            min={1}
            defaultValue={defaults.servings ?? 4}
          />
        </div>
        <div>
          <label className="label" htmlFor="categoryId">
            Type
          </label>
          <select
            className="field"
            id="categoryId"
            name="categoryId"
            defaultValue={defaults.categoryId || ""}
          >
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="prepMinutes">
            Prep (minutes)
          </label>
          <input
            className="field"
            id="prepMinutes"
            name="prepMinutes"
            type="number"
            min={0}
            defaultValue={defaults.prepMinutes ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="cookMinutes">
            Cook (minutes)
          </label>
          <input
            className="field"
            id="cookMinutes"
            name="cookMinutes"
            type="number"
            min={0}
            defaultValue={defaults.cookMinutes ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="vegPortions">
            Of your 5 a day
          </label>
          <input
            className="field max-w-xs"
            id="vegPortions"
            name="vegPortions"
            type="number"
            min={0}
            max={5}
            defaultValue={defaults.vegPortions ?? ""}
            placeholder="e.g. 3"
          />
        </div>
        <div className="sm:col-span-2">
          <TagPicker options={tagOptions} selected={defaults.tags || []} />
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm font-medium text-[var(--ink-soft)]">
        <input
          type="checkbox"
          name="allowWeeklyRepeat"
          defaultChecked={defaults.allowWeeklyRepeat}
          className="size-4 accent-[var(--leaf-deep)]"
        />
        OK to repeat week to week in meal plans
      </label>

      <div>
        <label className="label" htmlFor="ingredients">
          Ingredients (one per line)
        </label>
        <p className="mb-2 text-xs text-[var(--ink-soft)]">
          Metric preferred — e.g. <code>200 g chicken breast</code>,{" "}
          <code>2 tbsp olive oil</code>, or just <code>salt</code>. Cups/oz are
          fine too.
        </p>
        <textarea
          className="field min-h-48 font-mono text-sm"
          id="ingredients"
          name="ingredients"
          required
          defaultValue={defaults.ingredientsText || ""}
          placeholder={"400 g chicken thighs\n1 tsp smoked paprika\nsalt"}
        />
      </div>

      <div>
        <label className="label" htmlFor="steps">
          Method (one step per line)
        </label>
        <textarea
          className="field min-h-48"
          id="steps"
          name="steps"
          required
          defaultValue={defaults.stepsText || ""}
          placeholder={"Preheat the oven to 200°C.\nSeason the chicken…"}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" type="submit">
          {mode === "create" ? "Save recipe" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

import { redirect } from "next/navigation";

/** Legacy import route — unified into Add recipe. */
export default function ImportPage() {
  redirect("/recipes/new");
}

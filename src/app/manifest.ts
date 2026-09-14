import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recipe Book",
    short_name: "Recipe Book",
    description: "Household recipe archive, meal planner, and shopping list",
    start_url: "/home",
    display: "standalone",
    background_color: "#e8efeb",
    theme_color: "#1e4a3c",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

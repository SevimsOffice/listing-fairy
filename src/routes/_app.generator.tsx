import { createFileRoute } from "@tanstack/react-router";
import ListingGenerator from "@/components/ListingGenerator";

export const Route = createFileRoute("/_app/generator")({
  component: ListingGenerator,
  head: () => ({
    meta: [
      { title: "Listing Generator — Etsy Listing Generator" },
      {
        name: "description",
        content:
          "Upload your artwork and instantly get PNG, JPG, PDF download files plus room mockups for your Etsy listing.",
      },
    ],
  }),
});

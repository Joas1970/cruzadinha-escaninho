import { createFileRoute } from "@tanstack/react-router";
import { CrosswordPlay } from "@/components/crossword/play";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CrosswordPlay />;
}

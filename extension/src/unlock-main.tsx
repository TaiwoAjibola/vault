import { createRoot } from "react-dom/client";
import { UnlockPage } from "./unlock";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<UnlockPage />);
}

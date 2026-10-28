import { defineConfig } from "astro/config";
export default defineConfig({
  base: process.env.ASTRO_BASE || "/Astro-webs/casa-piloto/",
  site: process.env.ASTRO_SITE || "http://localhost",
  output: "static",
  devToolbar: { enabled: false },
});

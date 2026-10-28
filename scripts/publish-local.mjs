import { cpSync, mkdirSync, existsSync } from "node:fs";
const target = "C:/xampp/htdocs/Astro-webs/casa-piloto";
if (!existsSync("dist/index.html"))
  throw new Error("Ejecuta npm run build antes.");
mkdirSync(target, { recursive: true });
cpSync("dist", target, { recursive: true });
console.log("Publicado en http://localhost/Astro-webs/casa-piloto/");

import "./style.css";

const applicationRoot = document.querySelector<HTMLElement>("#app");

if (applicationRoot === null) {
  throw new Error("PlanAxis application root was not found.");
}

applicationRoot.innerHTML = `
  <section class="welcome" aria-labelledby="welcome-title">
    <p class="eyebrow">Apartment modeling toolkit</p>
    <h1 id="welcome-title">PlanAxis</h1>
    <p>The TypeScript workspace is ready for deterministic apartment tooling.</p>
  </section>
`;

// ==========================================
// RECENSIONI LAVORO
// Collegamento a Supabase
// ==========================================

// 1. INCOLLA QUI IL PROJECT URL DI SUPABASE
const SUPABASE_URL = "https://orvhpbbpaqbphnxajizs.supabase.co";

// 2. INCOLLA QUI LA PUBLISHABLE KEY
const SUPABASE_KEY = "sb_publishable_nN_-EClb2m55_WOUKj7iJg_pXEa01Yq";

// ==========================================
// CONNESSIONE SUPABASE
// ==========================================

const { createClient } = supabase;

const db = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ==========================================
// ELEMENTI DELLA PAGINA
// ==========================================

const grid = document.getElementById("companyGrid");
const empty = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

const modal = document.getElementById("reviewModal");
const form = document.getElementById("reviewForm");

// ==========================================
// STELLE
// ==========================================

function stars(score) {
  const rounded = Math.round(score);

  return "★".repeat(rounded) +
         "☆".repeat(5 - rounded);
}

// ==========================================
// SICUREZZA HTML
// ==========================================

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

// ==========================================
// CARICA LE AZIENDE
// ==========================================

async function loadCompanies(filter = "") {

  const { data, error } = await db
    .from("aziende")
    .select(`
      id,
      nome,
      citta,
      provincia,
      recensioni (
        valutazione
      )
    `)
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error(error);

    grid.innerHTML = `
      <div class="empty">
        Impossibile caricare le aziende.
      </div>
    `;

    return;
  }

  const q = filter.trim().toLowerCase();

  const companies = data.filter(company => {

    const text =
      `${company.nome} ${company.citta} ${company.provincia || ""}`
      .toLowerCase();

    return text.includes(q);
  });

  renderCompanies(companies);
}

// ==========================================
// MOSTRA LE AZIENDE
// ==========================================

function renderCompanies(companies) {

  if (!companies.length) {

    grid.innerHTML = "";

    empty.classList.remove("hidden");

    return;
  }

  empty.classList.add("hidden");

  grid.innerHTML = companies.map(company => {

    const reviews =
      company.recensioni || [];

    const count =
      reviews.length;

    const average =
      count
        ? reviews.reduce(
            (sum, review) =>
              sum + review.valutazione,
            0
          ) / count
        : 0;

    return `
      <article class="company-card">

        <div class="company-top">

          <div>

            <div class="company-name">
              ${escapeHtml(company.nome)}
            </div>

            <div class="city">
              📍 ${escapeHtml(company.citta)}
            </div>

          </div>

          <div class="stars">
            ${count ? stars(average) : "☆☆☆☆☆"}
          </div>

        </div>

        <div class="score">

          ${count ? average.toFixed(1) : "N/D"}

          <span class="review-count">
            ${count === 1
              ? " / 5 · 1 recensione"
              : ` / 5 · ${count} recensioni`
            }
          </span>

        </div>

      </article>
    `;

  }).join("");
}

// ==========================================
// RICERCA
// ==========================================

document
  .getElementById("searchBtn")
  .addEventListener("click", () => {

    document
      .getElementById("aziende")
      .scrollIntoView({
        behavior: "smooth"
      });

    loadCompanies(
      searchInput.value
    );

  });

searchInput.addEventListener(
  "input",
  () => loadCompanies(searchInput.value)
);

// ==========================================
// MODALE
// ==========================================

function openModal() {

  modal.classList.remove("hidden");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );
}

function closeModal() {

  modal.classList.add("hidden");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );
}

document
  .getElementById("openReview")
  .addEventListener("click", openModal);

document
  .getElementById("addCompany")
  .addEventListener("click", openModal);

document
  .querySelectorAll("[data-close]")
  .forEach(element => {

    element.addEventListener(
      "click",
      closeModal
    );

  });

// ==========================================
// INVIO RECENSIONE
// ==========================================

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const name =
      document
        .getElementById("companyName")
        .value
        .trim();

    const city =
      document
        .getElementById("companyCity")
        .value
        .trim();

    const score =
      Number(
        document
          .getElementById("overall")
          .value
      );

    const pros =
      document
        .getElementById("pros")
        .value
        .trim();

    const cons =
      document
        .getElementById("cons")
        .value
        .trim();

    if (!name || !city || !score) {

      alert(
        "Inserisci azienda, luogo e valutazione."
      );

      return;
    }

    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );

    submitButton.disabled = true;

    submitButton.textContent =
      "Invio in corso...";

    try {

      // --------------------------------------
      // CERCA L'AZIENDA
      // --------------------------------------

      const { data: existingCompany, error: searchError } =
        await db
          .from("aziende")
          .select("id")
          .ilike("nome", name)
          .ilike("citta", city)
          .maybeSingle();

      if (searchError) {
        throw searchError;
      }

      let companyId;

      // --------------------------------------
      // SE NON ESISTE, CREALA
      // --------------------------------------

      if (!existingCompany) {

        const { data: newCompany, error: companyError } =
          await db
            .from("aziende")
            .insert({
              nome: name,
              citta: city
            })
            .select("id")
            .single();

        if (companyError) {
          throw companyError;
        }

        companyId =
          newCompany.id;

      } else {

        companyId =
          existingCompany.id;
      }

      // --------------------------------------
      // SALVA LA RECENSIONE
      // --------------------------------------

      const { error: reviewError } =
        await db
          .from("recensioni")
          .insert({

            azienda_id: companyId,

            valutazione: score,

            pro: pros || null,

            contro: cons || null,

            stato: "pending"

          });

      if (reviewError) {
        throw reviewError;
      }

      // --------------------------------------
      // SUCCESSO
      // --------------------------------------

      form.reset();

      closeModal();

      alert(
        "Grazie! La tua recensione è stata inviata " +
        "e verrà pubblicata dopo la moderazione."
      );

      loadCompanies(
        searchInput.value
      );

    } catch (error) {

      console.error(error);

      alert(
        "Si è verificato un errore. " +
        "La recensione non è stata inviata."
      );

    } finally {

      submitButton.disabled = false;

      submitButton.textContent =
        "Pubblica recensione anonima";
    }

  }
);

// ==========================================
// AVVIO
// ==========================================

loadCompanies();

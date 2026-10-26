const P = window.FarmPricing;
const STORAGE_KEY = "minecraft-farm-prices-v1";

const COIN_SRC = {
  copper: "assets/coins/copper.png",
  iron: "assets/coins/iron.png",
  gold: "assets/coins/gold.png",
};

const FORMULA = [
  "Le prix plancher couvre les intrants, la construction, le temps de travail, le temps de jeu, et une marge.",
  "Coût d'un objet = intrants + construction étalée + travail étalé + temps de jeu.",
  "Intrants = (quantités horaires × prix du catalogue) ÷ production horaire.",
  "Construction étalée = (matériaux + pièces déjà payées) ÷ (production horaire × heures d'amortissement).",
  "Travail étalé = (heures de la difficulté × salaire horaire) ÷ (production horaire × heures d'amortissement).",
  "AFK : le temps de jeu vaut 0. Actif : chaque heure ajoute le rapport du minage. Devant la ferme : chaque heure ajoute le salaire × impact.",
  "Prix plancher = coût × (1 + marge ÷ 100). Ce prix d'objet peut être décimal, y compris s'il est écrit à la main. Il sert tel quel quand l'objet devient un intrant.",
  "Les lots (1, 16, 32, 64, 3 stacks, 9 stacks, 1 shulker) sont des prix entiers. Chacun monte au cuivre, ou à la pièce choisie si tu arrondis plus haut. Le format de base est au prix plein. Chaque format plus gros enlève le pourcentage de remise, une fois par palier.",
  "Ferme : la production est un nombre d'objets par heure. À trouver : une trouvaille toutes les X heures, payées au salaire de recherche, puis des heures de travail payées au rapport du minage.",
  "10 PC = 1 PF, 10 PF = 1 PO, 10 PO = 1 PD. Ce taux ne se règle pas.",
];

const ROUND_OPTIONS = [
  ["1", "Cuivre supérieur"],
  ["10", "Fer supérieur"],
  ["100", "Or supérieur"],
  ["1000", "Diamant supérieur"],
];

let state = load();

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function atLeast(value, min, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return parsed;
}

function exampleState() {
  return {
    version: 1,
    economy: {
      wageCopperPerHour: 100,
      searchWageCopperPerHour: 100,
      hoursByDifficulty: [1, 4, 12, 30, 80],
      presenceImpactPercent: 100,
      activeIncomeCopperPerHour: 64,
      priceRoundStep: 1,
      bundleMinCopper: 1,
      bundleMaxHours: 8,
      defaultAmortizationHours: 24,
      defaultMarginPercent: 30,
    },
    items: [
      { id: "ble", name: "Blé", priceCopper: 1 },
      { id: "poudre-os", name: "Poudre d'os", priceCopper: 8 },
      { id: "vitre", name: "Vitre", priceCopper: 1 },
      { id: "lit", name: "Lit", priceCopper: 24 },
      { id: "entonnoir", name: "Entonnoir", priceCopper: 96 },
      { id: "coffre", name: "Coffre", priceCopper: 16 },
      { id: "lave", name: "Seau de lave", priceCopper: 32 },
      { id: "lingot-fer", name: "Lingot de fer", priceCopper: 16 },
    ],
    farms: [
      {
        id: "ferme-ble",
        name: "Champ de blé",
        outputName: "Blé",
        outputPerHour: 400,
        stackSize: 64,
        baseBundle: "64",
        packDiscountPercent: 10,
        source: "farm",
        findEveryHours: 12,
        findWorkHours: 4,
        findYield: 1,
        presence: "afk",
        salePriceCopper: null,
        difficulty: 1,
        amortizationHours: 24,
        marginPercent: 30,
        inputs: [],
        materials: [
          { id: "m1", itemId: "coffre", quantity: 4 },
          { id: "m2", itemId: "entonnoir", quantity: 4 },
        ],
        flatCost: { copper: 0, iron: 0, gold: 0, diamond: 0 },
      },
      {
        id: "ferme-ble-os",
        name: "Champ de blé à la poudre d'os",
        outputName: "Blé",
        outputPerHour: 1000,
        stackSize: 64,
        baseBundle: "64",
        packDiscountPercent: 10,
        source: "farm",
        findEveryHours: 12,
        findWorkHours: 4,
        findYield: 1,
        presence: "present",
        salePriceCopper: null,
        difficulty: 3,
        amortizationHours: 24,
        marginPercent: 30,
        inputs: [{ id: "i1", itemId: "poudre-os", quantityPerHour: 40 }],
        materials: [
          { id: "m3", itemId: "entonnoir", quantity: 8 },
          { id: "m4", itemId: "coffre", quantity: 4 },
        ],
        flatCost: { copper: 0, iron: 0, gold: 0, diamond: 0 },
      },
      {
        id: "ferme-fer",
        name: "Ferme à fer",
        outputName: "Lingot de fer",
        outputPerHour: 120,
        stackSize: 64,
        baseBundle: "64",
        packDiscountPercent: 10,
        source: "farm",
        findEveryHours: 12,
        findWorkHours: 4,
        findYield: 1,
        presence: "afk",
        salePriceCopper: null,
        difficulty: 4,
        amortizationHours: 24,
        marginPercent: 30,
        inputs: [],
        materials: [
          { id: "m5", itemId: "vitre", quantity: 300 },
          { id: "m6", itemId: "lit", quantity: 20 },
          { id: "m7", itemId: "entonnoir", quantity: 10 },
          { id: "m8", itemId: "lave", quantity: 4 },
          { id: "m9", itemId: "coffre", quantity: 6 },
        ],
        flatCost: { copper: 0, iron: 0, gold: 0, diamond: 0 },
      },
    ],
    ui: { tab: "farms", selectedFarmId: "ferme-ble" },
  };
}

function migratedFind(farm, legacyYields) {
  const hasNew = farm.findEveryHours != null || farm.findWorkHours != null || farm.findYield != null;
  if (hasNew) {
    return {
      findEveryHours: Math.max(0, num(farm.findEveryHours, 12)),
      findWorkHours: Math.max(0, num(farm.findWorkHours, 4)),
      findYield: Math.max(0, num(farm.findYield, 1)),
    };
  }
  if (farm.findPace === "interval") {
    return {
      findEveryHours: Math.max(0, num(farm.findHours, 12)),
      findWorkHours: 0,
      findYield: Math.max(0, num(farm.findAmount, 1)),
    };
  }
  if (farm.findPace === "hour") {
    return {
      findEveryHours: 1,
      findWorkHours: 0,
      findYield: Math.max(0, num(farm.findAmount, 1)),
    };
  }
  if (farm.source === "find") {
    const level = Math.min(5, Math.max(1, Math.round(num(farm.rarity, 3))));
    return {
      findEveryHours: 1,
      findWorkHours: 0,
      findYield: Math.max(0, num(legacyYields[level - 1], 1)),
    };
  }
  return { findEveryHours: 12, findWorkHours: 4, findYield: 1 };
}

function sanitizeLines(lines, qtyKey) {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((line) => line && line.id)
    .map((line) => ({
      id: String(line.id),
      itemId: String(line.itemId ?? ""),
      [qtyKey]: Math.max(0, num(line[qtyKey], 0)),
    }));
}

function sanitize(raw) {
  if (!raw || raw.version !== 1) throw new Error("version");
  const fallback = exampleState();
  const hours = Array.isArray(raw.economy?.hoursByDifficulty) && raw.economy.hoursByDifficulty.length === 5
    ? raw.economy.hoursByDifficulty.map((value) => Math.max(0, num(value, 0)))
    : fallback.economy.hoursByDifficulty.slice();
  const items = Array.isArray(raw.items)
    ? raw.items
        .filter((item) => item && item.id && typeof item.name === "string")
        .map((item) => ({
          id: String(item.id),
          name: item.name,
          priceCopper: Math.round(Math.max(0, num(item.priceCopper, 0)) * 10000) / 10000,
        }))
    : [];
  const legacyYields = Array.isArray(raw.economy?.yieldByRarity) && raw.economy.yieldByRarity.length === 5
    ? raw.economy.yieldByRarity
    : [240, 60, 20, 6, 1];
  const farms = Array.isArray(raw.farms)
    ? raw.farms.filter((farm) => farm && farm.id).map((farm) => ({
        id: String(farm.id),
        name: String(farm.name ?? ""),
        outputName: String(farm.outputName ?? ""),
        outputPerHour: Math.max(0, num(farm.outputPerHour, 0)),
        stackSize: [1, 16, 64].includes(Number(farm.stackSize)) ? Number(farm.stackSize) : 64,
        baseBundle: ["1", "16", "32", "64", "3s", "9s", "shulker"].includes(farm.baseBundle) ? farm.baseBundle : "64",
        packDiscountPercent: Math.min(90, Math.max(0, num(farm.packDiscountPercent, 10))),
        source: farm.source === "find" ? "find" : "farm",
        ...migratedFind(farm, legacyYields),
        presence: ["afk", "active", "present"].includes(farm.presence)
          ? farm.presence
          : farm.afk === false
            ? "present"
            : "afk",
        salePriceCopper:
          farm.salePriceCopper == null || farm.salePriceCopper === ""
            ? null
            : Math.round(Math.max(0, num(farm.salePriceCopper, 0)) * 10000) / 10000,
        difficulty: Math.min(5, Math.max(1, Math.round(num(farm.difficulty, 1)))),
        amortizationHours: Math.max(0, num(farm.amortizationHours, 24)),
        marginPercent: num(farm.marginPercent, 30),
        inputs: sanitizeLines(farm.inputs, "quantityPerHour"),
        materials: sanitizeLines(farm.materials, "quantity"),
        flatCost: {
          copper: P.roundUp(Math.max(0, num(farm.flatCost?.copper, 0)), 1),
          iron: P.roundUp(Math.max(0, num(farm.flatCost?.iron, 0)), 1),
          gold: P.roundUp(Math.max(0, num(farm.flatCost?.gold, 0)), 1),
          diamond: P.roundUp(Math.max(0, num(farm.flatCost?.diamond, 0)), 1),
        },
      }))
    : [];
  const selected = farms.some((farm) => farm.id === raw.ui?.selectedFarmId) ? raw.ui.selectedFarmId : farms[0]?.id ?? null;
  const tab = ["farms", "items", "rules"].includes(raw.ui?.tab) ? raw.ui.tab : "farms";
  return {
    version: 1,
    economy: {
      wageCopperPerHour: P.roundUp(Math.max(0, num(raw.economy?.wageCopperPerHour, 100)), 1),
      searchWageCopperPerHour: P.roundUp(Math.max(0, num(raw.economy?.searchWageCopperPerHour, 100)), 1),
      hoursByDifficulty: hours,
      presenceImpactPercent: Math.min(100, Math.max(0, num(raw.economy?.presenceImpactPercent, 100))),
      activeIncomeCopperPerHour: P.roundUp(Math.max(0, num(raw.economy?.activeIncomeCopperPerHour, 64)), 1),
      priceRoundStep: [1, 10, 100, 1000].includes(Number(raw.economy?.priceRoundStep))
        ? Number(raw.economy.priceRoundStep)
        : 1,
      bundleMinCopper: P.roundUp(Math.max(0, num(raw.economy?.bundleMinCopper, 1)), 1),
      bundleMaxHours: Math.max(1, num(raw.economy?.bundleMaxHours, 8)),
      defaultAmortizationHours: Math.max(0, num(raw.economy?.defaultAmortizationHours, 24)),
      defaultMarginPercent: num(raw.economy?.defaultMarginPercent, 30),
    },
    items,
    farms,
    ui: { tab, selectedFarmId: selected },
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw) return exampleState();
    return sanitize(raw);
  } catch {
    return exampleState();
  }
}

function save() {
  const note = document.getElementById("storage-note");
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (note) note.textContent = "Les données restent dans ce navigateur. Tu peux les exporter depuis Monnaie et règles.";
  } catch {
    if (note) note.textContent = "Ce navigateur bloque l'enregistrement local. Exporte le fichier JSON pour garder tes fermes.";
  }
}

function selectedFarm() {
  return state.farms.find((farm) => farm.id === state.ui.selectedFarmId) || null;
}

function blankFarm() {
  return {
    id: uid(),
    name: "Nouvelle ferme",
    outputName: "",
    outputPerHour: 64,
    stackSize: 64,
    baseBundle: "64",
    packDiscountPercent: 10,
    source: "farm",
    findEveryHours: 12,
    findWorkHours: 4,
    findYield: 1,
    presence: "afk",
    salePriceCopper: null,
    difficulty: 2,
    amortizationHours: state.economy.defaultAmortizationHours,
    marginPercent: state.economy.defaultMarginPercent,
    inputs: [],
    materials: [],
    flatCost: { copper: 0, iron: 0, gold: 0, diamond: 0 },
  };
}

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = String(value);
      else if (key === "value" || key === "disabled" || key === "htmlFor") node[key] = value;
      else node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function mount(node, ...children) {
  node.replaceChildren(...children.flat().filter((child) => child != null && child !== false));
}

function field(label, control) {
  const labelNode = typeof label === "string" ? el("span", { class: "field-label", text: label }) : label;
  return el("label", { class: "field" }, labelNode, control);
}

function coinMark(key) {
  const src = COIN_SRC[key];
  if (!src) return null;
  return el("img", { class: "coin-icon", src, alt: "" });
}

function coinFieldLabel(key, text) {
  return el("span", { class: "field-label with-icon" }, coinMark(key), text);
}

function textInput(fieldName, value, extra = {}) {
  return el("input", {
    ...extra,
    autocomplete: "off",
    "data-field": fieldName,
    value: value ?? "",
  });
}

function numInput(fieldName, value, extra = {}) {
  const { allowEmpty, ...attrs } = extra;
  return el("input", {
    ...attrs,
    class: "num",
    inputmode: "decimal",
    autocomplete: "off",
    "data-field": fieldName,
    value: allowEmpty && (value == null || value === "") ? "" : String(value ?? 0),
  });
}

function itemSelect(fieldName, selectedId) {
  const select = el("select", { "data-field": fieldName });
  const placeholder = el("option", { value: "", text: "Choisir un objet" });
  select.append(placeholder);
  for (const item of state.items) {
    const option = el("option", { value: item.id, text: item.name || "Sans nom" });
    if (item.id === selectedId) option.selected = true;
    select.append(option);
  }
  if (!selectedId) placeholder.selected = true;
  return select;
}

function choiceSelect(fieldName, value, choices) {
  const select = el("select", { "data-field": fieldName });
  for (const [choice, label] of choices) {
    const option = el("option", { value: choice, text: label });
    if (choice === value) option.selected = true;
    select.append(option);
  }
  return select;
}

function formatInputNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 10000) / 10000);
}

function applyField(input) {
  const [scope, a, b] = input.dataset.field.split(":");
  const farm = selectedFarm();
  if (scope === "farm" && farm) {
    if (a === "name" || a === "outputName" || a === "baseBundle") farm[a] = input.value;
    else if (a === "stackSize") farm[a] = Number(input.value);
    else if (a === "packDiscountPercent") farm[a] = Math.min(90, Math.max(0, P.parseAmount(input.value)));
    else if (a === "salePriceCopper") {
      const raw = input.value.trim();
      farm.salePriceCopper = raw === "" ? null : Math.round(Math.max(0, P.parseAmount(raw)) * 10000) / 10000;
    }     else if (a === "marginPercent") farm[a] = P.parseAmount(input.value);
    else farm[a] = Math.max(0, P.parseAmount(input.value));
  } else if (scope === "input" && farm) {
    const line = farm.inputs.find((entry) => entry.id === a);
    if (!line) return;
    if (b === "itemId") line.itemId = input.value;
    else line.quantityPerHour = Math.max(0, P.parseAmount(input.value));
  } else if (scope === "material" && farm) {
    const line = farm.materials.find((entry) => entry.id === a);
    if (!line) return;
    if (b === "itemId") line.itemId = input.value;
    else line.quantity = Math.max(0, P.parseAmount(input.value));
  } else if (scope === "flat" && farm) {
    farm.flatCost[a] = P.roundUp(Math.max(0, P.parseAmount(input.value)), 1);
  } else if (scope === "item") {
    const item = state.items.find((entry) => entry.id === a);
    if (!item) return;
    if (b === "name") item.name = input.value;
    else item.priceCopper = Math.round(Math.max(0, P.parseAmount(input.value)) * 10000) / 10000;
  } else if (scope === "economy" && a === "hours") {
    state.economy.hoursByDifficulty[Number(b)] = Math.max(0, P.parseAmount(input.value));
  } else if (scope === "economy" && a === "presenceImpactPercent") {
    state.economy.presenceImpactPercent = Math.min(100, Math.max(0, P.parseAmount(input.value)));
  } else if (scope === "economy" && a === "bundleMaxHours") {
    const next = P.parseAmount(input.value);
    if (next > 0) state.economy.bundleMaxHours = next;
  } else if (scope === "economy") {
    const wholeCoin = ["wageCopperPerHour", "searchWageCopperPerHour", "activeIncomeCopperPerHour", "bundleMinCopper"].includes(a);
    const parsed = a === "defaultMarginPercent" ? P.parseAmount(input.value) : Math.max(0, P.parseAmount(input.value));
    state.economy[a] = wholeCoin ? P.roundUp(parsed, 1) : parsed;
  }
}

function readNumericField(input) {
  const [scope, a, b] = input.dataset.field.split(":");
  const farm = selectedFarm();
  if (scope === "farm" && farm && !["name", "outputName", "baseBundle"].includes(a)) return farm[a];
  if (scope === "input" && farm) return farm.inputs.find((entry) => entry.id === a)?.[b];
  if (scope === "material" && farm) return farm.materials.find((entry) => entry.id === a)?.[b];
  if (scope === "flat" && farm) return farm.flatCost[a];
  if (scope === "item" && b === "priceCopper") return state.items.find((entry) => entry.id === a)?.priceCopper;
  if (scope === "economy" && a === "hours") return state.economy.hoursByDifficulty[Number(b)];
  if (scope === "economy") return state.economy[a];
  return null;
}

function unitText(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return "prix ?";
  return `${P.formatAmount(item.priceCopper)} c`;
}

function metaText(farm) {
  const name = farm.outputName.trim() || "Objet à nommer";
  if (farm.source === "find") return `${name} · ${paceLabel(farm)}`;
  return `${name} · ${P.formatAmount(farm.outputPerHour)} / h`;
}

function paceLabel(farm) {
  const every = P.formatAmount(farm.findEveryHours);
  const work = P.formatAmount(farm.findWorkHours);
  const count = P.formatAmount(farm.findYield);
  const noun = Number(farm.findYield) === 1 ? "objet" : "objets";
  return `1 toutes les ${every} h · ${count} ${noun} en ${work} h`;
}

function difficultyCaption(farm) {
  const diff = P.DIFFICULTIES[farm.difficulty - 1];
  const hours = state.economy.hoursByDifficulty[farm.difficulty - 1];
  const labor = hours * state.economy.wageCopperPerHour;
  return `${diff.label} · ${P.formatAmount(hours)} h · ${P.coinPhrase(labor)} de travail · ${diff.hint}`;
}

function paceCaption(farm) {
  const rate = P.outputRate(farm);
  const searchPay = P.coinPhrase(state.economy.searchWageCopperPerHour);
  const workPay = P.coinPhrase(state.economy.activeIncomeCopperPerHour);
  return `${paceLabel(farm)}, soit ${P.formatAmount(rate)} objets par heure. La recherche est payée ${searchPay} de l'heure, le travail ${workPay} de l'heure.`;
}

function presenceCaption(farm) {
  if (farm.presence === "active") {
    return `Tu joues ailleurs, par exemple au minage. Chaque heure de production ajoute ${P.coinPhrase(state.economy.activeIncomeCopperPerHour)}.`;
  }
  if (farm.presence === "present") {
    const perHour = state.economy.wageCopperPerHour * (state.economy.presenceImpactPercent / 100);
    return `Tu restes devant la ferme. Chaque heure ajoute ${P.coinPhrase(perHour)}.`;
  }
  return "La ferme tourne sans toi. Ton temps n'entre pas dans le prix.";
}

function roundTarget(step) {
  if (step === 10) return "fer";
  if (step === 100) return "or";
  if (step === 1000) return "diamant";
  return "cuivre";
}

function coinText(amount) {
  const value = Number(amount) || 0;
  if (value <= 1e-9) return "0 cuivre";
  return P.coinPhrase(value);
}

function saleHint(result) {
  const priced = P.coinPhrase(result.suggested);
  if (result.priceOverridden) return `Prix d'objet écrit ici. Le calcul donne ${priced}. Les lots restent des prix entiers.`;
  if (result.roundStep > 1) return `Le prix d'un objet reste décimal. Les lots montent à la pièce de ${roundTarget(result.roundStep)} supérieure.`;
  return "Le prix d'un objet peut être décimal. Chaque lot monte au cuivre entier.";
}

function chips(copper, values) {
  const parts = P.splitCoins(copper, values);
  const nodes = ["diamond", "gold", "iron", "copper"]
    .filter((key) => parts[key])
    .map((key) => el("span", { class: `chip ${key}` }, coinMark(key), `${P.formatAmount(parts[key])} ${P.coinName(parts[key], key)}`));
  return nodes.length ? nodes : [el("span", { class: "chip copper", text: "0 cuivre" })];
}

function percents(parts) {
  const total = parts.reduce((sum, part) => sum + part, 0);
  if (total <= 0) return parts.map(() => 0);
  const raw = parts.map((part) => (part / total) * 100);
  const floored = raw.map((part) => Math.floor(part));
  let left = 100 - floored.reduce((sum, part) => sum + part, 0);
  const order = raw
    .map((part, index) => ({ index, frac: part - floored[index] }))
    .sort((a, b) => b.frac - a.frac);
  for (const entry of order) {
    if (left <= 0) break;
    floored[entry.index] += 1;
    left -= 1;
  }
  return floored;
}

function costStory(result) {
  const perItem = result.perItem;
  if (perItem.cost <= 0) return "Le coût unitaire est nul avec ces réglages.";
  const parts = [
    { text: (pct) => `Les intrants pèsent ${pct} % du coût.`, value: perItem.input },
    { text: (pct) => (result.source === "find" ? `L'équipement pèse ${pct} % du coût.` : `La construction pèse ${pct} % du coût.`), value: perItem.construction },
    { text: (pct) => (result.source === "find" ? `Le travail une fois trouvé pèse ${pct} % du coût.` : `Le travail pèse ${pct} % du coût.`), value: perItem.labor },
    { text: (pct) => (result.presence === "active" ? `L'activité pèse ${pct} % du coût.` : `La présence pèse ${pct} % du coût.`), value: perItem.presence || 0 },
    { text: (pct) => `La recherche pèse ${pct} % du coût.`, value: perItem.search || 0 },
  ];
  const shares = percents(parts.map((part) => part.value));
  let best = 0;
  parts.forEach((part, index) => {
    if (part.value > parts[best].value) best = index;
  });
  return parts[best].text(shares[best]);
}

function moneyRow(label, amount, hint, total) {
  return el(
    "div",
    { class: total ? "money-row total" : "money-row" },
    el("div", {}, el("strong", { text: label }), hint ? el("span", { class: "hint", text: hint }) : null),
    el("div", { class: "money-num", text: coinText(amount) }),
  );
}

function updateRateLine() {
  const node = document.getElementById("rate-line");
  if (!node) return;
  const bit = (key, count) => el("span", { class: "rate-bit" }, coinMark(key), count);
  node.replaceChildren(
    bit("copper", "10"),
    " = ",
    bit("iron", "1"),
    " · ",
    bit("iron", "10"),
    " = ",
    bit("gold", "1"),
    " · ",
    bit("gold", "10"),
    " = ",
    bit("diamond", "1 diamant"),
  );
}

function updateRulePreview() {
  const preview = document.getElementById("rule-preview");
  if (!preview) return;
  const hours = state.economy.hoursByDifficulty[3];
  const labor = hours * state.economy.wageCopperPerHour;
  const active = state.economy.activeIncomeCopperPerHour;
  const presence = state.economy.wageCopperPerHour * (state.economy.presenceImpactPercent / 100);
  preview.textContent = `Une ferme difficile, c'est ${P.formatAmount(hours)} h de construction, soit ${P.coinPhrase(labor)}. Une heure de minage ajoute ${P.coinPhrase(active)}. Devant la ferme, une heure ajoute ${P.coinPhrase(presence)}.`;
}

function updateEditorPrices() {
  document.querySelectorAll("[data-price-for]").forEach((node) => {
    node.textContent = unitText(node.dataset.priceFor);
  });
}

function updateLiveHints() {
  const farm = selectedFarm();
  if (!farm) return;
  const result = P.evaluate(farm, state);
  const caption = document.getElementById("diff-caption");
  if (caption) caption.textContent = difficultyCaption(farm);
  const pace = document.getElementById("pace-caption");
  if (pace && farm.source === "find") pace.textContent = paceCaption(farm);
  const inputTotal = document.getElementById("input-total");
  if (inputTotal) inputTotal.textContent = `${coinText(result.inputCostPerHour)} d'intrants par heure.`;
  const buildTotal = document.getElementById("build-total");
    if (buildTotal) {
      const label = farm.source === "find" ? "Équipement" : "Construction";
      buildTotal.textContent = farm.source === "find"
        ? `${label} : ${P.coinPhrase(result.construction)}.`
        : `${label} : ${P.coinPhrase(result.construction)}. Travail : ${P.coinPhrase(result.labor)}.`;
    }
  updateEditorPrices();
}

function updateListPrices() {
  for (const farm of state.farms) {
    const name = document.querySelector(`[data-list-name="${farm.id}"]`);
    const meta = document.querySelector(`[data-list-meta="${farm.id}"]`);
    const price = document.querySelector(`[data-list-price="${farm.id}"]`);
    if (name) name.textContent = farm.name.trim() || "Sans nom";
    if (meta) meta.textContent = metaText(farm);
    if (!price) continue;
    const result = P.evaluate(farm, state);
    price.textContent = result.ok ? `${P.formatAmount(result.perHourPrice)} c / h` : "—";
  }
}

function updateCatalogCoins() {
  document.querySelectorAll("[data-catalog-coin]").forEach((node) => {
    const item = state.items.find((entry) => entry.id === node.dataset.catalogCoin);
    node.textContent = item ? P.coinPhrase(item.priceCopper) : "";
  });
}

function refreshDerived() {
  updateRateLine();
  updateRulePreview();
  if (state.ui.tab === "farms") {
    updateLiveHints();
    updateListPrices();
    buildResult();
  } else if (state.ui.tab === "items") {
    updateCatalogCoins();
  }
}

function lineRow(line, kind, qtyKey) {
  return el(
    "div",
    { class: "line" },
    itemSelect(`${kind}:${line.id}:itemId`, line.itemId),
    numInput(`${kind}:${line.id}:${qtyKey}`, line[qtyKey], { "aria-label": "Quantité" }),
    el("button", {
      type: "button",
      class: "unit-price",
      title: "Modifier ce prix",
      "aria-label": "Modifier le prix de cet objet",
      "data-action": "edit-item",
      "data-id": line.itemId,
      "data-price-for": line.itemId,
      text: unitText(line.itemId),
    }),
    el("button", {
      type: "button",
      class: "icon-btn",
      "data-action": kind === "input" ? "remove-input" : "remove-material",
      "data-id": line.id,
      "aria-label": "Retirer la ligne",
      text: "×",
    }),
  );
}

function lineSection(title, lines, kind, addAction, emptyText, totalId) {
  const qtyKey = kind === "input" ? "quantityPerHour" : "quantity";
  return el(
    "section",
    { class: "block" },
    el(
      "div",
      { class: "block-head" },
      el("h3", { text: title }),
      el("button", { type: "button", class: "btn small", "data-action": addAction, text: "Ajouter" }),
    ),
    lines.length
      ? el("div", { class: "lines" }, lines.map((line) => lineRow(line, kind, qtyKey)))
      : el("p", { class: "hint", text: emptyText }),
    totalId ? el("p", { id: totalId, class: "hint" }) : null,
  );
}

function buildFarmButtons() {
  const slot = document.getElementById("farm-list");
  if (!state.farms.length) {
    slot.replaceChildren(el("p", { class: "hint", text: "Aucune ferme pour l'instant." }));
    return;
  }
  slot.replaceChildren(
    ...state.farms.map((farm) => {
      const result = P.evaluate(farm, state);
      return el(
        "button",
        {
          type: "button",
          class: farm.id === state.ui.selectedFarmId ? "farm-btn is-on" : "farm-btn",
          "data-action": "select-farm",
          "data-id": farm.id,
        },
        el("span", { class: "farm-name", "data-list-name": farm.id, text: farm.name.trim() || "Sans nom" }),
        el("span", { class: "farm-meta", "data-list-meta": farm.id, text: metaText(farm) }),
        el("span", {
          class: "farm-price",
          "data-list-price": farm.id,
          text: result.ok ? `${P.formatAmount(result.perHourPrice)} c / h` : "—",
        }),
      );
    }),
  );
}

function buildEditor() {
  const slot = document.getElementById("editor");
  const farm = selectedFarm();
  if (!farm) {
    slot.replaceChildren(
      el(
        "div",
        { class: "empty-card" },
        el("h2", { text: "Aucune ferme" }),
        el("p", { class: "hint", text: "Ajoute une ferme, ou recharge les exemples." }),
        el(
          "div",
          { class: "row-actions" },
          el("button", { type: "button", class: "btn primary", "data-action": "add-farm", text: "Ajouter une ferme" }),
          el("button", { type: "button", class: "btn", "data-action": "reset", text: "Recharger les exemples" }),
        ),
      ),
    );
    return;
  }

  mount(
    slot,
    el(
      "div",
      { class: "editor-head" },
      textInput("farm:name", farm.name, { class: "title-input", "aria-label": "Nom de la ferme", placeholder: "Nom de la ferme" }),
      el(
        "div",
        { class: "row-actions" },
        el("button", { type: "button", class: "btn small", "data-action": "duplicate-farm", text: "Dupliquer" }),
        el("button", { type: "button", class: "btn small danger", "data-action": "delete-farm", text: "Supprimer" }),
      ),
    ),
    el(
      "div",
      { class: "block" },
      el("span", { class: "field-label", text: "Origine" }),
      el(
        "div",
        { class: "pills", role: "radiogroup", "aria-label": "Origine de l'objet" },
        [
          ["farm", "Ferme"],
          ["find", "À trouver"],
        ].map(([mode, label]) =>
          el("button", {
            type: "button",
            class: farm.source === mode ? "pill is-on" : "pill",
            role: "radio",
            "aria-checked": farm.source === mode ? "true" : "false",
            "data-action": "source",
            "data-source": mode,
            text: label,
          }),
        ),
      ),
      el("p", {
        class: "hint",
        text: farm.source === "find"
          ? "Une trouvaille, par exemple une géode, arrive toutes les X heures. Le travail dessus rend les objets vendus."
          : "Tu indiques combien la ferme produit par heure.",
      }),
    ),
    el(
      "div",
      { class: "grid-2" },
      field("Objet produit", textInput("farm:outputName", farm.outputName, { placeholder: "Blé, lingot, poudre…" })),
      farm.source === "find"
        ? null
        : field("Production par heure", numInput("farm:outputPerHour", farm.outputPerHour)),
      field("Amortissement (heures de marche)", numInput("farm:amortizationHours", farm.amortizationHours)),
      field("Marge minimale (%)", numInput("farm:marginPercent", farm.marginPercent)),
      field("Taille de stack", choiceSelect("farm:stackSize", String(farm.stackSize), [["64", "64"], ["16", "16"], ["1", "1"]])),
    ),
    el("p", {
      class: "hint",
      text: farm.source === "find"
        ? "Les heures pour trouver sont payées au salaire de recherche. Les heures de travail, une fois la trouvaille faite, sont payées au rapport du minage. L'amortissement étale le prix de l'équipement."
        : "1 objet par minute = 60 par heure. L'amortissement étale la construction et le travail sur la durée de marche.",
    }),
    farm.source === "find"
      ? el(
          "div",
          { class: "block" },
          el("span", { class: "field-label", text: "Trouvaille" }),
          el(
            "div",
            { class: "grid-2" },
            field("Une trouvaille toutes les (heures)", numInput("farm:findEveryHours", farm.findEveryHours)),
            field("Heures de travail par trouvaille", numInput("farm:findWorkHours", farm.findWorkHours)),
            field("Objets récupérés", numInput("farm:findYield", farm.findYield)),
          ),
          el("p", { id: "pace-caption", class: "hint", text: paceCaption(farm) }),
        )
      : null,
    farm.source === "find"
      ? null
      : el(
      "div",
      { class: "block" },
      el("span", { class: "field-label", text: "Difficulté de création" }),
      el(
        "div",
        { class: "diffs", role: "radiogroup", "aria-label": "Difficulté de création" },
        P.DIFFICULTIES.map((entry) =>
          el("button", {
            type: "button",
            class: entry.level === farm.difficulty ? "diff is-on" : "diff",
            role: "radio",
            "aria-checked": entry.level === farm.difficulty ? "true" : "false",
            "data-action": "difficulty",
            "data-level": String(entry.level),
            text: String(entry.level),
          }),
        ),
      ),
      el("p", { id: "diff-caption", class: "hint", text: difficultyCaption(farm) }),
    ),
    farm.source === "find"
      ? null
      : el(
      "div",
      { class: "block" },
      el("span", { class: "field-label", text: "Pendant que la ferme tourne" }),
      el(
        "div",
        { class: "pills", role: "radiogroup", "aria-label": "Présence pendant la production" },
        ["afk", "active", "present"].map((mode) =>
          el("button", {
            type: "button",
            class: farm.presence === mode ? "pill is-on" : "pill",
            role: "radio",
            "aria-checked": farm.presence === mode ? "true" : "false",
            "data-action": "presence",
            "data-presence": mode,
            text: mode === "afk" ? "Je suis AFK" : mode === "active" ? "Je suis actif" : "Je reste devant",
          }),
        ),
      ),
      el("p", { id: "presence-caption", class: "hint", text: presenceCaption(farm) }),
    ),
    farm.source === "find"
      ? null
      : lineSection("Intrants consommés par heure", farm.inputs, "input", "add-input", "Aucun intrant.", "input-total"),
    farm.source === "find"
      ? null
      : lineSection("Matériaux pour construire la ferme", farm.materials, "material", "add-material", "Aucun matériau chiffré."),
    el(
      "section",
      { class: "block" },
      el("h3", { text: farm.source === "find" ? "Prix de l'équipement" : "Coût déjà payé en pièces" }),
      el("p", {
        class: "hint",
        text: farm.source === "find"
          ? "Pioche, armure, fusées : un prix en pièces, étalé sur l'amortissement."
          : "Un montant en pièces, en plus des matériaux listés au-dessus.",
      }),
      el(
        "div",
        { class: "coins" },
        field(coinFieldLabel("copper", "Cuivre"), numInput("flat:copper", farm.flatCost.copper)),
        field(coinFieldLabel("iron", "Fer"), numInput("flat:iron", farm.flatCost.iron)),
        field(coinFieldLabel("gold", "Or"), numInput("flat:gold", farm.flatCost.gold)),
        field(coinFieldLabel("diamond", "Diamant"), numInput("flat:diamond", farm.flatCost.diamond)),
      ),
      el("p", { id: "build-total", class: "hint" }),
    ),
  );
  updateLiveHints();
}

function buildResult() {
  const slot = document.getElementById("result");
  if (!slot) return;
  const focused = document.activeElement;
  const focusField = focused?.dataset?.field || "";
  const caret = typeof focused?.selectionStart === "number" ? focused.selectionStart : null;
  const farm = selectedFarm();
  if (!farm) {
    slot.replaceChildren(el("p", { class: "hint", text: "Ajoute une ferme pour calculer un prix." }));
    return;
  }
  const result = P.evaluate(farm, state);
  if (!result.ok) {
    mount(
      slot,
      el("p", { class: "kicker", text: "Prix de vente" }),
      el("p", { text: result.message }),
      result.warnings.length ? warningBlock(result.warnings) : null,
    );
    return;
  }

  const finding = farm.source === "find";
  const perItem = result.perItem;
  const shares = [
    perItem.input,
    perItem.construction,
    finding ? perItem.search || 0 : perItem.labor,
    finding ? perItem.labor || 0 : perItem.presence || 0,
  ];
  const totalShare = shares.reduce((sum, part) => sum + part, 0);
  const widths = shares.map((part) => (totalShare > 0 ? (part / totalShare) * 100 : 0));
  const [inputPct, buildPct, laborPct, presencePct] = percents(shares);
  const output = farm.outputName.trim() || "objet";

  mount(
    slot,
    el("p", { class: "kicker", text: "Prix d'une heure" }),
    el(
      "p",
      { class: "hero-price" },
      el("span", { class: "hero-num", id: "floor-price", text: P.formatAmount(result.perHourPrice) }),
      el("span", { class: "hero-unit", text: " cuivre" }),
    ),
    el("div", { class: "chips" }, chips(result.perHourPrice, result.values)),
    el("p", { class: "hero-sub", text: `pour une heure de ${output} · ${P.coinPhrase(result.sale)} l'objet` }),
    el(
      "div",
      { class: "price-tools" },
      field("Arrondir", choiceSelect("economy:priceRoundStep", String(state.economy.priceRoundStep), ROUND_OPTIONS)),
      field(
        "Changer le prix",
        numInput("farm:salePriceCopper", farm.salePriceCopper, { allowEmpty: true, placeholder: "Calculé" }),
      ),
    ),
    el("p", { class: "hint", id: "sale-hint", text: saleHint(result) }),
    el("p", { class: "hint", id: "cost-story", text: costStory(result) }),
    el(
      "div",
      { class: "bar", "aria-hidden": "true" },
      el("span", { class: "in", style: `width:${widths[0]}%` }),
      el("span", { class: "build", style: `width:${widths[1]}%` }),
      el("span", { class: "work", style: `width:${widths[2]}%` }),
      el("span", { class: "presence", style: `width:${widths[3]}%` }),
    ),
    el(
      "div",
      { class: "legend" },
      finding ? null : el("span", { class: "in", text: `Intrants ${inputPct} %` }),
      el("span", { class: "build", text: finding ? `Équipement ${buildPct} %` : `Construction ${buildPct} %` }),
      finding
        ? el("span", { class: "work", text: `Recherche ${laborPct} %` })
        : el("span", { class: "work", text: `Travail ${laborPct} %` }),
      finding
        ? el("span", { class: "presence", text: `Travail ${presencePct} %` })
        : presencePct > 0
          ? el("span", { class: "presence", text: `${result.presence === "active" ? "Activité" : "Présence"} ${presencePct} %` })
          : null,
    ),
    el(
      "div",
      { class: "money" },
      finding ? null : moneyRow("Intrants", perItem.input, `${coinText(result.inputCostPerHour)} par heure`),
      moneyRow(
        finding ? "Équipement" : "Construction",
        perItem.construction,
        `${coinText(result.construction)} sur ${P.formatAmount(result.amort)} h`,
      ),
      finding
        ? moneyRow(
            "Recherche",
            perItem.search,
            `${P.formatAmount(farm.findEveryHours)} h pour en trouver une, au salaire de recherche`,
          )
        : moneyRow("Travail", perItem.labor, `${P.formatAmount(result.laborHours)} h, difficulté ${farm.difficulty}`),
      finding
        ? moneyRow(
            "Travail",
            perItem.labor,
            `${P.formatAmount(farm.findWorkHours)} h une fois trouvée, au rapport du minage`,
          )
        : moneyRow(
        result.presence === "active" ? "Activité par heure" : "Présence par heure",
        result.presencePerHour,
        result.presence === "afk"
          ? "AFK : l'heure de marche n'ajoute rien"
          : result.presence === "active"
            ? "ajoutés pour chaque heure où tu mines à côté"
            : "ajoutés pour chaque heure passée devant la ferme",
      ),
      moneyRow("Coût de revient", perItem.cost),
      moneyRow("Prix plancher", perItem.floor, `marge ${P.formatAmount(result.margin)} %`),
      moneyRow("Prix de vente", result.sale, null, true),
    ),
    el(
      "div",
      { class: "stats" },
      el(
        "div",
        { class: "stat" },
        el("span", { text: "Recette horaire" }),
        el("strong", { text: P.coinPhrase(result.perHourRevenue) }),
      ),
    ),
    bundleBlock(result),
    result.catalogPrice != null
      ? el("p", {
          class: "compare",
          text: `Prix d'intrant enregistré pour « ${output} » : ${P.coinPhrase(result.catalogPrice)}.`,
        })
      : null,
    result.priceOverridden
      ? el("button", {
          type: "button",
          class: "btn block",
          "data-action": "clear-sale",
          text: "Reprendre le prix calculé",
        })
      : null,
    el("button", {
      type: "button",
      class: "btn primary block",
      "data-action": "save-floor",
      disabled: !farm.outputName.trim(),
      text: "Enregistrer le prix de vente comme prix d'intrant",
    }),
    result.warnings.length ? warningBlock(result.warnings) : null,
  );
  if (focusField === "farm:salePriceCopper" || focusField === "economy:priceRoundStep" || focusField === "farm:packDiscountPercent" || focusField === "farm:baseBundle") {
    const next = slot.querySelector(`[data-field="${focusField}"]`);
    if (next) {
      next.focus();
      if (caret != null && next.setSelectionRange) {
        const pos = Math.min(caret, next.value.length);
        next.setSelectionRange(pos, pos);
      }
    }
  }
}

function bundleBlock(result) {
  const farm = selectedFarm();
  return el(
    "div",
    { class: "bundles" },
    el("p", { class: "field-label", text: "Prix selon la quantité" }),
    el(
      "div",
      { class: "price-tools" },
      field("Format de base", choiceSelect("farm:baseBundle", result.baseId || farm?.baseBundle || "64", P.bundleChoices(farm?.stackSize || 64))),
      field("Remise par palier plus gros (%)", numInput("farm:packDiscountPercent", farm?.packDiscountPercent ?? 0)),
    ),
    el("p", {
      class: "hint",
      text: "Le format de base est au prix calculé. Chaque format plus gros retire ce pourcentage du prix unitaire. Les formats plus petits restent au prix plein.",
    }),
    result.bundleNote ? el("p", { class: "hint", text: result.bundleNote }) : null,
    result.bundles.map((bundle) => {
      const tags = [];
      if (bundle.base) tags.push("base");
      if (bundle.recommended) tags.push("conseillé");
      const title = tags.length ? `${bundle.label} · ${tags.join(" · ")}` : bundle.label;
      return el(
        "div",
        { class: `bundle${bundle.base ? " is-base" : ""}${bundle.recommended ? " is-recommended" : ""}` },
        el(
          "div",
          {},
          el("strong", { text: title }),
          el("span", {
            class: "hint",
            text: bundle.discount > 0 ? `${bundle.duration} · −${P.formatAmount(bundle.discount)} %` : bundle.duration,
          }),
        ),
        el("div", { class: "money-num", text: P.coinPhrase(bundle.price) }),
      );
    }),
  );
}

function warningBlock(warnings) {
  return el("div", { class: "warn" }, warnings.map((warning) => el("p", { text: warning })));
}

function buildFarmsView() {
  const view = document.getElementById("view-farms");
  view.replaceChildren(
    el(
      "aside",
      { class: "list" },
      el(
        "div",
        { class: "list-head" },
        el("h2", { text: "Tes fermes" }),
        el("button", { type: "button", class: "btn small primary", "data-action": "add-farm", text: "Ajouter" }),
      ),
      el("div", { id: "farm-list" }),
    ),
    el("section", { id: "editor", class: "editor" }),
    el("aside", { id: "result", class: "result" }),
  );
  buildFarmButtons();
  buildEditor();
  buildResult();
}

function buildItemsView() {
  const view = document.getElementById("view-items");
  view.replaceChildren(
    el(
      "section",
      { class: "panel" },
      el(
        "div",
        { class: "block-head" },
        el(
          "div",
          {},
          el("h2", { text: "Prix des objets" }),
          el("p", { class: "hint", text: "Le prix payé quand l'objet sert d'intrant ou de matériau. Les décimales comptent. L'unité est le cuivre." }),
        ),
        el("button", { type: "button", class: "btn primary", "data-action": "add-item", text: "Ajouter un objet" }),
      ),
      state.items.length
        ? el("div", { class: "catalog" }, state.items.map((item) => catalogRow(item)))
        : el("p", { class: "hint", text: "Le catalogue est vide." }),
    ),
  );
  if (state.ui.focusItemId) {
    const input = document.querySelector(`[data-field="item:${state.ui.focusItemId}:priceCopper"]`);
    input?.focus();
    input?.select();
    state.ui.focusItemId = null;
  }
}

function catalogRow(item) {
  return el(
    "div",
    { class: "catalog-row" },
    textInput(`item:${item.id}:name`, item.name, { "aria-label": "Nom de l'objet" }),
    numInput(`item:${item.id}:priceCopper`, item.priceCopper, { "aria-label": "Prix en cuivre" }),
    el("span", { class: "catalog-coin hint", "data-catalog-coin": item.id, text: P.coinPhrase(item.priceCopper) }),
    el("button", {
      type: "button",
      class: "icon-btn",
      "data-action": "remove-item",
      "data-id": item.id,
      "aria-label": `Supprimer ${item.name}`,
      text: "×",
    }),
  );
}

function buildRulesView() {
  const economy = state.economy;
  document.getElementById("view-rules").replaceChildren(
    el(
      "div",
      { class: "rules" },
      el(
        "section",
        { class: "panel" },
        el("h2", { text: "Pièces" }),
        el("p", { text: "10 PC donnent 1 PF. 10 PF donnent 1 PO. 10 PO donnent 1 PD." }),
        el("p", { class: "hint", text: "PC cuivre, PF fer, PO or, PD diamant. Ce taux est fixe. Le cuivre reste l'unité des calculs. Une pièce n'est pas le lingot du jeu." }),
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { text: "Difficulté et travail" }),
        el("p", { class: "hint", text: "100 cuivre font 1 PO. Le salaire horaire paie la construction des fermes et la présence. Le salaire de recherche paie les heures passées à trouver. Le rapport du minage paie les heures de travail une fois la trouvaille faite." }),
        field("Salaire horaire (cuivre)", numInput("economy:wageCopperPerHour", economy.wageCopperPerHour)),
        field("Salaire de recherche (cuivre / h)", numInput("economy:searchWageCopperPerHour", economy.searchWageCopperPerHour)),
        field("Rapport d'une heure active, minage (cuivre)", numInput("economy:activeIncomeCopperPerHour", economy.activeIncomeCopperPerHour)),
        field("Impact si tu restes devant la ferme (%)", numInput("economy:presenceImpactPercent", economy.presenceImpactPercent)),
        el("p", { class: "hint", text: "L'arrondi des lots se règle dans le panneau de droite. Le prix d'un objet peut rester décimal." }),
        field("Prix minimum d'un lot (cuivre)", numInput("economy:bundleMinCopper", economy.bundleMinCopper)),
        field("Temps maximum pour remplir un lot (heures)", numInput("economy:bundleMaxHours", economy.bundleMaxHours)),
        el(
          "div",
          { class: "hours" },
          P.DIFFICULTIES.map((diff, index) =>
            field(`${diff.level}. ${diff.label}`, numInput(`economy:hours:${index}`, economy.hoursByDifficulty[index])),
          ),
        ),
        el("p", { id: "rule-preview", class: "hint" }),
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { text: "Nouvelles fermes" }),
        el("p", { class: "hint", text: "Ces deux valeurs servent quand tu ajoutes une ferme." }),
        el(
          "div",
          { class: "grid-2" },
          field("Amortissement par défaut (heures)", numInput("economy:defaultAmortizationHours", economy.defaultAmortizationHours)),
          field("Marge par défaut (%)", numInput("economy:defaultMarginPercent", economy.defaultMarginPercent)),
        ),
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { text: "Calcul" }),
        el("ul", { class: "formula" }, FORMULA.map((line) => el("li", { text: line }))),
      ),
      el(
        "section",
        { class: "panel" },
        el("h2", { text: "Sauvegarde" }),
        el("p", { class: "hint", text: "Un fichier JSON suffit pour retrouver tes fermes dans un autre navigateur." }),
        el(
          "div",
          { class: "row-actions" },
          el("button", { type: "button", class: "btn", "data-action": "export", text: "Exporter" }),
          el("button", { type: "button", class: "btn", "data-action": "import", text: "Importer" }),
          el("button", { type: "button", class: "btn danger", "data-action": "reset", text: "Recharger les exemples" }),
        ),
        el("input", { id: "import-file", type: "file", accept: "application/json,.json", hidden: true }),
      ),
    ),
  );
  updateRulePreview();
}

function showTab(tab, options = {}) {
  const view = document.getElementById(`view-${tab}`);
  const already = state.ui.tab === tab && view && view.childElementCount > 0;
  state.ui.tab = tab;
  for (const name of ["farms", "items", "rules"]) {
    document.getElementById(`view-${name}`).hidden = name !== tab;
    document.querySelector(`.tab[data-tab="${name}"]`).setAttribute("aria-selected", name === tab ? "true" : "false");
  }
  if (already && !options.rebuild) {
    save();
    updateRateLine();
    return;
  }
  if (tab === "farms") buildFarmsView();
  if (tab === "items") buildItemsView();
  if (tab === "rules") buildRulesView();
  updateRateLine();
  save();
}

function addFarm() {
  const farm = blankFarm();
  state.farms.unshift(farm);
  state.ui.selectedFarmId = farm.id;
  save();
  buildFarmButtons();
  buildEditor();
  buildResult();
  document.querySelector("[data-field='farm:name']")?.focus();
  document.querySelector("[data-field='farm:name']")?.select();
}

function selectFarm(id) {
  if (!state.farms.some((farm) => farm.id === id)) return;
  state.ui.selectedFarmId = id;
  save();
  buildFarmButtons();
  buildEditor();
  buildResult();
}

function duplicateFarm() {
  const farm = selectedFarm();
  if (!farm) return;
  const copy = structuredClone(farm);
  copy.id = uid();
  copy.name = farm.name.trim() ? `${farm.name} (copie)` : "Copie";
  for (const line of [...copy.inputs, ...copy.materials]) line.id = uid();
  state.farms.unshift(copy);
  state.ui.selectedFarmId = copy.id;
  save();
  buildFarmButtons();
  buildEditor();
  buildResult();
}

function deleteFarm() {
  const farm = selectedFarm();
  if (!farm) return;
  const name = farm.name.trim() || "cette ferme";
  if (!window.confirm(`Supprimer « ${name} » ?`)) return;
  state.farms = state.farms.filter((entry) => entry.id !== farm.id);
  state.ui.selectedFarmId = state.farms[0]?.id ?? null;
  save();
  buildFarmButtons();
  buildEditor();
  buildResult();
}

function addLine(kind) {
  const farm = selectedFarm();
  if (!farm) return;
  const id = uid();
  const itemId = state.items[0]?.id ?? "";
  if (kind === "input") farm.inputs.push({ id, itemId, quantityPerHour: 1 });
  else farm.materials.push({ id, itemId, quantity: 1 });
  save();
  buildEditor();
  buildResult();
  document.querySelector(`[data-field="${kind}:${id}:${kind === "input" ? "quantityPerHour" : "quantity"}"]`)?.focus();
}

function removeLine(kind, id) {
  const farm = selectedFarm();
  if (!farm) return;
  const key = kind === "input" ? "inputs" : "materials";
  farm[key] = farm[key].filter((line) => line.id !== id);
  save();
  buildEditor();
  buildResult();
}

function itemUsers(id) {
  return state.farms
    .filter((farm) => farm.inputs.some((line) => line.itemId === id) || farm.materials.some((line) => line.itemId === id))
    .map((farm) => farm.name.trim() || "Sans nom");
}

function addItem() {
  const id = uid();
  state.items.push({ id, name: "Nouvel objet", priceCopper: 0 });
  state.ui.focusItemId = id;
  save();
  buildItemsView();
}

function removeItem(id) {
  const users = itemUsers(id);
  if (users.length) {
    window.alert(`Cet objet est utilisé par : ${users.join(", ")}. Retire-le de ces fermes d'abord.`);
    return;
  }
  state.items = state.items.filter((item) => item.id !== id);
  save();
  buildItemsView();
}

function editItem(id) {
  if (!id || !state.items.some((item) => item.id === id)) return;
  state.ui.focusItemId = id;
  showTab("items", { rebuild: true });
}

function saveFloor() {
  const farm = selectedFarm();
  if (!farm) return;
  const name = farm.outputName.trim();
  if (!name) return;
  const result = P.evaluate(farm, state);
  if (!result.ok) return;
  const key = name.toLocaleLowerCase("fr");
  let item = state.items.find((entry) => entry.name.trim().toLocaleLowerCase("fr") === key);
  const price = Math.round(result.sale * 10000) / 10000;
  if (!item) {
    item = { id: uid(), name, priceCopper: price };
    state.items.push(item);
  } else {
    item.priceCopper = price;
  }
  save();
  buildResult();
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "prix-fermes.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function importState(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = sanitize(JSON.parse(String(reader.result)));
      save();
      showTab(state.ui.tab || "farms", { rebuild: true });
    } catch {
      window.alert("Ce fichier ne contient pas une sauvegarde lisible.");
    }
  };
  reader.readAsText(file);
}

function resetExamples() {
  if (state.farms.length || state.items.length) {
    if (!window.confirm("Remplacer tes fermes, tes objets et tes règles par les exemples ?")) return;
  }
  state = exampleState();
  save();
  showTab("farms", { rebuild: true });
}

function setSource(source) {
  const farm = selectedFarm();
  if (!farm || !["farm", "find"].includes(source)) return;
  farm.source = source;
  save();
  buildFarmButtons();
  buildEditor();
  refreshDerived();
}

function setPresence(mode) {
  const farm = selectedFarm();
  if (!farm || !["afk", "active", "present"].includes(mode)) return;
  farm.presence = mode;
  document.querySelectorAll("[data-action='presence']").forEach((button) => {
    const on = button.dataset.presence === mode;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-checked", on ? "true" : "false");
  });
  const caption = document.getElementById("presence-caption");
  if (caption) caption.textContent = presenceCaption(farm);
  save();
  refreshDerived();
}

function clearSale() {
  const farm = selectedFarm();
  if (!farm) return;
  farm.salePriceCopper = null;
  save();
  buildEditor();
  refreshDerived();
}

function setDifficulty(level) {
  const farm = selectedFarm();
  if (!farm) return;
  farm.difficulty = level;
  document.querySelectorAll("[data-action='difficulty']").forEach((button) => {
    const on = Number(button.dataset.level) === level;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-checked", on ? "true" : "false");
  });
  save();
  refreshDerived();
}

function onInput(event) {
  const input = event.target.closest("[data-field]");
  if (!input) return;
  applyField(input);
  if (input.dataset.field.endsWith(":itemId")) {
    const price = input.closest(".line")?.querySelector("[data-price-for]");
    if (price) {
      price.dataset.priceFor = input.value;
      price.dataset.id = input.value;
    }
  }
  save();
  refreshDerived();
}

function onBlur(event) {
  const input = event.target.closest("input.num[data-field]");
  if (!input) return;
  applyField(input);
  if (input.dataset.field === "farm:salePriceCopper" && input.value.trim() === "") {
    input.value = "";
    save();
    refreshDerived();
    return;
  }
  const next = readNumericField(input);
  if (next != null) input.value = formatInputNumber(next);
  save();
  refreshDerived();
}

function onClick(event) {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === "tab") showTab(actionEl.dataset.tab);
  else if (action === "add-farm") addFarm();
  else if (action === "select-farm") selectFarm(actionEl.dataset.id);
  else if (action === "duplicate-farm") duplicateFarm();
  else if (action === "delete-farm") deleteFarm();
  else if (action === "difficulty") setDifficulty(Number(actionEl.dataset.level));
  else if (action === "presence") setPresence(actionEl.dataset.presence);
  else if (action === "source") setSource(actionEl.dataset.source);
  else if (action === "clear-sale") clearSale();
  else if (action === "add-input") addLine("input");
  else if (action === "remove-input") removeLine("input", actionEl.dataset.id);
  else if (action === "add-material") addLine("material");
  else if (action === "remove-material") removeLine("material", actionEl.dataset.id);
  else if (action === "edit-item") editItem(actionEl.dataset.id);
  else if (action === "save-floor") saveFloor();
  else if (action === "add-item") addItem();
  else if (action === "remove-item") removeItem(actionEl.dataset.id);
  else if (action === "export") exportState();
  else if (action === "import") document.getElementById("import-file")?.click();
  else if (action === "reset") resetExamples();
}

function onFile(event) {
  if (event.target.id !== "import-file" || !event.target.files?.[0]) return;
  importState(event.target.files[0]);
  event.target.value = "";
}

if (!P) {
  document.getElementById("storage-note").textContent = "Le calcul n'a pas pu se charger.";
} else {
  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("focusout", onBlur);
  document.addEventListener("change", onFile);
  showTab(state.ui.tab || "farms", { rebuild: true });
}

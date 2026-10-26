(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FarmPricing = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DIFFICULTIES = [
    { level: 1, label: "Très simple", hint: "Quelques blocs, récolte manuelle" },
    { level: 2, label: "Simple", hint: "Petit automatique, peu de redstone" },
    { level: 3, label: "Moyenne", hint: "Villageois, eau ou redstone à régler" },
    { level: 4, label: "Difficile", hint: "Grosse installation, plusieurs étapes" },
    { level: 5, label: "Très difficile", hint: "Ferme technique, longue à construire" },
  ];

  function outputRate(farm) {
    if (farm && farm.source === "find") {
      const every = Math.max(0, Number(farm.findEveryHours) || 0);
      const work = Math.max(0, Number(farm.findWorkHours) || 0);
      const count = Math.max(0, Number(farm.findYield) || 0);
      const cycle = every + work;
      if (cycle <= 0 || count <= 0) return 0;
      return count / cycle;
    }
    return Math.max(0, Number(farm?.outputPerHour) || 0);
  }

  function presenceMode(farm) {
    if (farm.presence === "afk" || farm.presence === "active" || farm.presence === "present") return farm.presence;
    return farm.afk === false ? "present" : "afk";
  }

  function roundStepOf(value) {
    const step = Number(value);
    return [1, 10, 100, 1000].includes(step) ? step : 1;
  }

  function roundUp(amount, step) {
    const value = Math.max(0, Number(amount) || 0);
    const size = Number(step) || 0;
    if (size <= 0 || value === 0) return value;
    const units = value / size;
    const nearest = Math.round(units);
    if (Math.abs(units - nearest) < 1e-8) return nearest * size;
    return Math.ceil(units) * size;
  }

  const COIN_NAMES = {
    diamond: ["diamant", "diamants"],
    gold: ["or", "or"],
    iron: ["fer", "fer"],
    copper: ["cuivre", "cuivre"],
  };

  function parseAmount(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const text = String(value).trim().replace(/\s/g, "").replace(",", ".");
    if (!text) return 0;
    const number = Number(text);
    return Number.isFinite(number) ? number : 0;
  }

  function formatAmount(value) {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value);
    let digits = 2;
    if (abs === 0) digits = 0;
    else if (abs < 0.01) digits = 4;
    else if (abs < 1) digits = 3;
    else if (abs >= 100) digits = 1;
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(value);
  }

  // 10 PC = 1 PF, 10 PF = 1 PO, 10 PO = 1 PD. Taux fixe.
  function coinValues() {
    return {
      copper: 1,
      iron: 10,
      gold: 100,
      diamond: 1000,
      copperPerIron: 10,
      ironPerGold: 10,
      goldPerDiamond: 10,
    };
  }

  function splitCoins(copperAmount, values) {
    let remaining = Math.round(Math.abs(Number(copperAmount) || 0) * 10000) / 10000;
    const out = { diamond: 0, gold: 0, iron: 0, copper: 0 };
    out.diamond = Math.floor(remaining / values.diamond);
    remaining = Math.round((remaining - out.diamond * values.diamond) * 10000) / 10000;
    out.gold = Math.floor(remaining / values.gold);
    remaining = Math.round((remaining - out.gold * values.gold) * 10000) / 10000;
    out.iron = Math.floor(remaining / values.iron);
    remaining = Math.round((remaining - out.iron * values.iron) * 10000) / 10000;
    out.copper = remaining;
    return out;
  }

  function coinName(amount, key) {
    const names = COIN_NAMES[key];
    return Math.abs(amount) > 1 ? names[1] : names[0];
  }

  function coinLabel(parts) {
    const bits = [];
    for (const key of ["diamond", "gold", "iron", "copper"]) {
      if (!parts[key]) continue;
      bits.push(`${formatAmount(parts[key])} ${coinName(parts[key], key)}`);
    }
    if (!bits.length) return "0 cuivre";
    if (bits.length === 1) return bits[0];
    return `${bits.slice(0, -1).join(", ")} et ${bits.at(-1)}`;
  }

  function coinPhrase(copper) {
    return coinLabel(splitCoins(copper, coinValues()));
  }

  function durationLabel(hours) {
    if (!Number.isFinite(hours)) return "";
    if (hours < 1 / 60) return "en moins d'une minute";
    if (hours < 1) {
      const minutes = Math.max(1, Math.round(hours * 60));
      return minutes === 1 ? "en 1 min" : `en ${minutes} min`;
    }
    return `en ${formatAmount(hours)} h`;
  }

  function bundleCatalog(stackSize) {
    const stack = [1, 16, 64].includes(stackSize) ? stackSize : 64;
    const rows = [
      { id: "1", label: "1 objet", count: 1 },
      { id: "16", label: "16 objets", count: 16 },
      { id: "32", label: "32 objets", count: 32 },
      { id: "64", label: "64 objets", count: 64 },
      { id: "3s", label: `3 stacks · ${formatAmount(3 * stack)}`, count: 3 * stack },
      { id: "9s", label: `9 stacks · ${formatAmount(9 * stack)}`, count: 9 * stack },
      { id: "shulker", label: `1 shulker · ${formatAmount(27 * stack)}`, count: 27 * stack },
    ];
    const seen = new Set();
    return rows.filter((row) => {
      if (row.count <= 0 || seen.has(row.count)) return false;
      seen.add(row.count);
      return true;
    });
  }

  function bundleChoices(stackSize) {
    return bundleCatalog(stackSize).map((row) => [row.id, row.label]);
  }

  function proposeBundles(floor, perHour, stackSize, options = {}) {
    const minCopper = Number.isFinite(Number(options.minCopper)) && Number(options.minCopper) >= 0
      ? Number(options.minCopper)
      : 1;
    const maxHours = Number.isFinite(Number(options.maxHours)) && Number(options.maxHours) > 0
      ? Number(options.maxHours)
      : 8;
    const tiers = bundleCatalog(stackSize);
    const baseId = tiers.some((row) => row.id === options.baseId)
      ? options.baseId
      : (tiers.find((row) => row.id === "64")?.id || tiers[0].id);
    const rawCut = Number(options.discountPercent);
    const discountPercent = Number.isFinite(rawCut) ? Math.min(90, Math.max(0, rawCut)) : 0;
    const rawBox = Number(options.shulkerCopper);
    const shulkerCopper = Number.isFinite(rawBox) ? Math.max(0, rawBox) : 0;
    const baseIndex = tiers.findIndex((row) => row.id === baseId);
    const catalog = tiers.map((row) => {
      const step = [1, 10, 100, 1000].includes(Number(options.roundStep)) ? Number(options.roundStep) : 1;
      const steps = Math.max(0, tiers.findIndex((tier) => tier.id === row.id) - baseIndex);
      const discount = Math.min(90, steps * discountPercent);
      const box = row.id === "shulker" ? shulkerCopper : 0;
      const exact = floor * row.count * (1 - discount / 100) + box;
      const price = roundUp(Math.max(0, exact), step);
      const hours = perHour > 0 ? row.count / perHour : Infinity;
      return {
        ...row,
        price,
        hours,
        duration: durationLabel(hours),
        discount,
        box,
        base: row.id === baseId,
        readable: price + 1e-9 >= minCopper,
        feasible: hours <= maxHours + 1e-9,
      };
    });

    let shown = catalog.filter((row) => row.readable && row.feasible);
    let bundleNote = "";
    if (!shown.length) {
      const readable = catalog.filter((row) => row.readable);
      const feasible = catalog.filter((row) => row.feasible);
      if (readable.length) {
        shown = [readable[0]];
        bundleNote = "Remplir un plus gros lot dépasse le temps maximum.";
      } else if (feasible.length) {
        shown = [feasible[feasible.length - 1]];
        bundleNote = "Même la plus grosse quantité reste sous le prix minimum d'un lot.";
      } else {
        shown = [catalog[0]];
      }
    }

    const recommended = shown.reduce((best, row) => {
      const bestDistance = Math.abs(best.hours - 1);
      const distance = Math.abs(row.hours - 1);
      if (distance < bestDistance - 1e-9) return row;
      if (Math.abs(distance - bestDistance) <= 1e-9 && row.count > best.count) return row;
      return best;
    });

    return {
      bundleNote,
      minCopper,
      maxHours,
      baseId,
      discountPercent,
      shulkerCopper,
      bundles: shown.map((row) => ({
        id: row.id,
        label: row.label,
        count: row.count,
        price: row.price,
        hours: row.hours,
        duration: row.duration,
        discount: row.discount,
        box: row.box,
        base: row.base,
        recommended: row.id === recommended.id,
      })),
    };
  }

  function evaluate(farm, state) {
    const values = coinValues(state.currency || {});
    const warnings = [];
    const items = state.items || [];
    const hoursList = state.economy?.hoursByDifficulty || [0, 0, 0, 0, 0];

    const finding = farm.source === "find";
    let inputCostPerHour = 0;
    if (!finding) {
      for (const line of farm.inputs || []) {
        const found = items.find((item) => item.id === line.itemId);
        const qty = Number(line.quantityPerHour) || 0;
        if (!found) {
          if (line.itemId) warnings.push("Un intrant ne correspond à aucun objet du catalogue.");
          continue;
        }
        const price = Number(found.priceCopper) || 0;
        if (price === 0 && qty > 0) warnings.push(`Le prix de « ${found.name} » est à 0 cuivre.`);
        inputCostPerHour += price * qty;
      }
    }

    let materialCost = 0;
    if (!finding) {
      for (const line of farm.materials || []) {
        const found = items.find((item) => item.id === line.itemId);
        const qty = Number(line.quantity) || 0;
        if (!found) {
          if (line.itemId) warnings.push("Un matériau ne correspond à aucun objet du catalogue.");
          continue;
        }
        const price = Number(found.priceCopper) || 0;
        if (price === 0 && qty > 0) warnings.push(`Le prix de « ${found.name} » est à 0 cuivre.`);
        materialCost += price * qty;
      }
    }

    const flat = farm.flatCost || {};
    const flatCost =
      (Number(flat.copper) || 0) * values.copper +
      (Number(flat.iron) || 0) * values.iron +
      (Number(flat.gold) || 0) * values.gold +
      (Number(flat.diamond) || 0) * values.diamond;
    const construction = materialCost + flatCost;

    const level = Math.min(5, Math.max(1, Math.round(Number(farm.difficulty) || 1)));
    const wage = Number(state.economy?.wageCopperPerHour) || 0;
    const economySearch = Number(state.economy?.searchWageCopperPerHour);
    const searchWage = Math.max(0, Number.isFinite(economySearch) ? economySearch : wage);
    const findEvery = Math.max(0, Number(farm.findEveryHours) || 0);
    const findWork = Math.max(0, Number(farm.findWorkHours) || 0);
    const findYield = Math.max(0, Number(farm.findYield) || 0);
    const findCycle = findEvery + findWork;
    const laborHours = finding ? 0 : Number(hoursList[level - 1]) || 0;
    const labor = laborHours * wage;
    const perHour = outputRate(farm);
    const amort = Number(farm.amortizationHours) || 0;
    const margin = Number(farm.marginPercent) || 0;
    const presence = presenceMode(farm);
    const rawImpact = Number(state.economy?.presenceImpactPercent);
    const presenceImpact = Number.isFinite(rawImpact) ? Math.min(100, Math.max(0, rawImpact)) : 100;
    const rawActive = Number(state.economy?.activeIncomeCopperPerHour);
    const activeIncome = Number.isFinite(rawActive) ? Math.max(0, rawActive) : wage;
    const presencePerHour = finding
      ? 0
      : presence === "present"
        ? wage * (presenceImpact / 100)
        : presence === "active"
          ? activeIncome
          : 0;
    const searchPerItem = finding && findYield > 0 ? (findEvery * searchWage) / findYield : 0;
    const findWorkPerItem = finding && findYield > 0 ? (findWork * activeIncome) / findYield : 0;

    const base = {
      warnings: [...new Set(warnings)],
      values,
      inputCostPerHour,
      materialCost,
      flatCost,
      construction,
      labor,
      laborHours,
      difficulty: level,
      amort,
      margin,
      afk: presence === "afk",
      presence,
      presencePerHour,
      presenceImpact,
      activeIncome,
      outputPerHour: perHour,
      source: finding ? "find" : "farm",
      searchWage,
      findEvery,
      findWork,
      findYield,
    };

    if (perHour <= 0) {
      return {
        ...base,
        ok: false,
        message: farm.source === "find"
          ? "Indique un intervalle de trouvaille et des objets récupérés."
          : "Indique une production supérieure à zéro.",
      };
    }

    if (amort <= 0 && (construction > 0 || labor > 0)) {
      base.warnings = [
        ...base.warnings,
        finding
          ? "L'amortissement est à zéro : l'équipement reste hors du prix unitaire."
          : "L'amortissement est à zéro : la construction et le travail restent hors du prix unitaire.",
      ];
    }

    const horizon = perHour * amort;
    const input = inputCostPerHour / perHour;
    const constructionPer = amort > 0 ? construction / horizon : 0;
    const laborPer = finding ? findWorkPerItem : amort > 0 ? labor / horizon : 0;
    const presencePerItem = presencePerHour / perHour;
    const cost = input + constructionPer + laborPer + presencePerItem + searchPerItem;
    const floor = cost * (1 + margin / 100);
    const roundStep = roundStepOf(state.economy?.priceRoundStep);
    const priceOverridden = farm.salePriceCopper != null && farm.salePriceCopper !== "";
    const sale = priceOverridden ? Math.max(0, Number(farm.salePriceCopper) || 0) : floor;
    const suggested = floor;
    const rawPack = Number(farm.packDiscountPercent);
    const packDiscount = Number.isFinite(rawPack) ? Math.min(90, Math.max(0, rawPack)) : 0;
    const offer = proposeBundles(sale, perHour, Number(farm.stackSize) || 64, {
      minCopper: state.economy?.bundleMinCopper,
      maxHours: state.economy?.bundleMaxHours,
      roundStep,
      baseId: farm.baseBundle,
      discountPercent: packDiscount,
      shulkerCopper: state.economy?.shulkerCopper,
    });
    const perHourPrice = sale * perHour;
    const outputKey = String(farm.outputName || "").trim().toLocaleLowerCase("fr");
    const catalogItem = outputKey
      ? items.find((item) => item.name.trim().toLocaleLowerCase("fr") === outputKey)
      : null;

    return {
      ...base,
      ok: true,
      horizon,
      perItem: { input, construction: constructionPer, labor: laborPer, presence: presencePerItem, search: searchPerItem, cost, floor },
      roundStep,
      suggested,
      sale,
      priceOverridden,
      perHourPrice,
      perHourRevenue: sale * perHour,
      stackSize: Number(farm.stackSize) || 1,
      perStack: sale * (Number(farm.stackSize) || 1),
      bundles: offer.bundles,
      bundleNote: offer.bundleNote,
      baseId: offer.baseId,
      shulkerCopper: offer.shulkerCopper,
      catalogPrice: catalogItem ? Number(catalogItem.priceCopper) || 0 : null,
      catalogItemId: catalogItem ? catalogItem.id : null,
    };
  }

  return {
    DIFFICULTIES,
    outputRate,
    parseAmount,
    formatAmount,
    coinValues,
    splitCoins,
    coinName,
    coinLabel,
    coinPhrase,
    proposeBundles,
    bundleChoices,
    roundUp,
    evaluate,
  };
});

if (typeof module !== "undefined" && require.main === module) {
  const assert = require("node:assert");
  const api = module.exports;
  const values = api.coinValues();

  assert.strictEqual(values.iron, 10);
  assert.strictEqual(values.gold, 100);
  assert.strictEqual(values.diamond, 1000);
  assert.deepStrictEqual(api.splitCoins(20, values), { diamond: 0, gold: 0, iron: 2, copper: 0 });
  assert.deepStrictEqual(api.splitCoins(1000, values), { diamond: 1, gold: 0, iron: 0, copper: 0 });
  assert.strictEqual(api.splitCoins(0.4, values).copper, 0.4);
  assert.deepStrictEqual(api.splitCoins(20.2, values), { diamond: 0, gold: 0, iron: 2, copper: 0.2 });
  assert.strictEqual(api.coinPhrase(0.5), "0,5 cuivre");
  assert.strictEqual(api.coinLabel(api.splitCoins(2000, values)), `${api.formatAmount(2)} diamants`);
  assert.strictEqual(api.coinLabel(api.splitCoins(200, values)), `${api.formatAmount(2)} or`);
  assert.strictEqual(
    api.coinLabel(api.splitCoins(1111, values)),
    `${api.formatAmount(1)} diamant, ${api.formatAmount(1)} or, ${api.formatAmount(1)} fer et ${api.formatAmount(1)} cuivre`,
  );
  assert.strictEqual(api.parseAmount("1 234,5"), 1234.5);
  assert.strictEqual(api.parseAmount(""), 0);
  assert.strictEqual(api.parseAmount("abc"), 0);

  const state = {
    currency: { copperPerIron: 16, ironPerGold: 16, goldPerDiamond: 16 },
    economy: { wageCopperPerHour: 64, hoursByDifficulty: [1, 4, 12, 30, 80] },
    items: [
      { id: "v", name: "Vitre", priceCopper: 1 },
      { id: "h", name: "Entonnoir", priceCopper: 80 },
      { id: "zero", name: "Gratuit", priceCopper: 0 },
    ],
  };
  const farm = {
    outputName: "Lingot",
    outputPerHour: 120,
    difficulty: 4,
    amortizationHours: 24,
    marginPercent: 30,
    stackSize: 64,
    inputs: [{ itemId: "zero", quantityPerHour: 2 }],
    materials: [
      { itemId: "v", quantity: 300 },
      { itemId: "h", quantity: 10 },
    ],
    flatCost: { copper: 0, iron: 0, gold: 0, diamond: 1 },
  };
  const result = api.evaluate(farm, state);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.construction, 2100);
  assert.strictEqual(result.labor, 1920);
  assert.strictEqual(result.afk, true);
  assert.strictEqual(result.perItem.presence, 0);
  assert.ok(Math.abs(result.perItem.cost - 1.3958333333333333) < 1e-12);
  assert.ok(Math.abs(result.perItem.floor - 1.8145833333333333) < 1e-12);
  assert.ok(result.bundles.some((bundle) => bundle.recommended));
  assert.ok(result.warnings.some((warning) => warning.includes("Gratuit")));

  const stopped = api.evaluate({ ...farm, outputPerHour: 0 }, state);
  assert.strictEqual(stopped.ok, false);

  const noAmort = api.evaluate({ ...farm, amortizationHours: 0, inputs: [] }, state);
  assert.strictEqual(noAmort.perItem.cost, 0);
  assert.strictEqual(noAmort.construction, 2100);

  const present = api.evaluate({ ...farm, afk: false, inputs: [] }, state);
  assert.strictEqual(present.presence, "present");
  assert.ok(Math.abs(present.perItem.presence - 64 / 120) < 1e-12);
  assert.ok(present.perItem.cost > result.perItem.cost);

  const rounded = api.evaluate(farm, { ...state, economy: { ...state.economy, priceRoundStep: 1 } });
  assert.ok(Math.abs(rounded.sale - rounded.perItem.floor) < 1e-12);
  assert.ok(Math.abs(rounded.suggested - rounded.perItem.floor) < 1e-12);
  assert.ok(rounded.bundles.every((bundle) => bundle.price === api.roundUp(rounded.perItem.floor * bundle.count, 1)));
  assert.ok(rounded.bundles.every((bundle) => Number.isInteger(bundle.price)));
  assert.ok(rounded.perHourPrice > rounded.sale);

  const stepped = api.evaluate(farm, { ...state, economy: { ...state.economy, priceRoundStep: 10 } });
  assert.ok(Math.abs(stepped.sale - stepped.perItem.floor) < 1e-12);
  assert.ok(stepped.bundles.every((bundle) => bundle.price % 10 === 0));

  const overridden = api.evaluate({ ...farm, salePriceCopper: 5 }, state);
  assert.strictEqual(overridden.priceOverridden, true);
  assert.strictEqual(overridden.sale, 5);
  assert.ok(overridden.bundles.every((bundle) => bundle.price === bundle.count * 5));
  assert.ok(Math.abs(overridden.perItem.floor - result.perItem.floor) < 1e-12);

  const cheap = {
    outputName: "Blé",
    outputPerHour: 400,
    difficulty: 1,
    amortizationHours: 24,
    marginPercent: 30,
    stackSize: 64,
    presence: "afk",
    inputs: [],
    materials: [],
    flatCost: { copper: 0, iron: 0, gold: 0, diamond: 0 },
  };
  const eco = {
    economy: {
      wageCopperPerHour: 64,
      hoursByDifficulty: [1, 4, 12, 30, 80],
      activeIncomeCopperPerHour: 64,
      presenceImpactPercent: 100,
      priceRoundStep: 1,
    },
    items: [],
  };
  const afkFarm = api.evaluate(cheap, eco);
  const activeFarm = api.evaluate({ ...cheap, presence: "active" }, eco);
  assert.ok(activeFarm.perHourPrice > afkFarm.perHourPrice);
  assert.ok(activeFarm.bundles.find((bundle) => bundle.id === "64").price > afkFarm.bundles.find((bundle) => bundle.id === "64").price);

  const packs = api.proposeBundles(2, 100, 64, {
    roundStep: 1,
    baseId: "64",
    discountPercent: 10,
    minCopper: 1,
    maxHours: 100,
  });
  const basePack = packs.bundles.find((bundle) => bundle.id === "64");
  const biggerPack = packs.bundles.find((bundle) => bundle.id === "3s");
  const smallerPack = packs.bundles.find((bundle) => bundle.id === "16");
  assert.strictEqual(basePack.base, true);
  assert.strictEqual(basePack.discount, 0);
  assert.strictEqual(basePack.price, 128);
  assert.strictEqual(biggerPack.discount, 10);
  assert.ok(biggerPack.price < 2 * biggerPack.count);
  assert.strictEqual(smallerPack.discount, 0);
  assert.strictEqual(smallerPack.price, 32);
  assert.strictEqual(packs.bundles.find((bundle) => bundle.id === "shulker").box, 0);

  const boxed = api.proposeBundles(2, 100, 64, {
    roundStep: 1,
    baseId: "64",
    discountPercent: 10,
    minCopper: 1,
    maxHours: 100,
    shulkerCopper: 20,
  });
  const shulkerPack = boxed.bundles.find((bundle) => bundle.id === "shulker");
  assert.strictEqual(shulkerPack.box, 20);
  assert.strictEqual(shulkerPack.discount, 30);
  assert.strictEqual(shulkerPack.price, 2440);
  assert.ok(boxed.bundles.filter((bundle) => bundle.id !== "shulker").every((bundle) => bundle.box === 0));

  const active = api.evaluate({ ...farm, presence: "active", inputs: [] }, {
    ...state,
    economy: { ...state.economy, activeIncomeCopperPerHour: 120 },
  });
  assert.strictEqual(active.presence, "active");
  assert.ok(Math.abs(active.perItem.presence - 1) < 1e-12);

  const wheatLots = api.proposeBundles(0.06933333333333334, 400, 64);
  assert.strictEqual(wheatLots.bundles.find((bundle) => bundle.id === "1").price, 1);
  assert.strictEqual(wheatLots.bundles.find((bundle) => bundle.recommended).id, "9s");

  const ironLots = api.proposeBundles(1.75, 120, 64);
  assert.ok(ironLots.bundles.some((bundle) => bundle.id === "1"));
  assert.ok(!ironLots.bundles.some((bundle) => bundle.id === "shulker"));
  assert.strictEqual(ironLots.bundles.find((bundle) => bundle.recommended).id, "64");
  assert.ok(noAmort.warnings.some((warning) => warning.includes("amortissement")));

  const fed = api.evaluate({
    outputName: "Pain",
    outputPerHour: 100,
    difficulty: 1,
    amortizationHours: 0,
    marginPercent: 0,
    presence: "afk",
    inputs: [{ itemId: "x", quantityPerHour: 10 }],
    materials: [],
    flatCost: { copper: 0, iron: 0, gold: 0, diamond: 0 },
  }, {
    economy: { wageCopperPerHour: 100, hoursByDifficulty: [0, 0, 0, 0, 0] },
    items: [{ id: "x", name: "Poudre", priceCopper: 0.5 }],
  });
  assert.ok(Math.abs(fed.perItem.input - 0.05) < 1e-12);
  assert.ok(Math.abs(fed.sale - 0.05) < 1e-12);
  assert.strictEqual(fed.bundles.find((bundle) => bundle.id === "1").price, 1);

  const geode = api.evaluate({
    outputName: "Éclat",
    source: "find",
    findEveryHours: 12,
    findWorkHours: 4,
    findYield: 8,
    searchWageCopperPerHour: 999,
    outputPerHour: 500,
    difficulty: 5,
    amortizationHours: 10,
    marginPercent: 0,
    presence: "present",
    inputs: [{ itemId: "poudre", quantityPerHour: 40 }],
    materials: [{ itemId: "pioche", quantity: 1 }],
    flatCost: { copper: 0, iron: 0, gold: 0, diamond: 0 },
  }, {
    economy: {
      wageCopperPerHour: 100,
      hoursByDifficulty: [1, 4, 12, 30, 80],
      searchWageCopperPerHour: 50,
      activeIncomeCopperPerHour: 64,
    },
    items: [
      { id: "poudre", name: "Poudre", priceCopper: 10 },
      { id: "pioche", name: "Pioche", priceCopper: 500 },
    ],
  });
  assert.ok(Math.abs(geode.outputPerHour - 0.5) < 1e-12);
  assert.strictEqual(geode.perItem.presence, 0);
  assert.strictEqual(geode.perItem.input, 0);
  assert.strictEqual(geode.perItem.construction, 0);
  assert.ok(Math.abs(geode.perItem.search - 75) < 1e-9);
  assert.ok(Math.abs(geode.perItem.labor - 32) < 1e-9);
  assert.ok(Math.abs(geode.sale - 107) < 1e-9);

  const gear = api.evaluate({
    outputName: "Éclat",
    source: "find",
    findEveryHours: 12,
    findWorkHours: 4,
    findYield: 8,
    amortizationHours: 8,
    marginPercent: 0,
    presence: "afk",
    inputs: [{ itemId: "poudre", quantityPerHour: 40 }],
    materials: [{ itemId: "pioche", quantity: 1 }],
    flatCost: { copper: 16, iron: 0, gold: 0, diamond: 0 },
  }, {
    economy: { wageCopperPerHour: 100, searchWageCopperPerHour: 0, activeIncomeCopperPerHour: 0, hoursByDifficulty: [1, 4, 12, 30, 80] },
    items: [
      { id: "poudre", name: "Poudre", priceCopper: 10 },
      { id: "pioche", name: "Pioche", priceCopper: 500 },
    ],
  });
  assert.strictEqual(gear.perItem.input, 0);
  assert.ok(Math.abs(gear.perItem.search) < 1e-12);
  assert.ok(Math.abs(gear.perItem.labor) < 1e-12);
  assert.ok(Math.abs(gear.perItem.construction - 4) < 1e-9);
  assert.ok(Math.abs(gear.sale - 4) < 1e-9);

  console.log("pricing ok");
}

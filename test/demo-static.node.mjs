import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const projectRoot = path.resolve(import.meta.dirname, "..");
const demoRoot = path.join(projectRoot, "public", "demo");
const html = readFileSync(path.join(demoRoot, "index.html"), "utf8");
const script = readFileSync(path.join(demoRoot, "app.js"), "utf8");
const styles = readFileSync(path.join(demoRoot, "styles.css"), "utf8");

const expectedStates = {
  control: {
    title: "Know what Codex is doing.",
    frames: [
      ["Working", "/demo/assets/control-tower-active.webp"],
      ["Needs me", "/demo/assets/control-tower-attention.webp"],
      ["Calm", "/demo/assets/control-tower-calm.webp"],
    ],
  },
  exception: {
    title: "Teach it what to watch.",
    frames: [
      ["Attention", "/demo/assets/exception-critical.gif"],
      ["All clear", "/demo/assets/exception-healthy.webp"],
    ],
  },
  glint: {
    title: "A tiny face for progress.",
    frames: [
      ["Working", "/demo/assets/glint-working.gif"],
      ["Ready", "/demo/assets/glint-ready.gif"],
      ["Complete", "/demo/assets/glint-complete.gif"],
    ],
  },
  delivery: {
    title: "See the work land.",
    frames: [
      ["Pull requests", "/demo/assets/landed-prs.png"],
      ["Model use", "/demo/assets/token-use.png"],
    ],
  },
  privacy: {
    title: "The private work stays on my Mac.",
    architecture: true,
  },
};

function loadStateDefinitions() {
  const firstDomQuery = script.indexOf("const image =");
  assert.notEqual(firstDomQuery, -1, "app.js should declare state data before querying the DOM");

  const context = {};
  const stateSource = script
    .slice(0, firstDomQuery)
    .replace("const states =", "globalThis.__demoStates =");
  vm.runInNewContext(stateSource, context, { filename: "public/demo/app.js" });
  return JSON.parse(JSON.stringify(context.__demoStates));
}

class FakeElement {
  constructor({ id = "", state = "" } = {}) {
    this.id = id;
    this.dataset = state ? { state } : {};
    this.attributes = new Map();
    this.children = [];
    this.classNames = new Set();
    this.classList = {
      toggle: (name, force) => {
        if (force ?? !this.classNames.has(name)) this.classNames.add(name);
        else this.classNames.delete(name);
      },
    };
    this.hidden = false;
    this.listeners = new Map();
    this.textContent = "";
    this.type = "";
    this.src = "";
    this.alt = "";
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  append(child) {
    this.children.push(child);
  }

  click() {
    this.listeners.get("click")?.();
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  focus() {}

  scrollIntoView() {}
}

function createDemoHarness() {
  const tabStates = [...html.matchAll(/<button\b[^>]*\bdata-state="([^"]+)"[^>]*>/g)]
    .map((match) => match[1]);
  const tabs = tabStates.map((state, index) => {
    const element = new FakeElement({ id: `state-tab-${state}`, state });
    element.setAttribute("role", "tab");
    element.setAttribute("aria-selected", String(index === 0));
    return element;
  });
  const elements = new Map([
    ["#state-image", new FakeElement({ id: "state-image" })],
    ["#architecture", new FakeElement({ id: "architecture" })],
    ["#pixel-surface", new FakeElement({ id: "pixel-surface" })],
    ["#state-copy", new FakeElement({ id: "state-copy" })],
    ["#variant-controls", new FakeElement({ id: "variant-controls" })],
    ["#display-caption", new FakeElement({ id: "display-caption" })],
  ]);
  const document = {
    addEventListener: () => {},
    createElement: () => new FakeElement(),
    hidden: false,
    querySelector: (selector) => elements.get(selector) ?? null,
    querySelectorAll: (selector) => selector === "[role=tab]" ? tabs : [],
  };
  const motionQuery = { addEventListener: () => {}, matches: false };
  const context = {
    clearInterval: () => {},
    document,
    setInterval: () => 1,
    window: { matchMedia: () => motionQuery },
  };
  vm.runInNewContext(script, context, { filename: "public/demo/app.js" });
  return { elements, tabs };
}

function specificity(selector) {
  return [
    (selector.match(/#[\w-]+/g) ?? []).length,
    (selector.match(/\.[\w-]+|\[[^\]]+\]/g) ?? []).length,
    (selector
      .replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]/g, " ")
      .match(/\b(?:img|div|span)\b/g) ?? []).length,
  ];
}

function compareSpecificity(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

function selectorMatches(selector, element) {
  if (selector.includes(":")) return false;
  const parts = selector.replace(/[>+~]/g, " ").trim().split(/\s+/);
  const target = parts.at(-1);
  const ancestors = parts.slice(0, -1).join(" ");
  if (target.includes("[hidden]") && !element.hidden) return false;
  const targetId = target.match(/#([\w-]+)/)?.[1];
  if (targetId && targetId !== element.id) return false;
  const targetClasses = target.match(/\.([\w-]+)/g)?.map((name) => name.slice(1)) ?? [];
  if (targetClasses.some((className) => !element.classes.includes(className))) return false;
  if (/\bimg\b/.test(target) && element.tagName !== "img") return false;
  const ancestorClasses = ancestors.match(/\.([\w-]+)/g)?.map((name) => name.slice(1)) ?? [];
  if (ancestorClasses.some((className) => !element.ancestorClasses.includes(className))) return false;
  return target.includes("[hidden]") || Boolean(targetId) || targetClasses.length > 0 || /\bimg\b/.test(target);
}

function computedDisplay(element) {
  const candidates = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let rule;
  let order = 0;
  while ((rule = rulePattern.exec(styles)) !== null) {
    const display = rule[2].match(/(?:^|;)\s*display\s*:\s*([^;!]+)\s*(!important)?\s*(?:;|$)/i);
    if (!display) continue;
    for (const selector of rule[1].split(",").map((part) => part.trim())) {
      if (selectorMatches(selector, element)) {
        candidates.push({
          value: display[1].trim(),
          important: Boolean(display[2]),
          specificity: specificity(selector),
          order,
        });
      }
    }
    order += 1;
  }

  candidates.sort((left, right) =>
    Number(left.important) - Number(right.important)
      || compareSpecificity(left.specificity, right.specificity)
      || left.order - right.order,
  );
  return candidates.at(-1)?.value ?? "inline";
}

test("tabs and state definitions retain their intended content mappings", () => {
  const states = loadStateDefinitions();
  const tabStates = [...html.matchAll(/<button\b[^>]*\bdata-state="([^"]+)"[^>]*>/g)]
    .map((match) => match[1]);

  assert.deepEqual(tabStates, Object.keys(expectedStates));
  assert.deepEqual(Object.keys(states), Object.keys(expectedStates));

  for (const [key, expected] of Object.entries(expectedStates)) {
    const state = states[key];
    assert.equal(state.title, expected.title, `${key} should retain its intended title`);
    assert.ok(state.text.length >= 40, `${key} should include meaningful explanatory copy`);
    if (expected.architecture) {
      assert.equal(state.architecture, true);
      assert.equal(state.frames, undefined);
    } else {
      assert.deepEqual(
        state.frames.map(({ label, src }) => [label, src]),
        expected.frames,
        `${key} should retain its intended variant-to-asset mapping`,
      );
      for (const frame of state.frames) {
        assert.ok(frame.alt.length >= 20, `${key}/${frame.label} should have useful alt text`);
      }
    }
  }
});

test("every local file referenced by the static demo exists", () => {
  const references = new Set(
    [html, script, styles]
      .flatMap((source) => [...source.matchAll(/["'(](\/demo\/[^"')\s]+)/g)].map((match) => match[1]))
      .map((reference) => reference.replace(/[?#].*$/, "")),
  );

  assert.ok(references.size >= 12, "the check should cover the page, script, stylesheet, and render assets");
  for (const reference of references) {
    const relativePath = reference.slice("/demo/".length);
    assert.ok(relativePath && !relativePath.includes(".."), `unsafe static reference: ${reference}`);
    assert.ok(existsSync(path.join(demoRoot, relativePath)), `missing static demo file: ${reference}`);
  }
});

test("privacy mode reveals the architecture and hides the prior product image", () => {
  const { elements, tabs } = createDemoHarness();
  const image = elements.get("#state-image");
  const architecture = elements.get("#architecture");
  const copy = elements.get("#state-copy");
  const variants = elements.get("#variant-controls");
  const architectureTag = html.match(/<div\b[^>]*\bid="architecture"[^>]*>/)?.[0];
  const imageTag = html.match(/<img\b[^>]*\bid="state-image"[^>]*>/)?.[0];

  assert.ok(architectureTag, "index.html should contain the architecture visual");
  assert.match(architectureTag, /\bhidden\b/, "the architecture should be hidden before JavaScript initializes");
  assert.ok(imageTag, "index.html should contain the initial product render");
  assert.doesNotMatch(imageTag, /\bhidden\b/, "the initial product render should be visible without JavaScript");

  assert.equal(architecture.hidden, true, "the initial control state should hide the architecture");
  assert.equal(image.hidden, false, "the initial control state should show a product render");

  tabs.find((tab) => tab.dataset.state === "privacy").click();
  assert.equal(architecture.hidden, false, "privacy should reveal the architecture");
  assert.equal(image.hidden, true, "privacy should hide the previous product render");
  assert.equal(copy.children[0].textContent, expectedStates.privacy.title);
  assert.equal(variants.children.length, 0, "privacy should not leave stale frame controls behind");
  assert.equal(tabs.find((tab) => tab.dataset.state === "privacy").getAttribute("aria-selected"), "true");

  assert.notEqual(
    computedDisplay({ id: "architecture", tagName: "div", classes: ["architecture"], ancestorClasses: ["pixel-surface"], hidden: false }),
    "none",
    "privacy must have a visible architecture visual once hidden is removed",
  );
  assert.notEqual(
    computedDisplay({ id: "state-image", tagName: "img", classes: [], ancestorClasses: ["pixel-surface"], hidden: false }),
    "none",
    "product states must have a visible render once hidden is removed",
  );

  assert.equal(
    computedDisplay({ id: "state-image", tagName: "img", classes: [], ancestorClasses: ["pixel-surface"], hidden: true }),
    "none",
    "authored CSS must honor hidden on the product image",
  );
  assert.equal(
    computedDisplay({ id: "architecture", tagName: "div", classes: ["architecture"], ancestorClasses: ["pixel-surface"], hidden: true }),
    "none",
    "authored CSS must honor hidden on the architecture",
  );
});

test("each product tab shows its first mapped render and complete variant set", () => {
  const { elements, tabs } = createDemoHarness();
  const image = elements.get("#state-image");
  const architecture = elements.get("#architecture");
  const copy = elements.get("#state-copy");
  const variants = elements.get("#variant-controls");

  for (const [key, expected] of Object.entries(expectedStates)) {
    if (expected.architecture) continue;
    tabs.find((tab) => tab.dataset.state === key).click();
    assert.equal(architecture.hidden, true, `${key} should hide the architecture`);
    assert.equal(image.hidden, false, `${key} should show a product render`);
    assert.equal(image.src, expected.frames[0][1]);
    assert.equal(copy.children[0].textContent, expected.title);
    assert.deepEqual(variants.children.map((button) => button.textContent), expected.frames.map(([label]) => label));
    assert.equal(variants.children[0].getAttribute("aria-pressed"), "true");
  }

  tabs.find((tab) => tab.dataset.state === "delivery").click();
  variants.children[1].click();
  assert.equal(image.src, "/demo/assets/token-use.png");
  assert.equal(variants.children[1].getAttribute("aria-pressed"), "true");
  assert.equal(variants.children[0].getAttribute("aria-pressed"), "false");
});

const states = {
  control: {
    title: "Know what Codex is doing.",
    text: "A Codex automation running on this Mac gathers current work, recent finishes, background jobs, and anything waiting on me in one place.",
    frames: [
      { label: "Working", src: "/demo/assets/control-tower-active.webp", alt: "Codex Control Tower showing current, recent, and background work" },
      { label: "Needs me", src: "/demo/assets/control-tower-attention.webp", alt: "Codex Control Tower showing one task ready for a response" },
      { label: "Calm", src: "/demo/assets/control-tower-calm.webp", alt: "Codex Control Tower with no urgent work" },
    ],
  },
  exception: {
    title: "Teach it what to watch.",
    text: "It currently checks builds, disk space, services, cloud health, and optional spending limits. When my setup changes, I can give Codex a new check without making the display any busier.",
    frames: [
      { label: "Attention", src: "/demo/assets/exception-critical.gif", alt: "Tidbyts rotating between a failed CI check and stale data" },
      { label: "All clear", src: "/demo/assets/exception-healthy.webp", alt: "Tidbyts showing that every monitored system is healthy" },
    ],
  },
  glint: {
    title: "A tiny face for progress.",
    text: "Glint changes when work starts, needs me, or completes. It makes progress visible without turning the room into another notification feed.",
    frames: [
      { label: "Working", src: "/demo/assets/glint-working.gif", alt: "Animated Glint companion while Codex is working" },
      { label: "Ready", src: "/demo/assets/glint-ready.gif", alt: "Animated Glint companion when Codex needs a response" },
      { label: "Complete", src: "/demo/assets/glint-complete.gif", alt: "Animated Glint companion marking completed work" },
    ],
  },
  delivery: {
    title: "See the work land.",
    text: "Merged pull requests show what landed. AI usage shows how much ran. Both stay readable at a glance.",
    frames: [
      { label: "Pull requests", src: "/demo/assets/landed-prs.png", alt: "Pull requests landed over 24 hours, 7 days, and 30 days" },
      { label: "Model use", src: "/demo/assets/token-use.png", alt: "Codex and Claude token usage over 30 days" },
    ],
  },
  privacy: {
    title: "The private work stays on this Mac.",
    text: "Prompts, code, transcripts, tool calls, paths, and pull-request text stay on this Mac. The shared service can receive only small, content-free records—such as AI usage and landed-PR totals—and only when that feature is enabled.",
    architecture: true,
    caption: "The privacy boundary, in plain English. Every product state above is an actual Pixlet render.",
  },
};

const image = document.querySelector("#state-image");
const architecture = document.querySelector("#architecture");
const pixelSurface = document.querySelector("#pixel-surface");
const copy = document.querySelector("#state-copy");
const buttons = [...document.querySelectorAll("[role=tab]")];
const variantControls = document.querySelector("#variant-controls");
const caption = document.querySelector("#display-caption");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let rotation;
let activeStateKey = "control";
let activeFrameIndex = 0;

function showFrame(state, index) {
  const frame = state.frames?.[index];
  if (!frame) return;

  activeFrameIndex = index;
  image.src = frame.src;
  image.alt = frame.alt;
  [...variantControls.children].forEach((button, buttonIndex) => {
    button.setAttribute("aria-pressed", String(buttonIndex === index));
  });
}

function stopRotation() {
  clearInterval(rotation);
  rotation = undefined;
}

function startRotation(state) {
  stopRotation();
  if (motionQuery.matches || document.hidden || !state.frames || state.frames.length < 2) return;

  rotation = setInterval(() => {
    const nextIndex = (activeFrameIndex + 1) % state.frames.length;
    showFrame(state, nextIndex);
  }, 4200);
}

function showState(key) {
  const state = states[key];
  if (!state) return;

  activeStateKey = key;
  activeFrameIndex = 0;
  stopRotation();

  copy.replaceChildren(
    Object.assign(document.createElement("h3"), { textContent: state.title }),
    Object.assign(document.createElement("p"), { textContent: state.text }),
  );

  architecture.hidden = !state.architecture;
  image.hidden = Boolean(state.architecture);
  pixelSurface.classList.toggle("is-architecture", Boolean(state.architecture));
  variantControls.replaceChildren();
  caption.textContent = state.caption || "Rendered from the same Pixlet apps that run on a Tidbyt. No mockups.";

  if (!state.architecture) {
    state.frames.forEach((frame, index) => {
      const button = Object.assign(document.createElement("button"), {
        type: "button",
        textContent: frame.label,
      });
      button.setAttribute("aria-pressed", String(index === 0));
      button.addEventListener("click", () => {
        showFrame(state, index);
        startRotation(state);
      });
      variantControls.append(button);
    });
    showFrame(state, 0);
  }

  buttons.forEach((button) => {
    const selected = button.dataset.state === key;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected) copy.setAttribute("aria-labelledby", button.id);
  });

  startRotation(state);
}

buttons.forEach((button, index) => {
  button.addEventListener("click", () => showState(button.dataset.state));
  button.addEventListener("keydown", (event) => {
    let nextIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % buttons.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + buttons.length) % buttons.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = buttons.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextButton = buttons[nextIndex];
    nextButton.focus();
    nextButton.scrollIntoView({ behavior: motionQuery.matches ? "auto" : "smooth", block: "nearest", inline: "nearest" });
    showState(nextButton.dataset.state);
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopRotation();
  else startRotation(states[activeStateKey]);
});

motionQuery.addEventListener?.("change", () => startRotation(states[activeStateKey]));

showState("control");

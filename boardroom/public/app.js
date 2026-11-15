const boot = window.__BOARDROOM__ || { stored: null, maxIdeaLength: 280 };
const $ = (id) => document.getElementById(id);

const form = $("pitch");
const ideaInput = $("idea");
const count = $("count");
const submit = $("submit");
const errorBox = $("error");
const room = $("room");
const debate = $("debate");
const waiting = $("waiting");
const verdict = $("verdict");

// Lines can arrive in a burst; reveal them one at a time so the debate reads
// like a conversation.
const LINE_GAP_MS = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900;
let queue = Promise.resolve();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function addLine({ speaker, line }, animate = true) {
  const li = document.createElement("li");
  li.dataset.speaker = speaker;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = speaker;
  li.append(who, document.createTextNode(line));
  debate.append(li);
  if (animate) li.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function showVerdict(stored, animate = true) {
  const url = `${location.origin}/v/${stored.id}`;
  const v = stored.session.verdict;
  const card = $("card");
  card.src = `/v/${stored.id}/card.png`;
  card.alt = `${stored.session.company_name}: ${v.decision}, ${v.valuation} valuation, ${v.score} out of 100. Fatal flaw: ${v.fatal_flaw}`;
  $("download").href = card.src;
  const text = `The AI Boardroom's verdict on my startup idea: ${v.decision} at ${v.valuation}. "${v.best_quote}"`;
  $("tweet").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  $("copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      $("copy").textContent = "Link copied";
    } catch {
      prompt("Copy this link", url);
    }
  };
  waiting.hidden = true;
  verdict.hidden = false;
  if (animate) {
    history.pushState(null, "", `/v/${stored.id}`);
    verdict.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function updateCount() {
  const left = boot.maxIdeaLength - ideaInput.value.length;
  count.textContent = `${left} left`;
  count.classList.toggle("over", left < 0);
}

async function pitch(idea) {
  errorBox.hidden = true;
  submit.disabled = true;
  debate.replaceChildren();
  verdict.hidden = true;
  waiting.hidden = false;
  room.hidden = false;
  $("pitched").textContent = idea;
  queue = Promise.resolve();

  let finished = false;
  const fail = (message) => {
    finished = true;
    queue = queue.then(() => {
      waiting.hidden = true;
      if (!debate.children.length) room.hidden = true;
      showError(message);
    });
  };

  try {
    const res = await fetch("/api/pitch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      fail(body.message || "Something went wrong. Try again.");
      return;
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const event = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (event.type === "line") {
          queue = queue.then(() => addLine(event)).then(() => pause(LINE_GAP_MS));
        } else if (event.type === "verdict") {
          finished = true;
          queue = queue.then(() => showVerdict(event.stored));
        } else if (event.type === "error") {
          fail(event.message);
        }
      }
    }
    if (!finished) fail("The connection dropped before the verdict. Try again.");
  } catch {
    fail("Couldn't reach the boardroom. Check your connection and try again.");
  } finally {
    await queue;
    submit.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const idea = ideaInput.value.trim();
  if (idea.length > boot.maxIdeaLength) return showError(`Keep the pitch under ${boot.maxIdeaLength} characters.`);
  if (idea) pitch(idea);
});

ideaInput.addEventListener("input", updateCount);
ideaInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

updateCount();

// Shared verdict page: render the stored session without calling the API.
if (boot.stored) {
  form.hidden = true;
  room.hidden = false;
  $("pitched").textContent = boot.stored.idea;
  boot.stored.session.debate.forEach((line) => addLine(line, false));
  showVerdict(boot.stored, false);
}

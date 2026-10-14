// 首次使用引导：3 步浮层，看过即记到 localStorage，不再弹
const KEY = "socratic_onboarded";

export function initOnboarding() {
  let seen = false;
  try { seen = localStorage.getItem(KEY) === "1"; } catch {}
  const overlay = document.getElementById("onboard");
  if (!overlay || seen) return;

  const steps = overlay.querySelectorAll(".onboard-step");
  const dots = overlay.querySelectorAll(".onboard-dot");
  const prev = document.getElementById("onboard-prev");
  const next = document.getElementById("onboard-next");
  const skip = document.getElementById("onboard-skip");
  let i = 0;

  function show(n) {
    i = Math.max(0, Math.min(steps.length - 1, n));
    steps.forEach((s, k) => s.classList.toggle("show", k === i));
    dots.forEach((d, k) => d.classList.toggle("active", k === i));
    prev.style.visibility = i === 0 ? "hidden" : "visible";
    next.textContent = i === steps.length - 1 ? "开始使用" : "下一步";
  }
  function close() {
    try { localStorage.setItem(KEY, "1"); } catch {}
    overlay.hidden = true;
    overlay.classList.remove("show");
  }

  prev.onclick = () => show(i - 1);
  next.onclick = () => (i === steps.length - 1 ? close() : show(i + 1));
  skip.onclick = close;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  overlay.hidden = false;
  // 触发淡入
  requestAnimationFrame(() => overlay.classList.add("show"));
  show(0);
}

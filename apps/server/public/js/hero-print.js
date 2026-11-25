(function () {
  const printed = document.getElementById("printed");
  const nozzle = document.getElementById("nozzle");
  const statusWrap = document.getElementById("status");
  if (!printed || !nozzle || !statusWrap) return;

  const counter = statusWrap.querySelector("b");
  const end = 0.86;
  const totalDisplayed = 412;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setProgress(v) {
    const top = (1 - v) * 100;
    printed.style.clipPath = `inset(${top}% 0 0 0)`;
    nozzle.style.top = `${top}%`;
    if (counter) {
      counter.textContent = String(Math.round((v / end) * totalDisplayed));
    }
  }

  if (reduceMotion) {
    setProgress(end);
    return;
  }

  let startTime = null;
  function frame(timestamp) {
    if (startTime === null) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / 3200, 1);
    setProgress(end * (1 - Math.pow(1 - progress, 2)));
    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
})();

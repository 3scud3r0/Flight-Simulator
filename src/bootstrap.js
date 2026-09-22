/**
 * Tiny standalone bootstrap. A failed module import must show a usable error,
 * not leave the user staring at CARREGANDO forever.
 */
const loading = document.getElementById("loading");
const safe = new URL(location.href);
safe.searchParams.set("safe", "1");
const retry = document.createElement("a");
retry.href = safe.href;
retry.textContent = "ABRIR MODO COMPATIBILIDADE";
retry.style.cssText = "display:block;color:#91f1ff;margin-top:12px;" +
  "text-decoration:underline;font-size:13px;";
function fail(error) {
  console.error("[RioFlight] Initialization failed:", error);
  loading.classList.remove("hidden");
  loading.style.cssText =
    "position:fixed;z-index:9999;left:50%;top:50%;bottom:auto;" +
    "transform:translate(-50%,-50%);width:min(440px,90vw);" +
    "white-space:normal;text-align:center;line-height:1.6;padding:24px";
  loading.textContent =
    "Falha ao iniciar o simulador. O navegador pode estar sem WebGL," +
    " sem acesso à biblioteca 3D ou com memória gráfica insuficiente.";
  loading.append(retry);
}
window.addEventListener("error", event => {
  if (event.error) fail(event.error);
});
window.addEventListener("unhandledrejection", event => {
  fail(event.reason);
});
try {
  await import("./main.js");
} catch (error) {
  fail(error);
}

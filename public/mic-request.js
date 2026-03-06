document.getElementById("btn").addEventListener("click", async () => {
  const btn = document.getElementById("btn");
  const msg = document.getElementById("msg");
  btn.disabled = true;
  msg.textContent = "Waiting for permission\u2026";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    chrome.runtime.sendMessage({ type: "MIC_PERMISSION_GRANTED" });
    window.parent.postMessage({ type: "F1_MIC_DONE" }, "*");
  } catch (err) {
    btn.disabled = false;
    msg.style.color = "#f87171";
    msg.textContent = String(err);
  }
});

document.getElementById("cancel").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "MIC_PERMISSION_CANCELLED" });
  window.parent.postMessage({ type: "F1_MIC_DONE" }, "*");
});

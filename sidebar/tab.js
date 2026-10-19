// Feasibility check: can Songsterr render inside an extension sidebar in this browser?
document.getElementById('f').addEventListener('submit', e => {
  e.preventDefault();
  document.getElementById('frame').src = document.getElementById('u').value.trim();
});

const dayNightToggle = () => {
  const html = document.querySelector("html");
  const body = document.querySelector("body");
  const title = document.querySelector(".header-title");
  const connectBtn = document.querySelector(".connect-button");
  const dayNightIcon = document.querySelector(".header-right-daynight");

  html.classList.toggle("switch");
  body.classList.toggle("switch");
  title.classList.toggle("switch");
  connectBtn.classList.toggle("switch");

  document.querySelectorAll(".header-left-button").forEach((btn) => {
    btn.classList.toggle("switch");
  });

  document.querySelectorAll(".header-right-button").forEach((btn) => {
    btn.classList.toggle("switch");
  });

  document.querySelectorAll(".header-left-icon").forEach((ic) => {
    ic.classList.toggle("switch");
  });

  document.querySelectorAll(".header-right-icon").forEach((ic) => {
    ic.classList.toggle("switch");
  });

  document.querySelectorAll(".square").forEach((square) => {
    // Only toggle switch class for unguessed tiles (for font color)
    if (!square.classList.contains("guessed")) {
      square.classList.toggle("switch");
    }

    // Always update border colors for all tiles
    if (!square.dataset.result) {
      // For unguessed tiles, update border based on theme
      const isLightMode = html.classList.contains("switch");
      const defaultBorderColor = isLightMode
        ? "rgb(211, 214, 218)"
        : "rgb(58, 58, 60)";
      if (square.style.borderColor !== "rgb(135, 138, 140)") {
        // Don't override typing border
        square.style.borderColor = defaultBorderColor;
      }
    }

    // Recompute color based on stored result for guessed tiles
    if (square.dataset.result) {
      const result = square.dataset.result;
      const newColor = getTileColor(result);
      square.style.backgroundColor = newColor;
      square.style.borderColor = newColor;
    }
  });

  // Update keyboard keys with stored results
  document.querySelectorAll(".keyboard-row button").forEach((keyButton) => {
    keyButton.classList.toggle("switch");

    // Recompute color based on stored result
    if (keyButton.dataset.result) {
      const result = keyButton.dataset.result;
      const newColor = getTileColor(result);
      keyButton.style.backgroundColor = newColor;
      keyButton.style.color = "white";
    }
  });

  // Swap the icon
  if (dayNightIcon.classList.contains("switch")) {
    dayNightIcon.style.backgroundImage = "url('../images/nighticon.png')";
  } else {
    dayNightIcon.style.backgroundImage = "url('../images/dayicon.png')";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const dayNightButton = document.querySelector(".daynight-button");
  dayNightButton.onclick = dayNightToggle;
});
